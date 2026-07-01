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
  const [priceError, setPriceError] = useState('')

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
        setPriceError('')
      } catch (error) {
        setPriceError('Failed to fetch price')
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
      if (msg.match(/reject|cancel|denied/i)) setErrorMsg('Transaction cancelled.')\n      else if (msg.match(/insufficient|balance/i)) setErrorMsg('Insufficient ' + coin + ' balance.')\n      else if (msg.match(/network|mismatch/i)) setErrorMsg('Wrong network — switch to Unicity Testnet2.')\n      else setErrorMsg(msg)\n    }\n  }\n\n  const getButtonText = () => {\n    if (status === 'connecting') return 'Connecting to Sphere...'\n    if (status === 'querying') return 'Resolving token...'\n    if (status === 'sending') return 'Sending transaction...'\n    return `Pay ${displayAmount} ${coin}`\n  }\n\n  const isLoading = ['connecting', 'querying', 'sending'].includes(status)\n\n  if (!isValidLink) {\n    return (\n      <div className=\"pay-container\">\n        <div className=\"pay-card\">\n          <h2 className=\"pay-title\">Invalid Link</h2>\n          <p className=\"pay-subtitle\">Required parameters are missing.</p>\n          <Link to=\"/\" className=\"btn btn-primary\" style={{ textDecoration: 'none' }}>\n            Create a new payment link\n          </Link>\n        </div>\n      </div>\n    )\n  }\n\n  if (status === 'success') {\n    return (\n      <div className=\"pay-container\">\n        <div className=\"pay-card pay-card-success\">\n          <div className=\"success-icon\">✓</div>\n          <h2 className=\"pay-title\">Payment Successful</h2>\n          <p className=\"pay-subtitle\">\\n            {displayAmount} {coin} sent to @{to}\n          </p>\n          \n          {txInfo && (\n            <div className=\"tx-details\">\n              <details>\n                <summary className=\"tx-summary\">View transaction details</summary>\n                <pre className=\"tx-info\">{txInfo}</pre>\n              </details>\n            </div>\n          )}\n          \n          <Link to=\"/\" className=\"btn btn-primary\" style={{ textDecoration: 'none', marginTop: '1.5rem' }}>\n            Create a new payment link\n          </Link>\n        </div>\n      </div>\n    )\n  }\n\n  return (\n    <div className=\"pay-container\">\n      <div className=\"pay-card\">\n        <h2 className=\"pay-title\">Confirm Payment</h2>\n        <p className=\"pay-subtitle\">Send {coin} via Sphere Wallet</p>\n\n        {/* Amount Display */}\n        <div className=\"amount-display\">\n          {selectedCoin?.logo && (\n            <img src={selectedCoin.logo} alt={coin} className=\"amount-logo\" />\n          )}\n          <div className=\"amount-content\">\n            <span className=\"amount-value\">{displayAmount}</span>\n            <span className=\"amount-symbol\">{coin}</span>\n          </div>\n        </div>\n\n        {coinPrice && coinPrice > 0 && (\n          <p className=\"amount-usd\">\n            ≈ ${(parseFloat(amount) * coinPrice).toLocaleString('en-US', { maximumFractionDigits: 2 })} USD\n          </p>\n        )}\n\n        {/* Payment Details */}\n        <div className=\"payment-details\">\n          <div className=\"detail-item\">\n            <span className=\"detail-label\">Recipient</span>\n            <span className=\"detail-value\">@{to}</span>\n          </div>\n          <div className=\"detail-item\">\n            <span className=\"detail-label\">Amount</span>\n            <span className=\"detail-value\">{displayAmount} {coin}</span>\n          </div>\n          {coinPrice && (\n            <div className=\"detail-item\">\n              <span className=\"detail-label\">Price per {coin}</span>\n              <span className=\"detail-value\">${coinPrice.toLocaleString('en-US', { maximumFractionDigits: 8 })}</span>\n            </div>\n          )}\n          {note && (\n            <div className=\"detail-item\">\n              <span className=\"detail-label\">Note</span>\n              <span className=\"detail-value detail-note\">\"{note}\"</span>\n            </div>\n          )}\n          <div className=\"detail-item\">\n            <span className=\"detail-label\">Network</span>\n            <span className=\"detail-value\"><span className=\"network-badge\">UCT Mainnet</span></span>\n          </div>\n        </div>\n\n        {/* Status Steps */}\n        {isLoading && (\n          <div className=\"status-steps\">\n            <div className={`status-step ${status === 'connecting' ? 'active' : ['querying', 'sending'].includes(status) ? 'done' : ''}`}>\n              <div className=\"step-dot\"></div>\n              <span>Connecting to Sphere Wallet</span>\n            </div>\n            <div className={`status-step ${status === 'querying' ? 'active' : status === 'sending' ? 'done' : ''}`}>\n              <div className=\"step-dot\"></div>\n              <span>Resolving {coin} token</span>\n            </div>\n            <div className={`status-step ${status === 'sending' ? 'active' : ''}`}>\n              <div className=\"step-dot\"></div>\n              <span>Sending to Unicity Network</span>\n            </div>\n          </div>\n        )}\n\n        {/* Error Alert */}\n        {status === 'error' && (\n          <div className=\"alert alert-error\">\n            <strong>Failed:</strong> {errorMsg}\n          </div>\n        )}\n\n        {/* Action Buttons */}\n        {isInsideSphere && (\n          <button className=\"btn btn-primary btn-pay\" onClick={handlePay} disabled={isLoading}>\n            {getButtonText()}\n          </button>\n        )}\n\n        {!isInsideSphere && (\n          <>\n            <div className=\"alert alert-warning\">\n              <strong>Open this link in Sphere Wallet to pay.</strong> Click below — Sphere will load this payment page.\n            </div>\n            <a href={sphereAgentUrl} target=\"_blank\" rel=\"noreferrer\" className=\"btn btn-primary\">\n              Open in Sphere Wallet\n            </a>\n            <div className=\"sphere-link-section\">\n              <p className=\"sphere-link-label\">Or copy Sphere link manually:</p>\n              <div className=\"copy-box\">\n                <span className=\"copy-text\">{sphereAgentUrl}</span>\n                <button className=\"copy-btn\" onClick={() => navigator.clipboard.writeText(sphereAgentUrl)}>\n                  Copy\n                </button>\n              </div>\n            </div>\n          </>\n        )}\n\n        <Link to=\"/\" className=\"btn btn-secondary\">\n          ← Back\n        </Link>\n      </div>\n    </div>\n  )\n}\n