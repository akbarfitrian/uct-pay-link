import { useState } from 'react'
import DashboardMenu from './generator/DashboardMenu'
import ExpressRequestView from './generator/ExpressRequestView'
import BulkRequestView from './generator/BulkRequestView'

type DashboardView = 'menu' | 'express' | 'bulk'

/**
 * Billing dashboard entry point.
 * Purely client-side view routing (no react-router involvement) between:
 * - the home menu (Express vs Bulk)
 * - the Express Request single-link form
 * - the Bulk Request mass-generation workflow
 */
export default function GeneratorPage() {
  const [view, setView] = useState<DashboardView>('menu')

  if (view === 'express') {
    return <ExpressRequestView onBack={() => setView('menu')} />
  }

  if (view === 'bulk') {
    return <BulkRequestView onBack={() => setView('menu')} />
  }

  return <DashboardMenu onSelectExpress={() => setView('express')} onSelectBulk={() => setView('bulk')} />
}
