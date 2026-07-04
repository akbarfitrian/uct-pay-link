import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { QUEST_MAP, QUESTS, getTier, type Quest, type QuestId } from '../config/quests'
import { connectSphereWallet, isInsideSphere } from '../lib/sphereConnect'
import { consumeHandoff } from '../lib/sessionHandoff'

interface QuestState {
  completed: QuestId[]
  /** Distinct asset symbols (e.g. "UCT", "USDC") ever used across a generated link. */
  usedAssets: string[]
}

const EMPTY_STATE: QuestState = { completed: [], usedAssets: [] }

function isQuestId(value: unknown): value is QuestId {
  return typeof value === 'string' && value in QUEST_MAP
}

interface QuestStateRow {
  total_points: number
  completed_quest_ids: string[]
  used_assets: string[]
  wallet_address: string | null
}

interface QuestMutationRow {
  newly_unlocked: string[]
  total_points: number
}

interface LinkWalletRow {
  total_points: number
  completed_quest_ids: string[]
  used_assets: string[]
  wallet_address: string | null
}

export type WalletStatus = 'idle' | 'connecting' | 'linking' | 'linked' | 'error'

/**
 * Ensures there's a signed-in Supabase user for this browser and returns
 * their id. Uses anonymous auth so points can persist per-device without
 * putting a login wall in front of the generator — this can later be
 * upgraded to email/wallet-linked accounts (Supabase supports converting an
 * anonymous user into a permanent one via supabase.auth.updateUser /
 * linkIdentity without losing their existing rows, since the user_id stays
 * the same).
 */
async function ensureSignedIn(): Promise<void> {
  // If the URL is carrying a session handed off from a different storage
  // partition (see sessionHandoff.ts — this is how "Open in Sphere Wallet
  // to save progress" survives the standalone-tab -> Sphere-iframe jump),
  // resume that session before deciding whether we need a fresh anonymous
  // one. This must run first, or the mismatched-points bug comes right
  // back: getSession() below would find nothing in this partition and
  // sign in as a brand new (empty) anonymous user instead.
  const resumed = await consumeHandoff()
  if (resumed) return

  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (session?.user) return

  const { error } = await supabase.auth.signInAnonymously()
  if (error) throw error
}

/**
 * Shared quest & points state for the payment-link generator.
 *
 * Progress now lives in Supabase (profiles / quest_completions /
 * asset_usage), keyed off an anonymous-auth user id persisted in
 * localStorage by supabase-js. See QuestsContext for how this is shared
 * across the app — the public shape returned here is unchanged from the
 * previous localStorage-only version, so consumers don't need to change.
 */
export function useQuests() {
  const [state, setState] = useState<QuestState>(EMPTY_STATE)
  const [totalPoints, setTotalPoints] = useState(0)
  const [toastQueue, setToastQueue] = useState<Quest[]>([])
  const [isReady, setIsReady] = useState(false)
  const [walletAddress, setWalletAddress] = useState<string | null>(null)
  const [walletStatus, setWalletStatus] = useState<WalletStatus>('idle')
  const [walletError, setWalletError] = useState('')

  // Bootstrap: sign in (or resume session), then load current state.
  useEffect(() => {
    let cancelled = false

    async function bootstrap() {
      try {
        await ensureSignedIn()
        // Idempotent — safe to call every load, cheap no-op after the first.
        await supabase.rpc('ensure_profile')

        const { data, error } = await supabase.rpc('get_my_quest_state').single<QuestStateRow>()
        if (error) throw error
        if (cancelled || !data) return

        setState({
          completed: data.completed_quest_ids.filter(isQuestId),
          usedAssets: data.used_assets,
        })
        setTotalPoints(data.total_points)
        if (data.wallet_address) {
          setWalletAddress(data.wallet_address)
          setWalletStatus('linked')
        }
      } catch (err) {
        // Fail open: the UI keeps working, it just won't reflect saved
        // progress until the next successful sync (e.g. next reload).
        console.error('Failed to load quest state from Supabase', err)
      } finally {
        if (!cancelled) setIsReady(true)
      }
    }

    bootstrap()
    return () => {
      cancelled = true
    }
  }, [])

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

      if (newlyUnlocked.length === 0) return prev

      setToastQueue((queue) => [...queue, ...newlyUnlocked.map((id) => QUEST_MAP[id])])
      return { ...prev, completed: Array.from(completedSet) }
    })
  }, [])

  const completeQuest = useCallback(
    (id: QuestId) => {
      // Optimistic unlock so completing a quest still feels instant. This is
      // safe to reconcile against below even if it fires more than once,
      // because complete_quest() is idempotent server-side
      // (ON CONFLICT DO NOTHING keyed on user_id + quest_id).
      unlock([id])

      supabase
        .rpc('complete_quest', { p_quest_id: id })
        .single<QuestMutationRow>()
        .then(({ data, error }) => {
          if (error) {
            console.error(`complete_quest('${id}') failed`, error)
            return
          }
          if (data) {
            unlock(data.newly_unlocked.filter(isQuestId))
            setTotalPoints(data.total_points)
          }
        })
    },
    [unlock],
  )

  const recordAssetUsed = useCallback(
    (assetId: string) => {
      const normalized = assetId.trim().toUpperCase()
      if (!normalized) return

      setState((prev) => {
        if (prev.usedAssets.includes(normalized)) return prev
        return { ...prev, usedAssets: [...prev.usedAssets, normalized] }
      })

      supabase
        .rpc('record_asset_used', { p_asset: normalized })
        .single<QuestMutationRow>()
        .then(({ data, error }) => {
          if (error) {
            console.error(`record_asset_used('${normalized}') failed`, error)
            return
          }
          if (data) {
            unlock(data.newly_unlocked.filter(isQuestId))
            setTotalPoints(data.total_points)
          }
        })
    },
    [unlock],
  )

  const dismissToast = useCallback(() => {
    setToastQueue((queue) => queue.slice(1))
  }, [])

  /**
   * Connects to Sphere Wallet through the same postMessage iframe bridge
   * PayPage uses (see src/lib/sphereConnect.ts), then links the returned
   * identity to this profile via link_wallet_identity() so quest progress
   * follows the wallet instead of resetting per device/browser. Only works
   * when this page is loaded inside Sphere's iframe — callers should check
   * `canConnectWallet` first and, if false, point the user at
   * sphereAgentUrl() to open the app inside Sphere (same fallback PayPage
   * shows for payments).
   */
  const connectWallet = useCallback(async () => {
    setWalletStatus('connecting')
    setWalletError('')

    try {
      const address = await connectSphereWallet('Link quest progress to your wallet')

      setWalletStatus('linking')
      const { data, error } = await supabase
        .rpc('link_wallet_identity', { p_wallet_address: address })
        .single<LinkWalletRow>()

      if (error) throw error
      if (!data) throw new Error('No response from link_wallet_identity')

      setState({
        completed: data.completed_quest_ids.filter(isQuestId),
        usedAssets: data.used_assets,
      })
      setTotalPoints(data.total_points)
      setWalletAddress(data.wallet_address)
      setWalletStatus('linked')
    } catch (err) {
      console.error('connectWallet failed', err)
      const msg = err instanceof Error ? err.message : String(err)
      setWalletError(msg.match(/reject|cancel|denied/i) ? 'Connection cancelled.' : msg)
      setWalletStatus('error')
    }
  }, [])

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
    /** New — existing consumers can ignore this; useful if you want a loading skeleton on the badge. */
    isReady,
    /** Wallet-linked progress (see MIGRATION_NOTES.md → "upgrading from anonymous to a real account"). */
    walletAddress,
    walletStatus,
    walletError,
    connectWallet,
    /** Whether connectWallet() can actually run right now (i.e. we're inside Sphere's iframe). */
    canConnectWallet: isInsideSphere(),
  }
}

export type UseQuestsReturn = ReturnType<typeof useQuests>
