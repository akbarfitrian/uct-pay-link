import { Check, X } from 'lucide-react'
import { TOTAL_POSSIBLE_POINTS } from '../config/quests'
import { useQuestsContext } from '../context/QuestsContext'
import WalletConnect from './WalletConnect'

interface QuestPanelProps {
  onClose: () => void
}

export default function QuestPanel({ onClose }: QuestPanelProps) {
  const { quests, completedIds, totalPoints, tier, walletStatus, walletAddress } = useQuestsContext()
  const isWalletLinked = walletStatus === 'linked' && !!walletAddress
  const progressPct = TOTAL_POSSIBLE_POINTS > 0 ? Math.round((totalPoints / TOTAL_POSSIBLE_POINTS) * 100) : 0

  return (
    <div className="quest-panel" role="dialog" aria-label="Quests & Points">
      <div className="quest-panel-header">
        <div>
          <p className="quest-panel-title">Quests &amp; Points</p>
          <p className="quest-panel-subtitle">
            {tier.name} · {totalPoints}/{TOTAL_POSSIBLE_POINTS} pts
          </p>
        </div>
        <button type="button" className="quest-panel-close" onClick={onClose} aria-label="Close quests panel">
          <X size={16} />
        </button>
      </div>

      <div className="quest-progress-track" role="progressbar" aria-valuenow={progressPct} aria-valuemin={0} aria-valuemax={100}>
        <div className="quest-progress-fill" style={{ width: `${progressPct}%` }} />
      </div>

      <ul className="quest-list">
        {quests.map((quest) => {
          const done = completedIds.has(quest.id)
          const Icon = quest.icon

          return (
            <li key={quest.id} className={`quest-item${done ? ' quest-item-done' : ''}`}>
              <span className="quest-item-icon">
                {done ? <Check size={16} strokeWidth={2.5} /> : <Icon size={16} strokeWidth={2} />}
              </span>
              <span className="quest-item-body">
                <span className="quest-item-title">{quest.title}</span>
                <span className="quest-item-desc">{quest.description}</span>
              </span>
              <span className="quest-item-points">+{quest.points}</span>
            </li>
          )
        })}
      </ul>

      <WalletConnect />

      <p className="quest-panel-footnote">
        {isWalletLinked
          ? 'Progress is saved to your wallet — it will follow you across devices.'
          : 'Progress is saved on this device only. Connect your wallet to keep it.'}
      </p>
    </div>
  )
}
