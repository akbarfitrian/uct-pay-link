import { useCallback, useEffect, useState } from 'react'
import { QUEST_MAP, QUESTS, getTier, type Quest, type QuestId } from '../config/quests'

const STORAGE_KEY = 'uct-pay-link-quests'

interface QuestState {
  completed: QuestId[]
  /** Distinct asset symbols (e.g. "UCT", "USDC") ever used across a generated link. */
  usedAssets: string[]
}

const EMPTY_STATE: QuestState = { completed: [], usedAssets: [] }

function isQuestId(value: unknown): value is QuestId {
  return typeof value === 'string' && value in QUEST_MAP
}

/** Defensively coerce whatever was in localStorage into a valid, deduped QuestState. */
function sanitizeState(raw: unknown): QuestState {
  if (!raw || typeof raw !== 'object') return EMPTY_STATE

  const candidate = raw as Partial<QuestState>
  const completed = Array.isArray(candidate.completed) ? candidate.completed.filter(isQuestId) : []
  const usedAssets = Array.isArray(candidate.usedAssets)
    ? candidate.usedAssets.filter((asset): asset is string => typeof asset === 'string')
    : []

  return {
    completed: Array.from(new Set(completed)),
    usedAssets: Array.from(new Set(usedAssets)),
  }
}

function loadState(): QuestState {
  if (typeof window === 'undefined') return EMPTY_STATE

  try {
    const stored = window.localStorage.getItem(STORAGE_KEY)
    if (!stored) return EMPTY_STATE
    return sanitizeState(JSON.parse(stored))
  } catch {
    // Corrupted or unreadable value — fall back to a clean slate instead of crashing.
    return EMPTY_STATE
  }
}

/**
 * Meta-quests are derived from other completed quests rather than fired
 * directly by a component, so they can never drift out of sync with their
 * underlying condition.
 */
function deriveMetaCompletions(completed: Set<QuestId>): QuestId[] {
  const unlocked: QuestId[] = []
  if (completed.has('first_link') && completed.has('bulk_starter') && !completed.has('explorer')) {
    unlocked.push('explorer')
  }
  return unlocked
}

/**
 * Shared quest & points state for the payment-link generator.
 *
 * Progress is local to this browser/device only (localStorage) — there is
 * no account system yet, so there is nothing meaningful to sync to a
 * backend. See QuestsContext for how this is shared across the app.
 */
export function useQuests() {
  const [state, setState] = useState<QuestState>(loadState)
  const [toastQueue, setToastQueue] = useState<Quest[]>([])

  // Persist on every change. Failures (private mode, full quota, disabled
  // storage) are non-fatal: the UI keeps working, progress just won't survive a reload.
  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
    } catch {
      // Intentionally ignored — see comment above.
    }
  }, [state])

  const unlock = useCallback((ids: QuestId[]) => {
    if (ids.length === 0) return

    setState((prev) => {
      const completedSet = new Set(prev.completed)
      const newlyUnlocked: QuestId[] = []

      for (const id of ids) {
        if (!completedSet.has(id)) {
          completedSet.add(id)
          newlyUnlocked.push(id)
        }
      }

      // Unlocking a quest can satisfy a meta-quest's condition in the same step.
      for (const id of deriveMetaCompletions(completedSet)) {
        completedSet.add(id)
        newlyUnlocked.push(id)
      }

      if (newlyUnlocked.length === 0) return prev

      setToastQueue((queue) => [...queue, ...newlyUnlocked.map((id) => QUEST_MAP[id])])
      return { ...prev, completed: Array.from(completedSet) }
    })
  }, [])

  const completeQuest = useCallback((id: QuestId) => unlock([id]), [unlock])

  const recordAssetUsed = useCallback((assetId: string) => {
    const normalized = assetId.trim().toUpperCase()
    if (!normalized) return

    setState((prev) => {
      if (prev.usedAssets.includes(normalized)) return prev
      return { ...prev, usedAssets: [...prev.usedAssets, normalized] }
    })
  }, [])

  // "Multi Asset" reacts to usedAssets rather than being called directly,
  // so it stays correct regardless of which view recorded which asset.
  useEffect(() => {
    if (state.usedAssets.length >= 2) {
      unlock(['multi_asset'])
    }
  }, [state.usedAssets.length, unlock])

  const dismissToast = useCallback(() => {
    setToastQueue((queue) => queue.slice(1))
  }, [])

  const completedIds = new Set(state.completed)
  const totalPoints = QUESTS.reduce((sum, quest) => (completedIds.has(quest.id) ? sum + quest.points : sum), 0)

  return {
    quests: QUESTS,
    completedIds,
    totalPoints,
    tier: getTier(totalPoints),
    completeQuest,
    recordAssetUsed,
    activeToast: toastQueue[0] ?? null,
    dismissToast,
  }
}

export type UseQuestsReturn = ReturnType<typeof useQuests>
