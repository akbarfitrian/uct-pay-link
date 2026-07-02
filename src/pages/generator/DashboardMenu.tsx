import { ArrowRight, Zap, LayoutGrid } from 'lucide-react'

interface DashboardMenuProps {
  onSelectExpress: () => void
  onSelectBulk: () => void
}

export default function DashboardMenu({ onSelectExpress, onSelectBulk }: DashboardMenuProps) {
  return (
    <div className="menu-container">
      <div className="menu-header">
        <h1 className="menu-title">Create Payment Request</h1>
        <p className="menu-subtitle">Choose how you'd like to generate a payment link today.</p>
      </div>

      <div className="menu-grid">
        <button type="button" className="menu-card" onClick={onSelectExpress}>
          <span className="menu-card-icon">
            <Zap size={26} strokeWidth={2.25} />
          </span>
          <h2 className="menu-card-title">Express Request</h2>
          <p className="menu-card-desc">
            Create a single instant payment link for an individual client quickly.
          </p>
          <span className="menu-card-cta">
            Start <ArrowRight size={16} strokeWidth={2.5} />
          </span>
        </button>

        <button type="button" className="menu-card" onClick={onSelectBulk}>
          <span className="menu-card-icon">
            <LayoutGrid size={26} strokeWidth={2.25} />
          </span>
          <h2 className="menu-card-title">Bulk Request</h2>
          <p className="menu-card-desc">
            Generate dozens to thousands of payment links simultaneously from Excel/CSV data or raw
            mass copy-paste.
          </p>
          <span className="menu-card-cta">
            Start <ArrowRight size={16} strokeWidth={2.5} />
          </span>
        </button>
      </div>
    </div>
  )
}

