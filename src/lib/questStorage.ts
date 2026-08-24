/**
 * Local persistence for quest/points state — a single JSON blob in this
 * browser's localStorage. No backend, no cross-tab or cross-partition
 * syncing: progress belongs to whichever browser/device earned it.
 *
 * (This used to also carry a URL-fragment handoff for when the app ran
 * embedded inside Sphere's iframe, since third-party iframe storage is
 * partitioned separately from the standalone tab. Now that wallet connect
 * uses a popup instead — see sphereConnect.ts — this app is always the
 * top-level tab, so that problem, and the handoff code that solved it,
 * no longer apply.)
 */

export interface LocalQuestState {
  completed: string[]
  usedAssets: string[]
  walletAddress: string | null
}

const EMPTY_LOCAL_STATE: LocalQuestState = { completed: [], usedAssets: [], walletAddress: null }

const STORAGE_KEY = 'uct-pay-link:quest-state'

/** Reads this browser's saved quest state, or an empty state if there's none yet / it's unreadable. */
export function readLocalState(): LocalQuestState {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return EMPTY_LOCAL_STATE

    const parsed = JSON.parse(raw) as Partial<LocalQuestState>
    return {
      completed: Array.isArray(parsed.completed) ? parsed.completed : [],
      usedAssets: Array.isArray(parsed.usedAssets) ? parsed.usedAssets : [],
      walletAddress: typeof parsed.walletAddress === 'string' ? parsed.walletAddress : null,
    }
  } catch (err) {
    console.error('Failed to read local quest state', err)
    return EMPTY_LOCAL_STATE
  }
}

/** Persists this browser's quest state. Safe to call on every change — it's just a JSON blob write. */
export function writeLocalState(state: LocalQuestState): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch (err) {
    console.error('Failed to save local quest state', err)
  }
}
