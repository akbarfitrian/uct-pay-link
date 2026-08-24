import { useCallback, useEffect, useState } from 'react'
import { QUEST_MAP, QUESTS, getTier, type Quest, type QuestId } from '../config/quests'
import { connectSphereWalletAddress, describeSphereError } from '../lib/sphereConnect'
import { readLocalState, writeLocalState, type LocalQuestState } from '../lib/questStorage'

interface QuestState {
  completed: QuestId[]
  /** Distinct asset symbols (e.g. "UCT", "USDC") ever used across a generated link. */
  usedAssets: string[]
}

const EMPTY_STATE: QuestState = { completed: [], usedAssets: [] }

function isQuestId(value: unknown): value is QuestId {
  return typeof value === 'string' && value in QUEST_MAP
}

export type WalletStatus = 'idle' | 'connecting' | 'linked' | 'error'

function totalPointsFor(completed: QuestId[]): number {
  return completed.reduce((sum, id) => sum + (QUEST_MAP[id]?.points ?? 0), 0)
}

/**
 * Shared quest & points state for the payment-link generator.
 *
 * Local-only, no backend: progress lives entirely in this browser's
 * localStorage (see questStorage.ts for the storage key + shape). Points
 * are just the sum of `QUEST_MAP[id].points` over whatever quest ids are
 * recorded as completed — never an incremented counter, so it can't drift.
 *
 * The public shape returned here: `quests`, `completedIds`, `totalPoints`,
 * `tier`, `completeQuest`, `recordAssetUsed`, `activeToast`, `dismissToast`,
 * `isReady`, plus wallet-label fields below. `connectWallet` opens a Sphere
 * Wallet popup (see sphereConnect.ts) and just remembers the connected
 * address in this browser (localStorage) for display — it does not merge
 * progress from another device, since there's no backend to look that up
 * against.
 */
export function useQuests() {
  const [state, setState] = useState<QuestState>(EMPTY_STATE)
  const [totalPoints, setTotalPoints] = useState(0)
  const [toastQueue, setToastQueue] = useState<Quest[]>([])
  const [isReady, setIsReady] = useState(false)
  const [walletAddress, setWalletAddress] = useState<string | null>(null)
  const [walletStatus, setWalletStatus] = useState<WalletStatus>('idle')
  const [walletError, setWalletError] = useState('')

  // Bootstrap: read whatever's already in this browser's localStorage.
  useEffect(() => {
    const saved = readLocalState()
    const completed = saved.completed.filter(isQuestId)

    setState({ completed, usedAssets: saved.usedAssets })
    setTotalPoints(totalPointsFor(completed))
    if (saved.walletAddress) {
      setWalletAddress(saved.walletAddress)
      setWalletStatus('linked')
    }
    setIsReady(true)
  }, [])

  const persist = useCallback((next: QuestState, wallet: string | null) => {
    writeLocalState({ completed: next.completed, usedAssets: next.usedAssets, walletAddress: wallet })
  }, [])

  const unlock = useCallback(
    (ids: QuestId[]) => {
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

        if (newlyUnlocked.length === 0) return prev

        setToastQueue((queue) => [...queue, ...newlyUnlocked.map((id) => QUEST_MAP[id])])
        const next = { ...prev, completed: Array.from(completedSet) }
        setTotalPoints(totalPointsFor(next.completed))
        persist(next, walletAddress)
        return next
      })
    },
    [persist, walletAddress],
  )

  const completeQuest = useCallback(
    (id: QuestId) => {
      unlock([id])
    },
    [unlock],
  )

  const recordAssetUsed = useCallback(
    (assetId: string) => {
      const normalized = assetId.trim().toUpperCase()
      if (!normalized) return

      setState((prev) => {
        if (prev.usedAssets.includes(normalized)) return prev

        const usedAssets = [...prev.usedAssets, normalized]
        const completedSet = new Set(prev.completed)
        const newlyUnlocked: QuestId[] = []

        // Multi-asset quest completion is derived here (used to be a server
        // RPC keyed off the same rule: 2+ distinct assets ever used).
        if (usedAssets.length >= 2 && !completedSet.has('multi_asset')) {
          completedSet.add('multi_asset')
          newlyUnlocked.push('multi_asset')
        }

        const next: QuestState = { completed: Array.from(completedSet), usedAssets }

        if (newlyUnlocked.length > 0) {
          setToastQueue((queue) => [...queue, ...newlyUnlocked.map((id) => QUEST_MAP[id])])
        }
        setTotalPoints(totalPointsFor(next.completed))
        persist(next, walletAddress)
        return next
      })
    },
    [persist, walletAddress],
  )

  const dismissToast = useCallback(() => {
    setToastQueue((queue) => queue.slice(1))
  }, [])

  /**
   * Opens a Sphere Wallet popup window (see src/lib/sphereConnect.ts) and
   * remembers the returned address in this browser's localStorage. Works
   * from any normal tab — no iframe embedding required.
   *
   * Note: this does not merge quest history from another device/profile —
   * there's no backend to look that up against. It's purely "remember which
   * wallet this browser belongs to" now.
   */
  const connectWallet = useCallback(async () => {
    setWalletStatus('connecting')
    setWalletError('')

    try {
      const address = await connectSphereWalletAddress('Link quest progress to your wallet')
      setWalletAddress(address)
      setWalletStatus('linked')
      setState((prev) => {
        persist(prev, address)
        return prev
      })
    } catch (err) {
      console.error('connectWallet failed', err)
      setWalletError(describeSphereError(err))
      setWalletStatus('error')
    }
  }, [persist])

  const completedIds = new Set(state.completed)

  return {
    quests: QUESTS,
    completedIds,
    totalPoints,
    tier: getTier(totalPoints),
    completeQuest,
    recordAssetUsed,
    activeToast: toastQueue[0] ?? null,
    dismissToast,
    /** Existing consumers can ignore this; useful if you want a loading skeleton on the badge. */
    isReady,
    /** Wallet connected to this browser (local-only; see doc comment above). */
    walletAddress,
    walletStatus,
    walletError,
    connectWallet,
  }
}

export type UseQuestsReturn = ReturnType<typeof useQuests>
