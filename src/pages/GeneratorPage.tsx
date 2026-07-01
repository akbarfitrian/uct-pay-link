import { useState, useEffect } from 'react'
import { QRCodeSVG } from 'qrcode.react'
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
  const [prices, setPrices] = useState<Record<string, CoinPrice>>({})

  // Fetch prices on component mount
  useEffect(() => {
    const fetchPrices = async () => {
      const coinIds = SUPPORTED_COINS.map((c) => c.id)
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
    <div className="generator-container">
      {/* Left side - Form */}
      <div className="form-section">
        <h1 className="form-title">Request Payment</h1>

        <div className="form-group">
          <label className="form-label">Recipient (User ID)</label>
          <input
            className="form-input"
            type="text"
            placeholder="@"
            value={nametag}
            onChange={(e) => setNametag(e.target.value)}
          />
        </div>

        <div className="form-group">
          <label className="form-label">Asset and Amount</label>
          <div className="amount-row">
            <div className="amount-col">
              <label className="form-label-small">Amount</label>
              <input
                className="form-input"
                type="number"
                min="0"
                step="0.000001"
                placeholder="1.0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>
            <div className="amount-col">
              <label className="form-label-small">Asset</label>
              <select className="form-select" value={coin} onChange={(e) => setCoin(e.target.value)}>
                {SUPPORTED_COINS.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.id}
                  </option>
                ))}
              </select>
            </div>
          </div>
          {selectedCoin?.logo && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.5rem' }}>
              <img
                src={selectedCoin.logo}
                alt={coin}
                style={{ width: '20px', height: '20px', borderRadius: '50%' }}
              />
              {prices[coin] && (
                <p className="form-hint" style={{ margin: 0 }}>
                  {prices[coin].loading ? (
                    <span>Loading price...</span>
                  ) : prices[coin].error ? (
                    <span>Price unavailable</span>
                  ) : (
                    `$${currentPrice.toLocaleString('en-US', { maximumFractionDigits: 8, minimumFractionDigits: 2 })} per ${coin}${usdValue > 0 ? ` ≈ $${usdValue.toLocaleString('en-US', { maximumFractionDigits: 2 })} USD` : ''}`
                  )}
                </p>
              )}
            </div>
          )}
        </div>

        <div className="form-group">
          <label className="form-label">
            Note / Message <span style={{ color: 'var(--text-hint)' }}>(optional)</span>
          </label>
          <textarea
            className="form-textarea"
            placeholder=""
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>

        <button className="btn btn-primary" onClick={handleGenerate} disabled={!isValid}>
          Generate
        </button>
      </div>

      {/* Right side - Preview */}
      {payLink && (
        <div className="preview-section">
          <div className="preview-card">
            <div className="preview-header">
              <span className="preview-title">Payment Link</span>
              <span className="counter">1003</span>
            </div>

            <div className="preview-link-box">
              <span className="preview-link-text">{payLink}</span>
            </div>

            <div className="qr-area">
              <p className="qr-label">QR Code</p>
              <QRCodeSVG value={payLink} size={160} level="M" includeMargin={true} />
              <p style={{ fontSize: '0.75rem', color: 'var(--text-hint)', marginTop: '0.5rem' }}>
                Scan with Sphere Wallet
              </p>
            </div>

            <div className="preview-details">
              <div className="detail-row">
                <span className="detail-label">Amount</span>
                <span className="detail-value">{amount} {coin}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Recipient</span>
                <span className="detail-value">@{nametag.replace(/^@/, '')}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Network</span>
                <span className="detail-value"><span className="badge">Testnet Unicity V2</span></span>
              </div>
            </div>

            <button className="btn btn-copy" onClick={handleCopy}>
              {copied ? 'Copied' : 'Copy Link'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
