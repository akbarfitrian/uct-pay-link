import { Check, Loader2, Wallet } from 'lucide-react'
import { useQuestsContext } from '../context/QuestsContext'
import { isInsideSphere } from '../lib/sphereConnect'

/**
 * Lets the user connect Sphere Wallet so their quest progress is tied to a
 * wallet identity instead of just this browser. Lives inside QuestPanel,
 * right below the quest list.
 *
 * connectWallet() (see useQuests.ts) picks the right transport itself: the
 * iframe postMessage bridge when this page is embedded inside Sphere, or a
 * Sphere connect popup window (sphere.unicity.network/connect — the same
 * "Sign Message" approval dialog Sphere shows everywhere else) otherwise.
 */
export default function WalletConnect() {
  const { walletAddress, walletStatus, walletError, connectWallet } = useQuestsContext()

  const isBusy = walletStatus === 'connecting' || walletStatus === 'linking'

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

  return (
    <div className="wallet-connect">
      <button type="button" className="wallet-connect-btn" onClick={connectWallet} disabled={isBusy}>
        {isBusy ? <Loader2 size={14} className="wallet-connect-spin" /> : <Wallet size={14} />}
        {walletStatus === 'connecting' && 'Connecting…'}
        {walletStatus === 'linking' && 'Saving progress…'}
        {(walletStatus === 'idle' || walletStatus === 'error') && 'Connect Wallet to save progress'}
      </button>
      {walletStatus === 'error' && walletError && <p className="wallet-connect-error">{walletError}</p>}
      {!isBusy && walletStatus !== 'linked' && !isInsideSphere() && (
        <p className="wallet-connect-hint">Opens Sphere Wallet in a popup window to sign in.</p>
      )}
    </div>
  )
}
