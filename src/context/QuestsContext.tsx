import { createContext, useContext, type ReactNode } from 'react'
import { useQuests, type UseQuestsReturn } from '../hooks/useQuests'

const QuestsContext = createContext<UseQuestsReturn | null>(null)

/**
 * Mounted once near the app root. Every consumer (the navbar points badge,
 * Express Request, Bulk Request, ...) reads/writes the same state through
 * this context instead of each holding its own localStorage-backed copy —
 * otherwise completing a quest in one view wouldn't show up in the badge
 * until a full reload.
 */
export function QuestsProvider({ children }: { children: ReactNode }) {
  const value = useQuests()
  return <QuestsContext.Provider value={value}>{children}</QuestsContext.Provider>
}

export function useQuestsContext(): UseQuestsReturn {
  const context = useContext(QuestsContext)
  if (!context) {
    throw new Error('useQuestsContext must be used within a QuestsProvider')
  }
  return context
}
