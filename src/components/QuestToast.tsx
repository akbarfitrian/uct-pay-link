import { useEffect } from 'react'
import { PartyPopper, X } from 'lucide-react'
import type { Quest } from '../config/quests'

interface QuestToastProps {
  quest: Quest
  onDone: () => void
}

const DISPLAY_MS = 3500

export default function QuestToast({ quest, onDone }: QuestToastProps) {
  useEffect(() => {
    const timer = window.setTimeout(() => {
      onDone()
    }, DISPLAY_MS)

    return () => window.clearTimeout(timer)
  }, [quest.id, onDone])

  return (
    <div className="quest-toast" role="status">
      <span className="quest-toast-icon">
        <PartyPopper size={18} strokeWidth={2.25} />
      </span>
      <span className="quest-toast-body">
        <span className="quest-toast-title">Quest complete — {quest.title}</span>
        <span className="quest-toast-points">+{quest.points} points</span>
      </span>

      {/* Professional dismiss button */}
      <button
        onClick={onDone}
        className="quest-toast-close"
        aria-label="Dismiss notification"
        title="Dismiss"
      >
        <X size={18} strokeWidth={2.5} />
      </button>
    </div>
  )
}