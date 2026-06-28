/**
 * GeneratorPage.tsx
 *
 * PENTING: Amount disimpan sebagai HUMAN-READABLE di URL (bukan base units).
 * Contoh: user ketik 5 → URL: amount=5 (bukan 5000000)
 * Sphere wallet yang handle konversi ke base units secara internal.
 */

import { useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'

const SUPPORTED_COINS = [
  { id: 'UCT', label: 'UCT (Unicity)' },
]

export default function GeneratorPage() {
  const [nametag, setNametag] = useState('')
  const [amount,  setAmount]  = useState('')
  const [coin,    setCoin]    = useState('UCT')
  const [note,    setNote]    = useState('')
  const [payLink, setPayLink] = useState('')
  const [copied,  setCopied]  = useState(false)

  const isValid = nametag.trim().length > 0 && parseFloat(amount) > 0

  const handleGenerate = () => {
    const cleanTag = nametag.replace(/^@/, '').trim()

    // Simpan amount sebagai human-readable langsung (tidak dikonversi ke base units)
    // Sphere wallet yang akan handle konversi internal
    const params = new URLSearchParams({
      to:     cleanTag,
      amount: amount,   // "5" bukan "5000000"
      coin:   coin,
    })
    if (note.trim()) params.set('note', note.trim())

    setPayLink(`${window.location.origin}/pay?${params.toString()}`)
    setCopied(false)
  }

  const handleCopy = async () => {
    await navigator.clipboard.writeText(payLink)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="card">
      <h1 className="card-title">Create Payment Link</h1>
      <p className="card-subtitle">
        Generate a shareable link or QR code to receive UCT from anyone
      </p>

      <div className="form-group">
        <label className="form-label">Your nametag (recipient)</label>
        <input
          className="form-input"
          type="text"
          placeholder="@yournametag"
          value={nametag}
          onChange={(e) => setNametag(e.target.value)}
        />
        <p className="form-hint">Your Unicity ID registered in Sphere Wallet</p>
      </div>

      <div className="form-group">
        <label className="form-label">Amount</label>
        <div className="amount-row">
          <input
            className="form-input"
            type="number"
            min="0"
            step="0.00000001"
            placeholder="5.0"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
          <select
            className="form-select"
            value={coin}
            onChange={(e) => setCoin(e.target.value)}
          >
            {SUPPORTED_COINS.map((c) => (
              <option key={c.id} value={c.id}>{c.id}</option>
            ))}
          </select>
        </div>
        <p className="form-hint">Enter the amount in UCT (e.g. 5 for 5 UCT)</p>
      </div>

      <div className="form-group">
        <label className="form-label">
          Note / message <span style={{ color: 'var(--text-hint)' }}>(optional)</span>
        </label>
        <textarea
          className="form-textarea"
          placeholder="e.g. Payment for logo design, thank you!"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </div>

      <button className="btn btn-primary" onClick={handleGenerate} disabled={!isValid}>
        ⚡ Generate Link & QR Code
      </button>

      {payLink && (
        <div className="result-section">
          <hr className="divider" />

          <p className="result-label">Payment Link</p>
          <div className="link-box">
            <span className="link-text">{payLink}</span>
            <button
              className="btn btn-outline"
              onClick={handleCopy}
              style={{ padding: '0.35rem 0.8rem', fontSize: '0.82rem', flexShrink: 0 }}
            >
              {copied ? '✅ Copied!' : '📋 Copy'}
            </button>
          </div>

          <div className="qr-area">
            <p className="result-label" style={{ marginBottom: 0 }}>QR Code</p>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', textAlign: 'center' }}>
              Scan to pay {amount} {coin} to @{nametag.replace(/^@/, '')}
            </p>
            <QRCodeSVG value={payLink} size={200} level="M" includeMargin={true} />
            <p style={{ fontSize: '0.78rem', color: 'var(--text-hint)' }}>
              Share with anyone — no login required to open
            </p>
          </div>

          <div className="alert alert-info" style={{ marginTop: '1.25rem' }}>
            <strong>💡 How to pay:</strong><br />
            Open this link, then click "Open in Sphere Wallet" —
            Sphere will show the payment confirmation with the correct amount.
          </div>

          <details style={{ marginTop: '0.75rem' }}>
            <summary>🔍 View URL parameters</summary>
            <div style={{ marginTop: '0.6rem', fontFamily: 'monospace', fontSize: '0.8rem', background: 'var(--brown-deep)', padding: '0.75rem', borderRadius: '8px', lineHeight: 2 }}>
              <div><span style={{ color: 'var(--orange-bright)' }}>to</span> = @{nametag.replace(/^@/, '')}</div>
              <div><span style={{ color: 'var(--orange-bright)' }}>amount</span> = {amount} {coin} (human-readable)</div>
              <div><span style={{ color: 'var(--orange-bright)' }}>coin</span> = {coin}</div>
              {note && <div><span style={{ color: 'var(--orange-bright)' }}>note</span> = {note}</div>}
            </div>
          </details>
        </div>
      )}
    </div>
  )
}
