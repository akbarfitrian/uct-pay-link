# Migrating uct-pay-link's points system to Supabase

## What I found in the repo first

A couple of things worth knowing before touching code, since they change the
implementation:

- **This is Vite + React, not Next.js.** (`vite.config.ts`, `import.meta`,
  deployed as a static SPA per `vercel.json`.) Env vars must be prefixed
  `VITE_` and read via `import.meta.env`, not `process.env`.
- **There's no auth system today.** No login, no `supabase.auth` calls, no
  user concept anywhere in the app. `Supabase RLS` and "each user's own
  data" both require *some* notion of a user, so this migration adds one:
  **Supabase anonymous auth**. It creates a real `auth.users` row and a
  stable `auth.uid()` per browser with zero login UI — functionally the same
  "just works, no signup" feel you have now, but backed by a real account
  that can later be upgraded to email/wallet-linked without losing history.
- **Points aren't an arbitrary counter.** They're the sum of points for a
  fixed set of completed quest ids (`src/config/quests.ts`). So the
  "increment/decrement race condition" you're worried about really shows up
  as: *don't award the same quest twice*, and *don't lose one quest's award
  when two land close together*. The schema and RPCs below are built around
  that — plus a generic `adjust_points` RPC for a true arbitrary
  balance, in case you add a "spend points" feature later.

## 1. Install the client

```bash
npm install @supabase/supabase-js
```

## 2. Apply the SQL migration

In the Supabase dashboard: **SQL Editor → paste the contents of
`supabase/migrations/0001_points_system.sql` → Run.**

(Or, if you use the Supabase CLI locally: drop the file in
`supabase/migrations/` and run `supabase db push`.)

This creates:
- `quests` — server-side catalog of quest ids → point values (source of
  truth so a client can't award itself arbitrary points)
- `profiles` — one row per user, cached `total_points` for cheap reads
- `quest_completions` — one row per (user, quest) ever completed; the
  primary key on `(user_id, quest_id)` is what makes double-completion
  structurally impossible
- `asset_usage` — distinct assets used, backing the `multi_asset` quest
- RLS policies so every table only allows `SELECT` where `auth.uid() =
  user_id` — and **no** insert/update policies for regular users at all.
  All writes go through the `SECURITY DEFINER` functions below, which check
  `auth.uid()` internally. This is the important bit for security: even a
  tampered client can't `supabase.from('profiles').update({ total_points:
  999999 })` directly, because there's no policy that would allow it.
- RPCs: `ensure_profile`, `complete_quest`, `record_asset_used`,
  `get_my_quest_state`, `adjust_points`

## 3. Enable anonymous sign-ins

Dashboard → **Authentication → Sign In / Providers → Anonymous Sign-Ins →
enable.** (Off by default on new projects.)

## 4. Env vars

Copy `.env.example` → `.env`, fill in your project URL and anon key from
**Project Settings → API**. `.env` is already gitignored.

## 5. Drop in the files

- `src/lib/supabaseClient.ts` — new file, the client singleton
- `src/hooks/useQuests.ts` — **replaces** the existing file. Same exported
  shape (`quests`, `completedIds`, `totalPoints`, `tier`, `completeQuest`,
  `recordAssetUsed`, `activeToast`, `dismissToast`), plus one new optional
  `isReady` field — so `QuestsContext.tsx`, `QuestWidget.tsx`,
  `QuestPanel.tsx`, `BulkRequestView.tsx`, and `ExpressRequestView.tsx` all
  keep working with **zero changes**.

That's it for integration — no changes needed to `main.tsx`, `App.tsx`, or
any component that consumes `useQuestsContext()`.

## How the safe increment actually works

Two layers, matching what you asked for:

1. **Uniqueness, not counting.** `quest_completions` has a composite primary
   key on `(user_id, quest_id)`. `complete_quest()` does
   `INSERT ... ON CONFLICT (user_id, quest_id) DO NOTHING`. If two requests
   for the same quest race each other, Postgres's row-level conflict
   resolution guarantees exactly one of them inserts a row — there is no
   window where both can succeed, so the same quest can never be
   double-awarded no matter how many times the client calls it (this is why
   the client-side call is a plain fire-and-forget, not something you need
   to debounce or lock).
2. **Recomputed, not incremented.** `profiles.total_points` is always set to
   `SUM(points_awarded)` over that user's completions in the same
   transaction as the insert — never `total_points + 10`. That means even if
   something else touched the row concurrently, the total is always
   consistent with what's actually in `quest_completions`, by construction.

For a genuinely free-form balance (not quest-derived), `adjust_points(delta)`
does a single `UPDATE profiles SET total_points = total_points + delta ...
RETURNING total_points`. Postgres takes a row lock for the duration of that
`UPDATE`, so concurrent calls serialize against each other instead of both
reading a stale value — that single-statement form is the important part;
splitting it into a `SELECT` then `UPDATE` from application code is exactly
the pattern that causes lost updates. Don't call this for quest-related
points, though — mixing it with `complete_quest`/`record_asset_used` would
let the cached total drift from what `quest_completions` says it should be.

## Fetching on landing/login

`useQuests()`'s bootstrap effect does this automatically on mount:
`ensureSignedIn()` (resumes the persisted anonymous session, or creates one
on first visit) → `ensure_profile()` → `get_my_quest_state()` (one round
trip for total points + completed quest ids + used assets). No page/route
needs to call anything extra.

## Later: upgrading from anonymous to a real account

If you add real login later, Supabase lets you convert the anonymous user in
place (`supabase.auth.updateUser({ email })` or `linkIdentity`), keeping the
same `auth.uid()` — so existing points and quest history carry over rather
than resetting.

## 6. Wallet-linked progress (`0002_wallet_link.sql`)

This is the "upgrade" from the section above, done with a wallet instead of
email — no new login flow, it reuses the Sphere Wallet connect popup that
`PayPage.tsx` already shows for payments.

**Apply the migration** the same way as `0001`: SQL Editor → paste
`supabase/migrations/0002_wallet_link.sql` → Run (or `supabase db push`).

It adds:
- `profiles.wallet_address` / `wallet_linked_at` — nullable, plus a
  **partial unique index** (`where wallet_address is not null`) so two
  profiles can never claim the same wallet.
- `link_wallet_identity(p_wallet_address)` — call this right after
  `ConnectClient.connect()` resolves. It's `SECURITY DEFINER`, same pattern
  as `complete_quest`, and it does one extra thing: if the wallet was
  *already* linked to a different (earlier) profile — e.g. quests were
  completed on another device, then this device connects the same wallet —
  it copies that profile's `quest_completions`/`asset_usage` into the
  current session's profile (`ON CONFLICT DO NOTHING`, so already-shared
  quests aren't double counted) and frees the old profile's `wallet_address`
  slot. Nothing is deleted; the merge is additive only.
- `get_my_quest_state()` — updated to also return `wallet_address`, so a
  returning wallet-linked user sees "connected as @..." immediately on load
  without a second round trip.

**New code:**
- `src/lib/sphereConnect.ts` — the iframe `postMessage` transport,
  `isInsideSphere()`, and `sphereAgentUrl()` helper, pulled out of
  `PayPage.tsx` so both the payment flow and the quest-progress-linking flow
  share one implementation instead of two copies drifting apart.
  `PayPage.tsx` now imports from here instead of defining its own transport.
- `src/hooks/useQuests.ts` — adds `walletAddress`, `walletStatus`
  (`idle | connecting | linking | linked | error`), `walletError`,
  `connectWallet()`, and `canConnectWallet` to the hook's return value.
  Everything from the `0001` migration (`quests`, `completedIds`,
  `totalPoints`, `tier`, `completeQuest`, `recordAssetUsed`, `activeToast`,
  `dismissToast`, `isReady`) is unchanged, so this is additive too.
- `src/components/WalletConnect.tsx` — new. Renders inside `QuestPanel`:
  a "Connect Wallet to save progress" button when running inside Sphere's
  iframe, an "Open in Sphere Wallet" link when it isn't (same fallback
  `PayPage` shows for payments), or a "Progress synced to @..." confirmation
  once linked.

**Why this only works inside Sphere's iframe:** `connectWallet()` calls
`ConnectClient.connect()` over the same `window.parent.postMessage` bridge
`PayPage.tsx` uses — there's simply no parent frame to talk to unless Sphere
is the one hosting this page. `canConnectWallet` (`= isInsideSphere()`) is
exposed from the hook precisely so UI can branch on this instead of showing
a button that would silently do nothing.
