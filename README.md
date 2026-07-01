# UCT Pay Link

Payment link and QR code generator for the Unicity Network ecosystem.

## What is this?

A simple web application that enables anyone to:
- **Create payment links** like `https://app-you.com/pay?to=alice&amount=1000000&coin=UCT`
- **Generate QR codes** from those links — can be scanned directly
- **Pay** via Sphere Wallet Extension with just one click

---

## How it Works

```
[Generator Form]          [Payment Link]            [Pay Page]
  Enter nametag      →   ?to=alice&amount=          →   Connect to
  Enter amount           1000000&coin=UCT               Sphere Wallet
  Click Generate         (can be shared)                Click "Pay"
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
│   ├── App.tsx              ← Router & navbar
│   ├── App.css              ← All styling
│   ├── main.tsx             ← Entry point
│   └── pages/
│       ├── GeneratorPage.tsx  ← Form to create payment link + QR code
│       └── PayPage.tsx        ← Payment page (opened via link)
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

1. Install **Sphere Wallet Extension** in Chrome
2. Create a new wallet → save recovery phrase
3. Claim a nametag (e.g., `@testalice`)
4. Request test tokens from the faucet on Sphere testnet
5. Create a payment link in this app
6. Open the link in a new tab
7. Click "Pay" → Sphere Wallet will show confirmation popup

---

## Future Development Ideas

- [ ] Transaction history on receiver's page
- [ ] Multi-coin support (UCT + other tokens)
- [ ] Direct sharing to WhatsApp / Telegram
- [ ] Dark mode

---

Built with React + Vite + TypeScript + @unicitylabs/sphere-sdk
