import { Check, Loader2, Wallet } from 'lucide-react'
import { useQuestsContext } from '../context/QuestsContext'

/**
 * Lets the user connect Sphere Wallet — clicking opens a real wallet popup
 * window (see src/lib/sphereConnect.ts) so their connected address is shown
 * alongside their progress. Progress itself always lives in this browser's
 * localStorage (see useQuests.ts) — connecting a wallet here doesn't merge
 * in progress from another device, it just labels this browser's progress
 * with an address. Lives inside QuestPanel, right below the quest list.
 */
export default function WalletConnect() {
  const { walletAddress, walletStatus, walletError, connectWallet } = useQuestsContext()

  const isBusy = walletStatus === 'connecting'

  if (walletStatus === 'linked' && walletAddress) {
    return (
      <div className="wallet-connect wallet-connect-linked">
        <span className="wallet-connect-icon wallet-connect-icon-done">
          <Check size={14} strokeWidth={2.5} />
        </span>
        <span className="wallet-connect-text">
          Wallet connected: <strong>@{walletAddress}</strong>
        </span>
      </div>
    )
  }

  return (
    <div className="wallet-connect">
      <button type="button" className="wallet-connect-btn" onClick={connectWallet} disabled={isBusy}>
        {isBusy ? <Loader2 size={14} className="wallet-connect-spin" /> : <Wallet size={14} />}
        {walletStatus === 'connecting' && 'Connecting…'}
        {(walletStatus === 'idle' || walletStatus === 'error') && 'Connect Wallet'}
      </button>
      {walletStatus === 'error' && walletError && <p className="wallet-connect-error">{walletError}</p>}
    </div>
  )
}
