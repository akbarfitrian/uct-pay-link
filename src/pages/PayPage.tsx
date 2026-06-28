import { useState } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import {
  ConnectClient,
  SPHERE_NETWORKS,
  type ConnectTransport,
  type SphereConnectMessage,
  isSphereConnectMessage,
} from '@unicitylabs/sphere-sdk/connect'

const SPHERE_ORIGIN     = 'https://sphere.unicity.network'
const SPHERE_AGENT_BASE = `${SPHERE_ORIGIN}/agents/custom`

interface SphereAsset {
  coinId:    string
  symbol?:   string
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
    const match = assets.find(a => a.symbol?.toUpperCase() === symbol.toUpperCase())
    if (match?.coinId) {
      return { coinId: match.coinId, decimals: match.decimals ?? 16 }
    }
  } catch { /* fallback */ }
  return {
    coinId: Array.from(new TextEncoder().encode(symbol))
      .map(b => b.toString(16).padStart(2, '0')).join(''),
    decimals: 8
  }
}

export default function PayPage() {
  const [searchParams] = useSearchParams()
  const to     = searchParams.get('to')     ?? ''
  // amount sekarang human-readable langsung dari URL (e.g. "5" bukan "5000000")
  const amount = searchParams.get('amount') ?? '0'
  const coin   = searchParams.get('coin')   ?? 'UCT'
  const note   = searchParams.get('note')   ?? ''

  const [status,    setStatus]    = useState<PayStatus>('idle')
  const [errorMsg,  setErrorMsg]  = useState('')
  const [txInfo,    setTxInfo]    = useState('')
  const [copied,    setCopied]    = useState<string | null>(null)
  const [hexCoinId, setHexCoinId] = useState('')

  const isValidLink    = to.length > 0 && parseFloat(amount) > 0
  const displayAmount  = parseFloat(amount).toLocaleString('en-US', { maximumFractionDigits: 8 })
  const isInsideSphere = window !== window.parent
  const sphereAgentUrl = `${SPHERE_AGENT_BASE}?url=${encodeURIComponent(window.location.href)}`

  const copyText = async (text: string, key: string) => {
    await navigator.clipboard.writeText(text)
    setCopied(key)
    setTimeout(() => setCopied(null), 2000)
  }

  const handlePay = async () => {
    if (!isInsideSphere) return
    setStatus('connecting')
    setErrorMsg('')
    setHexCoinId('')

    try {
      const client = new ConnectClient({
        transport: createIframeTransport(),
        dapp: {
          name:        'UCT Pay Link',
          description: 'Payment via Unicity payment link',
          url:         window.location.origin,
        },
        network: SPHERE_NETWORKS.testnet2,
      })

      await client.connect()

      setStatus('querying')
      const asset = await getAssetInfo(client, coin)
      setHexCoinId(asset.coinId)

      setStatus('sending')

      // Konversi dari human-readable ke base units
      const humanAmount = parseFloat(amount)
      const baseAmount = BigInt(Math.floor(humanAmount * Math.pow(10, asset.decimals)))

      const result = await client.intent('send', {
        to:     `@${to}`,
        coinId: asset.coinId,
        amount: baseAmount,  // ✅ Sekarang dalam base units
      })

      setTxInfo(JSON.stringify(result, null, 2))
      setStatus('success')

    } catch (err: unknown) {
      setStatus('error')
      const msg = err instanceof Error ? err.message : String(err)
      if (msg.match(/reject|cancel|denied/i))      setErrorMsg('Transaction cancelled.')
      else if (msg.match(/insufficient|balance/i)) setErrorMsg('Insufficient ' + coin + ' balance.')
      else if (msg.match(/network|mismatch/i))     setErrorMsg('Wrong network — switch to Unicity Testnet2.')
      else                                          setErrorMsg(msg)
    }
  }

  const getButtonText = () => {
    if (status === 'connecting') return '⏳ Connecting to Sphere...'
    if (status === 'querying')   return '⏳ Resolving token...'
    if (status === 'sending')    return '⏳ Sending transaction...'
    return `⚡ Pay ${displayAmount} ${coin}`
  }

  const isLoading = ['connecting', 'querying', 'sending'].includes(status)

  if (!isValidLink) {
    return (
      <div className="card text-center">
        <p style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🔗</p>
        <h2 className="card-title">Invalid link</h2>
        <p className="card-subtitle">Required parameters are missing.</p>
        <Link to="/" className="btn btn-primary" style={{ marginTop: '1rem', textDecoration: 'none' }}>
          Create a new payment link
        </Link>
      </div>
    )
  }

  if (status === 'success') {
    return (
      <div className="card text-center">
        <p style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>✅</p>
        <h2 className="card-title">Payment Successful!</h2>
        <p className="card-subtitle">{displayAmount} {coin} sent to @{to}</p>
        <div className="alert alert-success">Transaction confirmed on Unicity Network.</div>
        {txInfo && (
          <details style={{ marginTop: '1rem', textAlign: 'left' }}>
            <summary>🔍 Transaction response</summary>
            <pre style={{ fontSize: '0.75rem', background: 'var(--brown-deep)', padding: '0.75rem', borderRadius: '8px', overflow: 'auto', marginTop: '0.5rem', color: 'var(--orange-bright)' }}>
              {txInfo}
            </pre>
          </details>
        )}
        <Link to="/" className="btn btn-primary" style={{ marginTop: '1.5rem', textDecoration: 'none' }}>
          Create a new payment link
        </Link>
      </div>
    )
  }

  return (
    <div className="card">
      <h1 className="card-title">Confirm Payment</h1>
      <p className="card-subtitle">Send {coin} via Sphere Wallet</p>

      <div className="pay-amount-big">
        <span className="pay-amount-number">{displayAmount}</span>
        <span className="pay-amount-coin">{coin}</span>
      </div>

      <hr className="divider" />

      <div style={{ marginBottom: '1.25rem' }}>
        <div className="pay-detail-row">
          <span className="pay-detail-label">Recipient</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span className="pay-detail-value">@{to}</span>
            <button className="btn btn-outline" style={{ padding: '0.2rem 0.6rem', fontSize: '0.75rem' }}
              onClick={() => copyText(`@${to}`, 'to')}>
              {copied === 'to' ? '✅' : '📋'}
            </button>
          </div>
        </div>
        <div className="pay-detail-row">
          <span className="pay-detail-label">Amount</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span className="pay-detail-value">{displayAmount} {coin}</span>
            <button className="btn btn-outline" style={{ padding: '0.2rem 0.6rem', fontSize: '0.75rem' }}
              onClick={() => copyText(displayAmount, 'amount')}>
              {copied === 'amount' ? '✅' : '📋'}
            </button>
          </div>
        </div>
        {hexCoinId && (
          <div className="pay-detail-row">
            <span className="pay-detail-label">Token ID (hex)</span>
            <span className="pay-detail-value" style={{ fontFamily: 'monospace', fontSize: '0.78rem', color: 'var(--orange-bright)', wordBreak: 'break-all' }}>
              {hexCoinId}
            </span>
          </div>
        )}
        {note && (
          <div className="pay-detail-row">
            <span className="pay-detail-label">Note</span>
            <span className="pay-detail-value" style={{ fontStyle: 'italic' }}>"{note}"</span>
          </div>
        )}
        <div className="pay-detail-row">
          <span className="pay-detail-label">Network</span>
          <span className="pay-detail-value"><span className="badge badge-gray">Unicity Testnet2</span></span>
        </div>
      </div>

      {isLoading && (
        <div className="status-steps" style={{ marginBottom: '1rem' }}>
          <div className={`status-step ${status === 'connecting' ? 'active' : ['querying','sending'].includes(status) ? 'done' : ''}`}>
            <div className="step-dot" /> Connecting to Sphere Wallet
          </div>
          <div className={`status-step ${status === 'querying' ? 'active' : status === 'sending' ? 'done' : ''}`}>
            <div className="step-dot" /> Resolving {coin} token
          </div>
          <div className={`status-step ${status === 'sending' ? 'active' : ''}`}>
            <div className="step-dot" /> Sending to Unicity Network
          </div>
        </div>
      )}

      {status === 'error' && (
        <div className="alert alert-error" style={{ marginBottom: '1rem' }}>
          <strong>Failed: </strong>{errorMsg}
        </div>
      )}

      {/* Di dalam Sphere → tombol Pay langsung */}
      {isInsideSphere && (
        <button className="btn btn-green" onClick={handlePay} disabled={isLoading} style={{ marginBottom: '0.75rem' }}>
          {getButtonText()}
        </button>
      )}

      {/* Di Chrome biasa → arahkan ke Sphere Agent */}
      {!isInsideSphere && (
        <div>
          <div className="alert alert-warning" style={{ marginBottom: '1rem' }}>
            <strong>Open this link in Sphere Wallet to pay.</strong><br />
            Click below — Sphere will load this payment page.
          </div>
          <a href={sphereAgentUrl} target="_blank" rel="noreferrer"
            className="btn btn-green"
            style={{ marginBottom: '0.75rem', textDecoration: 'none' }}>
            🌐 Open in Sphere Wallet
          </a>
          <div style={{ marginBottom: '0.75rem' }}>
            <p className="result-label">Or copy Sphere link manually</p>
            <div className="link-box">
              <span className="link-text" style={{ fontSize: '0.76rem' }}>{sphereAgentUrl}</span>
              <button className="btn btn-outline" style={{ padding: '0.35rem 0.8rem', fontSize: '0.78rem', flexShrink: 0 }}
                onClick={() => copyText(sphereAgentUrl, 'agentUrl')}>
                {copied === 'agentUrl' ? '✅' : '📋'}
              </button>
            </div>
          </div>
        </div>
      )}

      <Link to="/" className="btn btn-outline" style={{ textDecoration: 'none', display: 'block', textAlign: 'center' }}>
        ← Back
      </Link>
    </div>
  )
}
