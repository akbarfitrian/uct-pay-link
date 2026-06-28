# ⚡ UCT Pay Link

Generator payment link & QR code untuk ekosistem Unicity Network.

## Apa ini?

App web sederhana yang memungkinkan siapapun:
- **Membuat link pembayaran** seperti `https://app-kamu.com/pay?to=alice&amount=1000000&coin=UCT`
- **Membuat QR code** dari link tersebut — bisa di-scan langsung
- **Membayar** via Sphere Wallet Extension hanya dengan satu klik

---

## Cara Kerja

```
[Generator Form]          [Payment Link]            [Pay Page]
  Isi nametag      →   ?to=alice&amount=          →   Connect ke
  Isi jumlah           1000000&coin=UCT               Sphere Wallet
  Klik Generate        (bisa dibagikan)               Klik "Bayar"
                                                       Transaksi ✅
```

---

## Setup & Jalankan

### 1. Install dependencies

```bash
npm install
```

### 2. Jalankan development server

```bash
npm run dev
```

Buka `http://localhost:5173` di browser.

---

## Struktur Proyek

```
uct-pay-link/
├── src/
│   ├── App.tsx              ← Router & navbar
│   ├── App.css              ← Semua styling
│   ├── main.tsx             ← Entry point
│   └── pages/
│       ├── GeneratorPage.tsx  ← Form buat payment link + QR code
│       └── PayPage.tsx        ← Halaman pembayaran (dibuka via link)
├── index.html
├── package.json
├── tsconfig.json
└── vite.config.ts
```

---

## API Sphere SDK yang Dipakai

### ConnectClient (dari `@unicitylabs/sphere-sdk/connect`)

```typescript
// Membuat "jembatan" antara dApp kita dan Sphere Wallet Extension
const client = new ConnectClient({
  transport: ExtensionTransport.forClient(),
  dapp: { name: 'UCT Pay Link', description: '...', url: location.origin },
})

// Connect ke wallet (muncul popup persetujuan)
const { identity } = await client.connect()

// Kirim intent pembayaran ke wallet
await client.intent('send', {
  recipient: '@alice',   // nametag penerima
  amount: 1000000,       // base units (1 UCT = 1,000,000)
  coinId: 'UCT',         // jenis token
})
```

### Format URL Payment Link

```
/pay?to=NAMETAG&amount=BASE_UNITS&coin=TOKEN_ID&note=PESAN
```

| Parameter | Wajib | Keterangan |
|-----------|-------|------------|
| `to`      | ✅    | Nametag penerima (tanpa @) |
| `amount`  | ✅    | Jumlah dalam base units |
| `coin`    | ✅    | ID token (UCT, dll) |
| `note`    | ❌    | Pesan opsional |

---

## Cara Test

1. Install **Sphere Wallet Extension** di Chrome
2. Buat wallet baru → catat recovery phrase
3. Klaim nametag (misal `@testalice`)
4. Minta test token dari faucet di Sphere testnet
5. Buat payment link di app ini
6. Buka link tersebut di tab baru
7. Klik "Bayar" → Sphere Wallet akan popup konfirmasi

---

## Ide Pengembangan Selanjutnya

- [ ] History transaksi di halaman penerima
- [ ] Multi-coin support (UCT + token lain)
- [ ] Share ke WhatsApp / Telegram langsung
- [ ] Dark mode
- [ ] Deploy ke Vercel / Netlify supaya bisa diakses online

---

Dibangun dengan React + Vite + TypeScript + @unicitylabs/sphere-sdk
