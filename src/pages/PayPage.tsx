import { useState, useEffect } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import {
  ConnectClient,
  SPHERE_NETWORKS,
  type ConnectTransport,
  type SphereConnectMessage,
  isSphereConnectMessage,
} from '@unicitylabs/sphere-sdk/connect'
import { COINS } from '../config/coins'
import { getCoinPrice } from '../services/coingeckoService'

const SPHERE_ORIGIN = 'https://sphere.unicity.network'
const SPHERE_AGENT_BASE = `${SPHERE_ORIGIN}/agents/custom`

interface SphereAsset {
  coinId: string
  symbol?: string
  decimals?: number
}

type PayStatus = 'idle' | 'connecting' | 'querying' | 'sending' | 'success' | 'error'

function createIframeTransport(): ConnectTransport {
  return {
    send(msg: SphereConnectMessage) {
      window.parent.postMessage(msg, '*')
    },
    onMessage(handler: (msg: SphereConnectMessage) => void) {
      const fn = (e: MessageEvent) => {
        const fromParent = e.source === window.parent || e.source === window.top
        if (fromParent && isSphereConnectMessage(e.data)) handler(e.data)
      }
      window.addEventListener('message', fn)
      return () => window.removeEventListener('message', fn)
    },
    destroy() {},
  }
}

async function getAssetInfo(client: ConnectClient, symbol: string) {
  try {
    const result = await client.query<SphereAsset[] | { assets: SphereAsset[] }>('sphere_getAssets')
    const assets: SphereAsset[] = Array.isArray(result)
      ? result
      : (result as { assets: SphereAsset[] }).assets ?? []
    const match = assets.find((a) => a.symbol?.toUpperCase() === symbol.toUpperCase())
    if (match?.coinId) {
      return { coinId: match.coinId, decimals: match.decimals ?? 8 }
    }
  } catch {
    /* fallback */
  }
  return {
    coinId: Array.from(new TextEncoder().encode(symbol))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join(''),
    decimals: 8,
  }
}

function toBaseUnitsString(amountStr: string, decimals: number) {
  const cleaned = (amountStr ?? '').trim()
  if (!cleaned) return '0'

  const parts = cleaned.split('.')
  const intPart = parts[0] || '0'
  const fracPart = parts[1] || ''

  if (decimals === 0) return BigInt(intPart).toString()

  const fracNormalized = (fracPart + '0'.repeat(decimals)).slice(0, decimals)

  const intBig = BigInt(intPart || '0')
  const fracBig = BigInt(fracNormalized || '0')
  const base = intBig * (10n ** BigInt(decimals)) + fracBig
  return base.toString()
}

export default function PayPage() {
  const [searchParams] = useSearchParams()
  const to = searchParams.get('to') ?? ''
  const amount = searchParams.get('amount') ?? '0'
  const coin = searchParams.get('coin') ?? 'UCT'
  const note = searchParams.get('note') ?? ''

  const [status, setStatus] = useState<PayStatus>('idle')
  const [errorMsg, setErrorMsg] = useState('')
  const [txInfo, setTxInfo] = useState('')
  const [coinPrice, setCoinPrice] = useState<number | null>(null)

  const isValidLink = to.length > 0 && parseFloat(amount) > 0
  const displayAmount = parseFloat(amount).toLocaleString('en-US', { maximumFractionDigits: 8 })
  const isInsideSphere = window !== window.parent
  const sphereAgentUrl = `${SPHERE_AGENT_BASE}?url=${encodeURIComponent(window.location.href)}`
  const selectedCoin = COINS[coin]

  useEffect(() => {
    const fetchPrice = async () => {
      try {
        const price = await getCoinPrice(coin)
        setCoinPrice(price)
      } catch (error) {
        console.error('Price fetch error:', error)
      }
    }

    if (isValidLink) {
      fetchPrice()
    }
  }, [coin, isValidLink])

  const handlePay = async () => {
    if (!isInsideSphere) return
    setStatus('connecting')
    setErrorMsg('')

    try {
      const client = new ConnectClient({
        transport: createIframeTransport(),
        dapp: {
          name: 'UCT Pay Link',
          description: 'Payment via Unicity payment link',
          url: window.location.origin,
        },
        network: SPHERE_NETWORKS.testnet2,
      })

      await client.connect()

      setStatus('querying')
      const asset = await getAssetInfo(client, coin)

      setStatus('sending')
      const decimals = asset.decimals ?? 8
      const amountBase = toBaseUnitsString(amount, decimals)

      const result = await client.intent('send', {
        to: `@${to}`,
        coinId: asset.coinId,
        amount: amountBase,
      })

      setTxInfo(JSON.stringify(result, null, 2))
      setStatus('success')
    } catch (err: unknown) {
      setStatus('error')
      const msg = err instanceof Error ? err.message : String(err)
      if (msg.match(/reject|cancel|denied/i)) setErrorMsg('Transaction cancelled.')
      else if (msg.match(/insufficient|balance/i)) setErrorMsg('Insufficient ' + coin + ' balance.')
      else if (msg.match(/network|mismatch/i)) setErrorMsg('Wrong network — switch to Unicity Testnet2.')
      else setErrorMsg(msg)
    }
  }

  const getButtonText = () => {
    if (status === 'connecting') return 'Connecting to Sphere...'
    if (status === 'querying') return 'Resolving token...'
    if (status === 'sending') return 'Sending transaction...'
    return `Pay ${displayAmount} ${coin}`
  }

  const isLoading = ['connecting', 'querying', 'sending'].includes(status)

  if (!isValidLink) {
    return (
      <div className="pay-container">
        <div className="pay-card">
          <h2 className="pay-title">Invalid Link</h2>
          <p className="pay-subtitle">Required parameters are missing.</p>
          <Link to="/" className="btn btn-primary" style={{ textDecoration: 'none' }}>
            Create a new payment link
          </Link>
        </div>
      </div>
    )
  }

  if (status === 'success') {
    return (
      <div className="pay-container">
        <div className="pay-card pay-card-success">
          <div className="success-icon">✓</div>
          <h2 className="pay-title">Payment Successful</h2>
          <p className="pay-subtitle">
            {displayAmount} {coin} sent to @{to}
          </p>

          {txInfo && (
            <div className="tx-details">
              <details>
                <summary className="tx-summary">View transaction details</summary>
                <pre className="tx-info">{txInfo}</pre>
              </details>
            </div>
          )}

          <Link to="/" className="btn btn-primary" style={{ textDecoration: 'none', marginTop: '1.5rem' }}>
            Create a new payment link
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="pay-container">
      <div className="pay-card">
        <h2 className="pay-title">Confirm Payment</h2>
        <p className="pay-subtitle">Send {coin} via Sphere Wallet</p>

        {/* Amount Display */}
        <div className="amount-display">
          {selectedCoin?.logo && <img src={selectedCoin.logo} alt={coin} className="amount-logo" />}
          <div className="amount-content">
            <span className="amount-value">{displayAmount}</span>
            <span className="amount-symbol">{coin}</span>
          </div>
        </div>

        {coinPrice && coinPrice > 0 && (
          <p className="amount-usd">
            ≈ ${(parseFloat(amount) * coinPrice).toLocaleString('en-US', { maximumFractionDigits: 2 })} USD
          </p>
        )}

        {/* Payment Details */}
        <div className="payment-details">
          <div className="detail-item">
            <span className="detail-label">Recipient</span>
            <span className="detail-value">@{to}</span>
          </div>
          <div className="detail-item">
            <span className="detail-label">Amount</span>
            <span className="detail-value">{displayAmount} {coin}</span>
          </div>
          {coinPrice && (
            <div className="detail-item">
              <span className="detail-label">Price per {coin}</span>
              <span className="detail-value">${coinPrice.toLocaleString('en-US', { maximumFractionDigits: 8 })}</span>
            </div>
          )}
          {note && (
            <div className="detail-item">
              <span className="detail-label">Note</span>
              <span className="detail-value detail-note">"{note}"</span>
            </div>
          )}
          <div className="detail-item">
            <span className="detail-label">Network</span>
            <span className="detail-value"><span className="network-badge">UCT Mainnet</span></span>
          </div>
        </div>

        {/* Status Steps */}
        {isLoading && (
          <div className="status-steps">
            <div className={`status-step ${status === 'connecting' ? 'active' : ['querying', 'sending'].includes(status) ? 'done' : ''}`}>
              <div className="step-dot"></div>
              <span>Connecting to Sphere Wallet</span>
            </div>
            <div className={`status-step ${status === 'querying' ? 'active' : status === 'sending' ? 'done' : ''}`}>
              <div className="step-dot"></div>
              <span>Resolving {coin} token</span>
            </div>
            <div className={`status-step ${status === 'sending' ? 'active' : ''}`}>
              <div className="step-dot"></div>
              <span>Sending to Unicity Network</span>
            </div>
          </div>
        )}

        {/* Error Alert */}
        {status === 'error' && (
          <div className="alert alert-error">
            <strong>Failed:</strong> {errorMsg}
          </div>
        )}

        {/* Action Buttons */}
        {isInsideSphere && (
          <button className="btn btn-primary btn-pay" onClick={handlePay} disabled={isLoading}>
            {getButtonText()}
          </button>
        )}

        {!isInsideSphere && (
          <>
            <div className="alert alert-warning">
              <strong>Open this link in Sphere Wallet to pay.</strong> Click below — Sphere will load this payment page.
            </div>
            <a href={sphereAgentUrl} target="_blank" rel="noreferrer" className="btn btn-primary">
              Open in Sphere Wallet
            </a>
            <div className="sphere-link-section">
              <p className="sphere-link-label">Or copy Sphere link manually:</p>
              <div className="copy-box">
                <span className="copy-text">{sphereAgentUrl}</span>
                <button className="copy-btn" onClick={() => navigator.clipboard.writeText(sphereAgentUrl)}>
                  Copy
                </button>
              </div>
            </div>
          </>
        )}

        <Link to="/" className="btn btn-secondary">
          ← Back
        </Link>
      </div>
    </div>
  )
}
