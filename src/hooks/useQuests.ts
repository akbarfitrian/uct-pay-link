import { useCallback, useEffect, useState } from 'react'
import { QUEST_MAP, QUESTS, getTier, type Quest, type QuestId } from '../config/quests'
import { connectSphereWallet, isInsideSphere } from '../lib/sphereConnect'
import { consumeHandoff, readLocalState, writeLocalState, type LocalQuestState } from '../lib/sessionHandoff'

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
 * Local-only: progress lives entirely in this browser's localStorage (see
 * sessionHandoff.ts for the storage key + shape). There used to be a
 * Supabase-backed version of this hook (profiles / quest_completions /
 * asset_usage tables, anonymous auth per browser — see MIGRATION_NOTES.md
 * for the historical writeup), but that required a live Supabase project.
 * Now that the project's been torn down, this reverts to the simpler
 * client-only model: points are just the sum of `QUEST_MAP[id].points` over
 * whatever quest ids are recorded as completed, same idea the old RPCs used
 * server-side, just computed here instead.
 *
 * The public shape returned here is unchanged from the Supabase version, so
 * QuestsContext / QuestWidget / QuestPanel / BulkRequestView /
 * ExpressRequestView all keep working with zero changes. The one behavior
 * change: `connectWallet` now just remembers the connected address in this
 * browser (localStorage) for display — it no longer merges progress from
 * another device/profile, since that merge lived in the now-deleted
 * database. If you bring a backend back later, that's the piece to restore.
 */
export function useQuests() {
  const [state, setState] = useState<QuestState>(EMPTY_STATE)
  const [totalPoints, setTotalPoints] = useState(0)
  const [toastQueue, setToastQueue] = useState<Quest[]>([])
  const [isReady, setIsReady] = useState(false)
  const [walletAddress, setWalletAddress] = useState<string | null>(null)
  const [walletStatus, setWalletStatus] = useState<WalletStatus>('idle')
  const [walletError, setWalletError] = useState('')

  // Bootstrap: resume a handed-off state (see sessionHandoff.ts) if this
  // page was opened via the "Open in Sphere Wallet" link, otherwise just
  // read whatever's already in this browser's localStorage.
  useEffect(() => {
    let cancelled = false

    async function bootstrap() {
      await consumeHandoff()
      if (cancelled) return

      const saved = readLocalState()
      const completed = saved.completed.filter(isQuestId)

      setState({ completed, usedAssets: saved.usedAssets })
      setTotalPoints(totalPointsFor(completed))
      if (saved.walletAddress) {
        setWalletAddress(saved.walletAddress)
        setWalletStatus('linked')
      }
      setIsReady(true)
    }

    bootstrap()
    return () => {
      cancelled = true
    }
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
   * Connects to Sphere Wallet through the same postMessage iframe bridge
   * PayPage uses (see src/lib/sphereConnect.ts) and remembers the address in
   * this browser's localStorage. Only works when this page is loaded inside
   * Sphere's iframe — callers should check `canConnectWallet` first and, if
   * false, point the user at sphereAgentUrl() to open the app inside Sphere
   * (same fallback PayPage shows for payments).
   *
   * Note: this no longer merges quest history from another device/profile —
   * that required the Supabase backend this app previously had. It's purely
   * "remember which wallet this browser belongs to" now.
   */
  const connectWallet = useCallback(async () => {
    setWalletStatus('connecting')
    setWalletError('')

    try {
      const address = await connectSphereWallet('Link quest progress to your wallet')
      setWalletAddress(address)
      setWalletStatus('linked')
      setState((prev) => {
        persist(prev, address)
        return prev
      })
    } catch (err) {
      console.error('connectWallet failed', err)
      const msg = err instanceof Error ? err.message : String(err)
      setWalletError(msg.match(/reject|cancel|denied/i) ? 'Connection cancelled.' : msg)
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
    /** Whether connectWallet() can actually run right now (i.e. we're inside Sphere's iframe). */
    canConnectWallet: isInsideSphere(),
  }
}

export type UseQuestsReturn = ReturnType<typeof useQuests>
