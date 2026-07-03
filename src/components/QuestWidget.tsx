import { useState } from 'react'
import { Trophy } from 'lucide-react'
import { useQuestsContext } from '../context/QuestsContext'
import QuestPanel from './QuestPanel'
import QuestToast from './QuestToast'

export default function QuestWidget() {
  const [open, setOpen] = useState(false)
  const { totalPoints, tier, activeToast, dismissToast } = useQuestsContext()

  return (
    <div className="quest-widget">
      <button
        type="button"
        className="quest-badge"
        onClick={() => setOpen((prev) => !prev)}
        aria-haspopup="dialog"
        aria-expanded={open}
        title="Quests & Points"
      >
        <Trophy size={16} strokeWidth={2.25} />
        <span className="quest-badge-points">{totalPoints}</span>
        <span className="quest-badge-tier">{tier.name}</span>
      </button>

      {open && (
        <>
          {/* Click-outside-to-close target; sits below the panel, above the rest of the page. */}
          <div className="quest-panel-backdrop" onClick={() => setOpen(false)} />
          <QuestPanel onClose={() => setOpen(false)} />
        </>
      )}

      {activeToast && <QuestToast quest={activeToast} onDone={dismissToast} />}
    </div>
  )
}
