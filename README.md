# UCT Pay Link

Payment link and QR code generator for the Unicity Network ecosystem.

## What is this?

A web application that enables anyone to:
- **Create payment links** like `https://app-you.com/pay?to=alice&amount=1000000&coin=UCT`
- **Generate QR codes** from those links — can be scanned directly
- **Pay** via Sphere Wallet with just one click
- Choose between two request modes — **Express Request** (single link) or **Bulk Request** (mass generation) — from a dashboard menu
- Switch between **Light Mode** and **Night Mode**, with the preference remembered on return visits

---

## Request Modes

After opening `/app`, you land on a dashboard menu where you pick one of two flows:

### ⚡ Express Request
For a single, instant payment link to one client:
1. Enter the recipient's nametag (`@user`)
2. Enter the amount and pick an asset (UCT, USDU, USDC, SOL, ETH, BTC)
   - Live USD price per asset is fetched from CoinGecko and shown next to the amount
3. Add an optional note/message
4. Click **Generate Payment Link** → get a shareable link + QR code, ready to copy

### 🗂️ Bulk Request
For generating dozens to thousands of payment links at once:
1. **Step 1 — Prepare data**: download the CSV template, fill it in Excel/Google Sheets, then paste the rows into the textarea (spreadsheet TAB-paste or comma-separated values are both supported) — columns are `ID User, Amount, Asset, Note`
2. **Check Row Data**: each row is validated (nametag present, amount > 0, asset is one of the supported coins); valid/invalid counts are shown, and invalid rows are flagged with the reason
3. **Generate All Billing Links**: once every row is valid, generate a payment link + QR-ready URL for every row in one click
4. **Download Final Result (.csv)**: export the full result (including generated links) back out as CSV

---

## Light Mode & Night Mode

The app supports both a light and a dark ("Night Mode") theme:
- Toggle via the sun/moon icon in the navbar (`ThemeToggle` component)
- On first load, the theme follows the browser/OS preference (`prefers-color-scheme`)
- After that, your choice is saved to `localStorage` and restored on every visit
- Implemented by toggling a `dark` class on `<html>`, so all styling in `App.css` reacts via CSS variables

---

## How it Works

```
[Dashboard Menu]           [Generator Form]           [Payment Link]             [Pay Page]
  Choose Express       →   Express: 1 recipient   →   ?to=alice&amount=      →   Connect to
  or Bulk Request           Bulk: paste many rows       1000000&coin=UCT          Sphere Wallet
                             Click Generate               (can be shared)         Click "Pay"
                                                                                   Transaction OK
```

---

## Setup & Run

### 1. Install dependencies

```bash
npm install
```

### 2. Run development server

```bash
npm run dev
```

Open `http://localhost:5173` in your browser.

---

## Project Structure

```
uct-pay-link/
├── src/
│   ├── App.tsx                        ← Router, navbar & ThemeToggle
│   ├── App.css                        ← All styling (incl. light/dark CSS variables)
│   ├── main.tsx                       ← Entry point
│   ├── components/
│   │   ├── Footer.tsx                 ← Shared footer
│   │   └── ThemeToggle.tsx            ← Light/Night Mode switch button
│   ├── hooks/
│   │   └── useTheme.ts                ← Theme state, localStorage persistence
│   ├── config/
│   │   └── coins.ts                   ← Supported assets (UCT, USDU, USDC, SOL, ETH, BTC)
│   ├── services/
│   │   └── coingeckoService.ts        ← Live USD price lookup via CoinGecko API
│   └── pages/
│       ├── LandingPage.tsx            ← Public landing page
│       ├── GeneratorPage.tsx          ← Entry point: switches between menu / express / bulk
│       ├── PayPage.tsx                ← Payment page (opened via link)
│       └── generator/
│           ├── DashboardMenu.tsx      ← Choose Express Request or Bulk Request
│           ├── ExpressRequestView.tsx ← Single payment link + QR generator
│           ├── BulkRequestView.tsx    ← Mass payment link generator (CSV/paste)
│           ├── csvUtils.ts            ← Parsing, validation, CSV template/export helpers
│           └── types.ts               ← Shared types for bulk rows & validation
├── index.html
├── package.json
├── tsconfig.json
└── vite.config.ts
```

---

## Sphere SDK API Used

### ConnectClient (from `@unicitylabs/sphere-sdk/connect`)

```typescript
// Create a "bridge" between our dApp and Sphere Wallet Extension
const client = new ConnectClient({
  transport: ExtensionTransport.forClient(),
  dapp: { name: 'UCT Pay Link', description: '...', url: location.origin },
})

// Connect to wallet (shows approval popup)
const { identity } = await client.connect()

// Send payment intent to wallet
await client.intent('send', {
  recipient: '@alice',   // receiver nametag
  amount: 1000000,       // base units (1 UCT = 1,000,000)
  coinId: 'UCT',         // token type
})
```

### Payment Link URL Format

```
/pay?to=NAMETAG&amount=BASE_UNITS&coin=TOKEN_ID&note=MESSAGE
```

| Parameter | Required | Description |
|-----------|----------|-------------|
| `to`      | Yes      | Receiver nametag (without @) |
| `amount`  | Yes      | Amount in base units |
| `coin`    | Yes      | Token ID (UCT, etc.) |
| `note`    | No       | Optional message |

---

## How to Test

1. Open **Sphere Wallet** https://sphere.unicity.network/
2. Create a new wallet → save recovery phrase
3. Claim a nametag (e.g., `@testalice`)
4. Request test tokens from the faucet on Unicity testnet
5. Create a payment link in this app
6. Open the link in a new tab
7. Click "Pay" → Sphere Wallet will show confirmation popup

---

## Future Development Ideas

- [ ] Transaction history on receiver's page
- [ ] Direct sharing to WhatsApp / Telegram
- [ ] AI Agent integration
- [ ] Bulk Request: async/background processing for very large CSV batches

---

Built with React + Vite + TypeScript + @unicitylabs/sphere-sdk
