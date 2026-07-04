import { Check, Loader2, Wallet } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useQuestsContext } from '../context/QuestsContext'
import { sphereAgentUrl } from '../lib/sphereConnect'
import { withHandoff } from '../lib/sessionHandoff'

/**
 * Lets the user connect Sphere Wallet (same iframe postMessage flow as
 * PayPage) so their quest progress is tied to a wallet identity instead of
 * just this browser. Lives inside QuestPanel, right below the quest list.
 */
export default function WalletConnect() {
  const { walletAddress, walletStatus, walletError, connectWallet, canConnectWallet } = useQuestsContext()

  const isBusy = walletStatus === 'connecting' || walletStatus === 'linking'

  // Plain link by default so it's clickable immediately; upgraded in-place
  // (usually within a tick) to a link carrying this session's tokens, so
  // the points earned in *this* tab actually follow into the Sphere iframe
  // instead of starting from a fresh, empty anonymous user there. See
  // sessionHandoff.ts for why this hand-carry is necessary at all.
  const [openInSphereUrl, setOpenInSphereUrl] = useState(() => sphereAgentUrl(window.location.href))

  useEffect(() => {
    if (canConnectWallet) return // already inside Sphere, this link isn't shown
    let cancelled = false
    withHandoff(window.location.href).then((urlWithSession) => {
      if (!cancelled) setOpenInSphereUrl(sphereAgentUrl(urlWithSession))
    })
    return () => {
      cancelled = true
    }
  }, [canConnectWallet])

  if (walletStatus === 'linked' && walletAddress) {
    return (
      <div className="wallet-connect wallet-connect-linked">
        <span className="wallet-connect-icon wallet-connect-icon-done">
          <Check size={14} strokeWidth={2.5} />
        </span>
        <span className="wallet-connect-text">
          Progress synced to <strong>@{walletAddress}</strong>
        </span>
      </div>
    )
  }

  if (canConnectWallet) {
    return (
      <div className="wallet-connect">
        <button type="button" className="wallet-connect-btn" onClick={connectWallet} disabled={isBusy}>
          {isBusy ? <Loader2 size={14} className="wallet-connect-spin" /> : <Wallet size={14} />}
          {walletStatus === 'connecting' && 'Connecting…'}
          {walletStatus === 'linking' && 'Saving progress…'}
          {(walletStatus === 'idle' || walletStatus === 'error') && 'Connect Wallet to save progress'}
        </button>
        {walletStatus === 'error' && walletError && <p className="wallet-connect-error">{walletError}</p>}
      </div>
    )
  }

  // Not inside Sphere's iframe — same fallback PayPage uses for payments:
  // point the user at the Sphere agent URL, which reopens this page inside
  // Sphere so the iframe connect flow above becomes available.
  return (
    <div className="wallet-connect">
      <a href={openInSphereUrl} target="_blank" rel="noreferrer" className="wallet-connect-btn wallet-connect-link">
        <Wallet size={14} />
        Open in Sphere Wallet to save progress
      </a>
    </div>
  )
}
