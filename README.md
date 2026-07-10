# UCT Pay Link

A payment link and QR code generator built on the Sphere Unicity Network. It lets anyone create a shareable link for a payment request, send it to a client, and have that client settle it directly from Sphere Wallet — no account, plugin, or manual token entry required on the payer's side.

## Overview

The application runs as a static single-page app (React + Vite + TypeScript) and integrates with Sphere through `@unicitylabs/sphere-sdk`. It has two functional halves:

- **Link generation** — a dashboard for creating one payment link at a time (Express Request) or generating many at once from pasted spreadsheet data (Bulk Request).
- **Payment execution** — a `/pay` page that resolves a link's parameters, connects to Sphere Wallet, and submits the transfer intent on Unicity Testnet2.

A lightweight quest and points system, backed by Supabase, sits alongside these flows to encourage users to try both request modes and multiple assets.

## Core Features

- Generate payment links in the form `/pay?to=NAMETAG&amount=BASE_UNITS&coin=TOKEN_ID&note=MESSAGE`
- Render each link as a scannable QR code
- Pay directly from Sphere Wallet with a single click
- Two request modes from a dashboard menu: **Express Request** for a single recipient, **Bulk Request** for CSV/spreadsheet-driven batches
- Live USD pricing per asset via CoinGecko, shown alongside the amount
- Direct share to WhatsApp and Telegram from a generated link
- Light and dark ("Night Mode") themes, following system preference on first load and persisted afterward
- Quests and points that track usage (first link generated, link copied, bulk batch generated, multiple assets used, etc.), with tiered ranks and an optional wallet-linked profile

## Request Modes

After opening `/app`, the dashboard menu offers two flows.

### Express Request
For a single, immediate payment link:
1. Enter the recipient's nametag (`@user`)
2. Enter an amount and choose an asset (UCT, USDU, USDC, SOL, ETH, BTC) — live USD price is fetched from CoinGecko
3. Optionally add a note
4. Generate the link and QR code, ready to copy or share

### Bulk Request
For generating many payment links at once:
1. **Prepare data** — download the CSV template, fill it in a spreadsheet, then paste the rows in (tab-separated or comma-separated both work); columns are `ID User, Amount, Asset, Note`
2. **Validate rows** — each row is checked for a valid nametag, a positive amount, and a supported asset; invalid rows are flagged with the reason
3. **Generate links** — once every row is valid, a payment link and QR-ready URL are produced for each row
4. **Export** — download the full result, including generated links, back out as CSV

## Sphere Network Integration

Payments are executed entirely through Sphere Wallet on the Unicity Testnet2 network, using `ConnectClient` from `@unicitylabs/sphere-sdk/connect`.

### Transport

The app is opened inside Sphere Wallet's own iframe (via its `agents/custom` agent URL), rather than through a browser extension. Connection uses a `postMessage`-based transport between the page and its parent Sphere frame:

```typescript
const client = new ConnectClient({
  transport: createIframeTransport(), // window.parent.postMessage bridge
  dapp: { name: 'UCT Pay Link', description: '...', url: window.location.origin },
  network: SPHERE_NETWORKS.testnet2,
})
```

`isInsideSphere()` (`window !== window.parent`) determines whether the current page can talk to Sphere at all. When it can't — for example, someone opened the link directly rather than through Sphere — the app instead shows an "Open in Sphere Wallet" link that reloads the same page inside Sphere's iframe via:

```
https://sphere.unicity.network/agents/custom?url=<encoded target URL>
```

### Payment flow

`PayPage.tsx` drives the transaction once a valid link is opened inside Sphere:

1. `client.connect()` — establishes the connection and returns the wallet identity
2. `client.query('sphere_getAssets')` — resolves the requested asset symbol (e.g. `UCT`) to Sphere's internal `coinId` and decimal precision, falling back to a UTF-8 hex encoding of the symbol if the asset isn't found
3. `client.intent('send', { to, coinId, amount })` — submits the transfer, with the amount converted to base units according to the asset's decimals

Errors are pattern-matched to give a specific message for rejected transactions, insufficient balance, or a network mismatch.

### Payment link format

```
/pay?to=NAMETAG&amount=BASE_UNITS&coin=TOKEN_ID&note=MESSAGE
```

| Parameter | Required | Description |
|-----------|----------|-------------|
| `to`      | Yes      | Receiver nametag, without `@` |
| `amount`  | Yes      | Amount in base units |
| `coin`    | Yes      | Token symbol (UCT, USDU, USDC, SOL, ETH, BTC) |
| `note`    | No       | Optional message shown to the payer |

## Quests, Points, and Wallet Linking

A points system tracks how a user interacts with the generator and is backed by Supabase (anonymous auth, Postgres, and RLS-protected tables).

- **Anonymous accounts.** On first visit, an anonymous Supabase session is created for the browser with no login step. This gives each visitor a stable `auth.uid()` so progress can be attributed to them without a signup wall.
- **Quests are defined client-side** in `src/config/quests.ts` (id, title, description, and point value) but **awarded server-side** through `SECURITY DEFINER` Postgres functions, so a tampered client cannot grant itself points directly. Current quests cover generating a first link, copying a link, completing a bulk batch, generating a large batch, using more than one asset, and trying both request modes.
- **Idempotent completion.** A composite primary key on `(user_id, quest_id)` in `quest_completions`, combined with `INSERT ... ON CONFLICT DO NOTHING`, guarantees a quest can never be double-awarded, even under concurrent calls.
- **Recomputed totals.** `profiles.total_points` is always recalculated as the sum of a user's completions within the same transaction, rather than incremented — so the cached total can never drift from the underlying records.
- **Wallet linking.** From inside Sphere's iframe, a user can connect their Sphere Wallet to attach their points/quest history to a nametag instead of an anonymous session. If the wallet was already linked to an earlier anonymous profile (e.g. from a different device), that profile's history is merged in additively.
- **Cross-context session handoff.** Because Sphere embeds the app in a third-party iframe, browsers partition `localStorage` separately for the standalone tab and the embedded view, which would otherwise split a single visitor's progress into two accounts. The app carries the Supabase session token across via a single-use URL fragment (never sent to any server) so the same identity — and the same points — follow the user into Sphere.

## Light Mode and Night Mode

- Toggled via the sun/moon icon in the navbar
- Follows the browser/OS preference (`prefers-color-scheme`) on first load
- Preference is then saved to `localStorage` and restored on later visits
- Implemented by toggling a `dark` class on `<html>`; all styling in `App.css` reacts through CSS variables

## How It Works

```
[Dashboard Menu]         [Generator Form]            [Payment Link]              [Pay Page in Sphere]
  Choose Express     →   Express: 1 recipient   →   ?to=alice&amount=       →    Connect to
  or Bulk Request         Bulk: paste many rows       1000000&coin=UCT            Sphere Wallet
                          Click Generate               (shareable / QR)           Resolve asset, send intent
                                                                                   Transaction confirmed
```

## Project Structure

```
uct-pay-link/
├── src/
│   ├── App.tsx                        Router, navbar, ThemeToggle, QuestWidget
│   ├── App.css                        All styling, including light/dark CSS variables
│   ├── main.tsx                       Entry point; consumes session handoff before app renders
│   ├── components/
│   │   ├── Footer.tsx                 Shared footer
│   │   ├── Logo.tsx                   App logo
│   │   ├── ThemeToggle.tsx            Light/Night Mode switch
│   │   ├── ShareButtons.tsx           WhatsApp / Telegram share buttons
│   │   ├── QuestWidget.tsx            Points/tier badge in the navbar
│   │   ├── QuestPanel.tsx             Quest list and wallet-link panel
│   │   ├── QuestToast.tsx             "Quest completed" notification
│   │   └── WalletConnect.tsx          Connects Sphere Wallet to link quest progress
│   ├── config/
│   │   ├── coins.ts                   Supported assets (UCT, USDU, USDC, SOL, ETH, BTC)
│   │   └── quests.ts                  Quest catalog, point values, and tiers
│   ├── context/
│   │   └── QuestsContext.tsx          App-wide quest/points state
│   ├── hooks/
│   │   ├── useQuests.ts               Supabase-backed quest state, wallet linking
│   │   └── useTheme.ts                Theme state and localStorage persistence
│   ├── lib/
│   │   ├── supabaseClient.ts          Supabase client singleton
│   │   ├── sphereConnect.ts           Sphere iframe transport, ConnectClient factory
│   │   └── sessionHandoff.ts          Carries the Supabase session across iframe storage partitions
│   ├── services/
│   │   └── coingeckoService.ts        Live USD price lookup via CoinGecko
│   └── pages/
│       ├── LandingPage.tsx            Public landing page
│       ├── GeneratorPage.tsx          Switches between dashboard menu / Express / Bulk views
│       ├── PayPage.tsx                Payment execution page, opened via a generated link
│       └── generator/
│           ├── DashboardMenu.tsx      Choose Express Request or Bulk Request
│           ├── ExpressRequestView.tsx Single payment link + QR generator
│           ├── BulkRequestView.tsx    Batch payment link generator
│           ├── csvUtils.ts            Parsing, validation, CSV template/export helpers
│           └── types.ts               Shared types for bulk rows and validation
├── supabase/
│   └── migrations/
│       ├── 0001_points_system.sql     Quests, profiles, completions, RLS, RPCs
│       ├── 0002_wallet_link.sql       Wallet-linked profiles and merge logic
│       └── 0003_share_quest.sql       Share-related quest support
├── index.html
├── package.json
├── tsconfig.json
├── vercel.json                        SPA rewrites; frame-ancestors allowed so Sphere can embed the app
└── vite.config.ts
```

## Setup & Run

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment variables

Create a `.env` file (already gitignored) with your Supabase project's URL and anon key:

```bash
VITE_SUPABASE_URL=your-project-url
VITE_SUPABASE_ANON_KEY=your-anon-key
```

Anonymous sign-in must be enabled in the Supabase dashboard under **Authentication → Sign In / Providers → Anonymous Sign-Ins**. Apply the SQL files in `supabase/migrations/` in order (via the SQL Editor or `supabase db push`) before running the app — see `MIGRATION_NOTES.md` for details on what each migration adds.

### 3. Run the development server

```bash
npm run dev
```

Open `http://localhost:5173` in your browser.

### 4. Build

```bash
npm run build
```

## Deployment

The app deploys as a static SPA (`vercel.json` handles client-side routing rewrites). Because Sphere Wallet loads it inside an iframe via its agent URL, response headers explicitly allow framing (`X-Frame-Options: ALLOWALL`, `Content-Security-Policy: frame-ancestors *`).

## How to Test

1. Open Sphere Wallet at `https://sphere.unicity.network`
2. Create a wallet and save the recovery phrase
3. Claim a nametag (e.g. `@testalice`)
4. Request test tokens from the Unicity Testnet2 faucet
5. Create a payment link in this app
6. Open the link — if not already inside Sphere, use the "Open in Sphere Wallet" button
7. Click **Pay** and confirm the transaction in the Sphere popup

## Future Development Ideas

- Transaction history on the receiver's page
- AI agent integration
- Asynchronous/background processing for very large Bulk Request batches
- Additional quest types and leaderboard support

---

Built with React, Vite, TypeScript, `@unicitylabs/sphere-sdk`, and Supabase.