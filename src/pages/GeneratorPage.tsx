import { useState, useEffect } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { Zap, Copy, Check, Info, ChevronRight, Loader } from 'lucide-react'
import { SUPPORTED_COINS } from '../config/coins'
import { getAllPrices } from '../services/coingeckoService'

interface CoinPrice {
  price: number
  loading: boolean
  error: string | null
}

export default function GeneratorPage() {
  const [nametag, setNametag] = useState('')
  const [amount, setAmount] = useState('')
  const [coin, setCoin] = useState('UCT')
  const [note, setNote] = useState('')
  const [payLink, setPayLink] = useState('')
  const [copied, setCopied] = useState(false)
  const [detailsOpen, setDetailsOpen] = useState(false)
  const [prices, setPrices] = useState<Record<string, CoinPrice>>({})

  // Fetch prices on component mount
  useEffect(() => {
    const fetchPrices = async () => {
      const coinIds = SUPPORTED_COINS.map((c) => c.id)
      // Initialize loading state
      const loadingState: Record<string, CoinPrice> = {}
      for (const id of coinIds) {
        loadingState[id] = { price: 0, loading: true, error: null }
      }
      setPrices(loadingState)

      try {
        const fetchedPrices = await getAllPrices(coinIds)
        const newState: Record<string, CoinPrice> = {}
        for (const id of coinIds) {
          newState[id] = {
            price: fetchedPrices[id] || 0,
            loading: false,
            error: null,
          }
        }
        setPrices(newState)
      } catch (error) {
        const errorState: Record<string, CoinPrice> = {}
        for (const id of coinIds) {
          errorState[id] = {
            price: 0,
            loading: false,
            error: 'Failed to fetch price',
          }
        }
        setPrices(errorState)
      }
    }

    fetchPrices()
  }, [])

  const isValid = nametag.trim().length > 0 && parseFloat(amount) > 0
  const currentPrice = prices[coin]?.price || 0
  const usdValue = parseFloat(amount) * currentPrice

  const handleGenerate = () => {
    const cleanTag = nametag.replace(/^@/, '').trim()
    const params = new URLSearchParams({ to: cleanTag, amount, coin })
    if (note.trim()) params.set('note', note.trim())
    setPayLink(`${window.location.origin}/pay?${params.toString()}`)
    setCopied(false)
  }

  const handleCopy = async () => {
    await navigator.clipboard.writeText(payLink)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const selectedCoin = SUPPORTED_COINS.find((c) => c.id === coin)

  return (
    <div className="card">
      <h1 className="card-title">Create Payment Link</h1>
      <p className="card-subtitle">Generate a shareable link or QR code to receive crypto from anyone</p>

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
            step="0.000001"
            placeholder="1.0"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
          <select className="form-select" value={coin} onChange={(e) => setCoin(e.target.value)}>
            {SUPPORTED_COINS.map((c) => (
              <option key={c.id} value={c.id}>
                {c.id}
              </option>
            ))}
          </select>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.5rem' }}>
          {selectedCoin?.logo && (
            <img
              src={selectedCoin.logo}
              alt={coin}
              style={{ width: '20px', height: '20px', borderRadius: '50%' }}
            />
          )}
          {prices[coin] && (
            <p className="form-hint" style={{ margin: 0 }}>
              {prices[coin].loading ? (
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                  <Loader size={12} className="animate-spin" /> Loading price...
                </span>
              ) : prices[coin].error ? (
                <span style={{ color: 'var(--text-hint)' }}>Price unavailable</span>
              ) : (
                `$${currentPrice.toLocaleString('en-US', { maximumFractionDigits: 8, minimumFractionDigits: 2 })} per ${coin}${usdValue > 0 ? ` ≈ $${usdValue.toLocaleString('en-US', { maximumFractionDigits: 2 })}` : ''}`
              )}
            </p>
          )}
        </div>
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
        <Zap size={16} strokeWidth={2.5} />
        Generate Link &amp; QR Code
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
              {copied ? (
                <>
                  <Check size={14} /> Copied
                </>
              ) : (
                <>
                  <Copy size={14} /> Copy
                </>
              )}
            </button>
          </div>

          <div className="qr-area">
            <p className="result-label" style={{ marginBottom: 0 }}>
              QR Code
            </p>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', textAlign: 'center' }}>
              Scan with Sphere Wallet to pay {amount} {coin} to @{nametag.replace(/^@/, '')}
            </p>
            <QRCodeSVG value={payLink} size={200} level="M" includeMargin={true} />
            <p style={{ fontSize: '0.78rem', color: 'var(--text-hint)' }}>
              Share with anyone — no login required to open
            </p>
          </div>

          <div className="alert alert-info" style={{ marginTop: '1.25rem', display: 'flex', gap: '0.6rem', alignItems: 'flex-start' }}>
            <Info size={16} style={{ flexShrink: 0, marginTop: '0.15rem' }} />
            <span>
              <strong>How this link works:</strong> All payment info is stored in the URL. When someone opens the link, the pay page reads those parameters and shows a confirmation, then asks Sphere Wallet to execute the payment.
            </span>
          </div>

          <button
            onClick={() => setDetailsOpen(!detailsOpen)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.3rem',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              fontSize: '0.82rem',
              color: 'var(--text-hint)',
              padding: 0,
              marginTop: '0.75rem',
            }}
          >
            <ChevronRight size={14} style={{ transform: detailsOpen ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s' }} />
            View URL parameters
          </button>

          {detailsOpen && (
            <div
              style={{
                marginTop: '0.6rem',
                fontFamily: 'monospace',
                fontSize: '0.8rem',
                background: 'var(--bg-elevated)',
                padding: '0.75rem',
                borderRadius: '8px',
                lineHeight: 2,
              }}
            >
              <div>
                <span style={{ color: 'var(--indigo)' }}>to</span> = @{nametag.replace(/^@/, '')}
              </div>
              <div>
                <span style={{ color: 'var(--indigo)' }}>amount</span> = {amount} {coin}
              </div>
              <div>
                <span style={{ color: 'var(--indigo)' }}>coin</span> = {coin}
              </div>
              {currentPrice > 0 && (
                <div>
                  <span style={{ color: 'var(--indigo)' }}>price</span> = ${currentPrice.toLocaleString('en-US', { maximumFractionDigits: 8 })}
                </div>
              )}
              {note && (
                <div>
                  <span style={{ color: 'var(--indigo)' }}>note</span> = {note}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
