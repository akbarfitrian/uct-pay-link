-- ============================================================================
-- uct-pay-link :: wallet-linked quest progress
--
-- Today, quest progress lives on an *anonymous* Supabase user id that's
-- generated per-browser (see ensureSignedIn() in useQuests.ts) — progress
-- resets if the user clears storage or switches devices. This migration
-- adds a `wallet_address` on profiles and a link_wallet_identity() RPC so
-- connecting Sphere Wallet (via the iframe connect flow, same one PayPage
-- already uses) attaches the current progress to that wallet, and — if the
-- same wallet was already linked from another device — pulls that earlier
-- progress back in, so nothing is lost.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. profiles: add the wallet identity + when it was linked.
-- ----------------------------------------------------------------------------
alter table public.profiles
  add column if not exists wallet_address   text,
  add column if not exists wallet_linked_at timestamptz;

-- One profile per wallet. Partial index (where wallet_address is not null)
-- so unlinked/anonymous profiles never collide with each other.
create unique index if not exists profiles_wallet_address_key
  on public.profiles (wallet_address)
  where wallet_address is not null;

-- ----------------------------------------------------------------------------
-- 2. link_wallet_identity(): called right after ConnectClient.connect()
--    succeeds in the browser. Idempotent, and safe to call every time the
--    wallet connects (e.g. every visit) — re-linking the same wallet to the
--    same profile is just a no-op update.
--
--    Merge behaviour: if this wallet was previously linked to a *different*
--    profile (e.g. the user completed quests on another device, then opens
--    this device and connects the same wallet), that other profile's
--    quest_completions and asset_usage are copied into the current
--    session's profile — using the same ON CONFLICT DO NOTHING idempotency
--    guard as complete_quest()/record_asset_used() — and the old profile's
--    wallet_address is cleared so it no longer holds the unique slot. The
--    old profile's own rows are left in place (nothing is deleted), the
--    merge is additive only.
-- ----------------------------------------------------------------------------
create or replace function public.link_wallet_identity(p_wallet_address text)
returns table (
  total_points        integer,
  completed_quest_ids text[],
  used_assets         text[],
  wallet_address      text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user   uuid := auth.uid();
  v_wallet text := lower(trim(p_wallet_address));
  v_owner  uuid;
  v_total  integer;
begin
  if v_user is null then
    raise exception 'Not authenticated';
  end if;

  if v_wallet = '' then
    raise exception 'Wallet address required';
  end if;

  insert into public.profiles (user_id) values (v_user) on conflict (user_id) do nothing;

  -- Already linked to some other (earlier) profile?
  select p.user_id into v_owner
  from public.profiles p
  where p.wallet_address = v_wallet and p.user_id <> v_user;

  if v_owner is not null then
    insert into public.quest_completions (user_id, quest_id, points_awarded, completed_at)
    select v_user, qc.quest_id, qc.points_awarded, qc.completed_at
    from public.quest_completions qc
    where qc.user_id = v_owner
    on conflict (user_id, quest_id) do nothing;

    insert into public.asset_usage (user_id, asset_symbol, first_used_at)
    select v_user, au.asset_symbol, au.first_used_at
    from public.asset_usage au
    where au.user_id = v_owner
    on conflict (user_id, asset_symbol) do nothing;

    -- Free the unique wallet_address slot on the old profile; its rows stay.
    update public.profiles
    set wallet_address = null, wallet_linked_at = null, updated_at = now()
    where user_id = v_owner;
  end if;

  -- Recompute this profile's total from quest_completions (same derivation
  -- rule as complete_quest()) so a merge can never leave a stale total.
  select coalesce(sum(points_awarded), 0) into v_total
  from public.quest_completions
  where user_id = v_user;

  update public.profiles
  set wallet_address   = v_wallet,
      wallet_linked_at = now(),
      total_points     = v_total,
      updated_at       = now()
  where user_id = v_user;

  return query
  select
    p.total_points,
    coalesce((select array_agg(qc.quest_id) from public.quest_completions qc where qc.user_id = v_user), array[]::text[]),
    coalesce((select array_agg(au.asset_symbol) from public.asset_usage au where au.user_id = v_user), array[]::text[]),
    p.wallet_address
  from public.profiles p
  where p.user_id = v_user;
end;
$$;

grant execute on function public.link_wallet_identity(text) to authenticated;

-- ----------------------------------------------------------------------------
-- 3. get_my_quest_state(): now also returns wallet_address, so the app can
--    show "connected as @..." immediately on load without a second round
--    trip. Postgres won't let CREATE OR REPLACE change a function's return
--    columns, so the old 3-column version has to be dropped first.
-- ----------------------------------------------------------------------------
drop function if exists public.get_my_quest_state();

create or replace function public.get_my_quest_state()
returns table (
  total_points        integer,
  completed_quest_ids text[],
  used_assets         text[],
  wallet_address       text
)
language sql
security definer
set search_path = public
stable
as $$
  select
    coalesce((select p.total_points from public.profiles p where p.user_id = auth.uid()), 0),
    coalesce((select array_agg(qc.quest_id) from public.quest_completions qc where qc.user_id = auth.uid()), array[]::text[]),
    coalesce((select array_agg(au.asset_symbol) from public.asset_usage au where au.user_id = auth.uid()), array[]::text[]),
    (select p.wallet_address from public.profiles p where p.user_id = auth.uid());
$$;

grant execute on function public.get_my_quest_state() to authenticated;
