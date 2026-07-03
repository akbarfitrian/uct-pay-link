-- ============================================================================
-- uct-pay-link :: points system migration
-- Run this in the Supabase SQL editor, or via `supabase db push` if you're
-- using the CLI with this file under supabase/migrations/.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Reference table: quest catalog (mirrors src/config/quests.ts)
-- ----------------------------------------------------------------------------
-- Keeping this server-side (rather than trusting a points value the client
-- sends) means a modified client can never award itself arbitrary points —
-- the RPCs below always look up the award amount from here.
create table if not exists public.quests (
  quest_id text primary key,
  points integer not null check (points >= 0)
);

insert into public.quests (quest_id, points) values
  ('first_link',   10),
  ('copy_cat',      5),
  ('bulk_starter', 15),
  ('bulk_master',  25),
  ('multi_asset',  15),
  ('explorer',     10)
on conflict (quest_id) do update set points = excluded.points;

-- ----------------------------------------------------------------------------
-- 2. profiles: one row per user, cached total for cheap reads
-- ----------------------------------------------------------------------------
create table if not exists public.profiles (
  user_id      uuid primary key references auth.users (id) on delete cascade,
  total_points integer not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- 3. quest_completions: source of truth. The primary key doubles as the
--    "has this user already completed this quest" guard — this is what
--    actually prevents double-awarding under concurrent requests, not any
--    application-level check.
-- ----------------------------------------------------------------------------
create table if not exists public.quest_completions (
  user_id        uuid not null references auth.users (id) on delete cascade,
  quest_id       text not null references public.quests (quest_id),
  points_awarded integer not null,
  completed_at   timestamptz not null default now(),
  primary key (user_id, quest_id)
);

-- ----------------------------------------------------------------------------
-- 4. asset_usage: distinct assets a user has used in a generated link.
--    Backs the "multi_asset" meta-quest.
-- ----------------------------------------------------------------------------
create table if not exists public.asset_usage (
  user_id       uuid not null references auth.users (id) on delete cascade,
  asset_symbol  text not null,
  first_used_at timestamptz not null default now(),
  primary key (user_id, asset_symbol)
);

-- ----------------------------------------------------------------------------
-- 5. Row Level Security
-- ----------------------------------------------------------------------------
-- Everyone can read the quest catalog (it's not sensitive).
alter table public.quests enable row level security;
create policy "quests are publicly readable"
  on public.quests for select
  using (true);

-- Users can only ever read their OWN rows. Note there are deliberately no
-- insert/update/delete policies for authenticated users on profiles,
-- quest_completions, or asset_usage — all writes go through the
-- SECURITY DEFINER functions below, which enforce auth.uid() internally.
-- This means even a compromised/modified client can't write directly to
-- these tables via the Supabase client, only call the narrow RPCs.
alter table public.profiles enable row level security;
create policy "users read their own profile"
  on public.profiles for select
  using (auth.uid() = user_id);

alter table public.quest_completions enable row level security;
create policy "users read their own quest completions"
  on public.quest_completions for select
  using (auth.uid() = user_id);

alter table public.asset_usage enable row level security;
create policy "users read their own asset usage"
  on public.asset_usage for select
  using (auth.uid() = user_id);

-- ----------------------------------------------------------------------------
-- 6. ensure_profile(): idempotent profile bootstrap, called once after
--    sign-in (anonymous or otherwise) so `profiles` always has a row before
--    the client tries to read it.
-- ----------------------------------------------------------------------------
create or replace function public.ensure_profile()
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile public.profiles;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  insert into public.profiles (user_id)
  values (auth.uid())
  on conflict (user_id) do nothing;

  select * into v_profile from public.profiles where user_id = auth.uid();
  return v_profile;
end;
$$;

grant execute on function public.ensure_profile() to authenticated;

-- ----------------------------------------------------------------------------
-- 7. complete_quest(): the safe increment.
--
--    Race-condition handling: the INSERT ... ON CONFLICT DO NOTHING on
--    quest_completions is what makes this safe under concurrency — Postgres
--    resolves conflicting concurrent inserts at the row level, so two
--    simultaneous calls (e.g. a double-click, or two tabs) can never award
--    the same quest twice. `FOUND` after that statement tells us whether
--    *this* call was the one that actually inserted the row, which is how
--    we know whether to queue a toast / report a new unlock. The points
--    total is always recomputed as SUM(points_awarded) rather than
--    incremented in place, so it can never drift from the completions it's
--    derived from, even if something else touches the row concurrently.
-- ----------------------------------------------------------------------------
create or replace function public.complete_quest(p_quest_id text)
returns table (newly_unlocked text[], total_points integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user     uuid := auth.uid();
  v_points   integer;
  v_unlocked text[] := array[]::text[];
  v_total    integer;
begin
  if v_user is null then
    raise exception 'Not authenticated';
  end if;

  select points into v_points from public.quests where quest_id = p_quest_id;
  if v_points is null then
    raise exception 'Unknown quest_id: %', p_quest_id;
  end if;

  insert into public.profiles (user_id) values (v_user) on conflict (user_id) do nothing;

  insert into public.quest_completions (user_id, quest_id, points_awarded)
  values (v_user, p_quest_id, v_points)
  on conflict (user_id, quest_id) do nothing;

  if found then
    v_unlocked := array_append(v_unlocked, p_quest_id);
  end if;

  -- Meta-quest: "explorer" = first_link AND bulk_starter both completed.
  -- Re-checked on every call (not just when first_link/bulk_starter land)
  -- so it can never end up out of sync with its underlying condition —
  -- mirrors deriveMetaCompletions() in the current useQuests.ts.
  if exists (select 1 from public.quest_completions where user_id = v_user and quest_id = 'first_link')
     and exists (select 1 from public.quest_completions where user_id = v_user and quest_id = 'bulk_starter')
     and not exists (select 1 from public.quest_completions where user_id = v_user and quest_id = 'explorer')
  then
    insert into public.quest_completions (user_id, quest_id, points_awarded)
    select v_user, 'explorer', points from public.quests where quest_id = 'explorer'
    on conflict (user_id, quest_id) do nothing;

    if found then
      v_unlocked := array_append(v_unlocked, 'explorer');
    end if;
  end if;

  select coalesce(sum(points_awarded), 0) into v_total
  from public.quest_completions
  where user_id = v_user;

  update public.profiles
  set total_points = v_total, updated_at = now()
  where user_id = v_user;

  return query select v_unlocked, v_total;
end;
$$;

grant execute on function public.complete_quest(text) to authenticated;

-- ----------------------------------------------------------------------------
-- 8. record_asset_used(): logs a distinct asset symbol, and unlocks the
--    "multi_asset" meta-quest once 2+ distinct assets have been used.
--    Same idempotency pattern as above via the (user_id, asset_symbol) PK.
-- ----------------------------------------------------------------------------
create or replace function public.record_asset_used(p_asset text)
returns table (newly_unlocked text[], total_points integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user           uuid := auth.uid();
  v_asset          text := upper(trim(p_asset));
  v_unlocked       text[] := array[]::text[];
  v_total          integer;
  v_distinct_count integer;
begin
  if v_user is null then
    raise exception 'Not authenticated';
  end if;

  if v_asset = '' then
    select total_points into v_total from public.profiles where user_id = v_user;
    return query select v_unlocked, coalesce(v_total, 0);
  end if;

  insert into public.profiles (user_id) values (v_user) on conflict (user_id) do nothing;

  insert into public.asset_usage (user_id, asset_symbol)
  values (v_user, v_asset)
  on conflict (user_id, asset_symbol) do nothing;

  select count(*) into v_distinct_count from public.asset_usage where user_id = v_user;

  if v_distinct_count >= 2
     and not exists (select 1 from public.quest_completions where user_id = v_user and quest_id = 'multi_asset')
  then
    insert into public.quest_completions (user_id, quest_id, points_awarded)
    select v_user, 'multi_asset', points from public.quests where quest_id = 'multi_asset'
    on conflict (user_id, quest_id) do nothing;

    if found then
      v_unlocked := array_append(v_unlocked, 'multi_asset');
    end if;
  end if;

  select coalesce(sum(points_awarded), 0) into v_total
  from public.quest_completions
  where user_id = v_user;

  update public.profiles
  set total_points = v_total, updated_at = now()
  where user_id = v_user;

  return query select v_unlocked, v_total;
end;
$$;

grant execute on function public.record_asset_used(text) to authenticated;

-- ----------------------------------------------------------------------------
-- 9. get_my_quest_state(): one round trip for everything the app needs on
--    load — profile total, completed quest ids, used assets.
-- ----------------------------------------------------------------------------
create or replace function public.get_my_quest_state()
returns table (total_points integer, completed_quest_ids text[], used_assets text[])
language sql
security definer
set search_path = public
stable
as $$
  select
    coalesce((select p.total_points from public.profiles p where p.user_id = auth.uid()), 0),
    coalesce((select array_agg(qc.quest_id) from public.quest_completions qc where qc.user_id = auth.uid()), array[]::text[]),
    coalesce((select array_agg(au.asset_symbol) from public.asset_usage au where au.user_id = auth.uid()), array[]::text[]);
$$;

grant execute on function public.get_my_quest_state() to authenticated;

-- ----------------------------------------------------------------------------
-- 10. adjust_points(): generic, general-purpose safe increment/decrement,
--     provided as requested for any FUTURE feature that needs a freely
--     adjustable balance (e.g. spending points on a reward).
--
--     Do NOT call this for quest awards — it would let the cached total on
--     `profiles` drift out of sync with `quest_completions`, defeating the
--     point of deriving the total from a source-of-truth table. Use
--     complete_quest()/record_asset_used() for anything quest-related.
--
--     Atomicity here comes from the single UPDATE ... RETURNING statement:
--     Postgres takes a row lock on the target profiles row for the duration
--     of the UPDATE, so concurrent calls are serialized against each other
--     and neither can read a stale total_points before writing.
-- ----------------------------------------------------------------------------
create or replace function public.adjust_points(p_delta integer)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user  uuid := auth.uid();
  v_total integer;
begin
  if v_user is null then
    raise exception 'Not authenticated';
  end if;

  insert into public.profiles (user_id) values (v_user) on conflict (user_id) do nothing;

  update public.profiles
  set total_points = greatest(total_points + p_delta, 0),
      updated_at = now()
  where user_id = v_user
  returning total_points into v_total;

  return v_total;
end;
$$;

grant execute on function public.adjust_points(integer) to authenticated;
