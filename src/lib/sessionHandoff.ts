/**
 * THE PROBLEM THIS FILE HANDLES
 * ------------------------------------------------------------------------
 * "Open in Sphere Wallet to save progress" opens
 * `sphere.unicity.network/agents/custom?url=<this app>`, which embeds this
 * app in an <iframe>. Modern browsers (Chrome's storage partitioning,
 * Safari ITP, Firefox Total Cookie Protection) key third-party iframe
 * storage by the *pair* (top-level site, embedded origin), not just the
 * embedded origin alone. So `localStorage` for uct-pay-link.vercel.app
 * when it's the top-level tab is a totally different bucket than
 * `localStorage` for uct-pay-link.vercel.app when it's an iframe under
 * sphere.unicity.network.
 *
 * That means quest progress saved in the standalone tab wouldn't show up
 * inside the Sphere-embedded view — it'd look like a fresh, empty browser.
 * There's no way for JS in one storage partition to read another
 * partition's localStorage directly (that's the whole point of
 * partitioning). The only channel left is the URL itself, so this module
 * carries the current local quest state across in a `#fragment` —
 * fragments are never sent to any server (unlike query params), so this
 * never shows up in Vercel/Sphere logs, only in the browser's own address
 * bar, and only for the few seconds until consumeHandoff() strips it.
 */

export interface LocalQuestState {
  completed: string[]
  usedAssets: string[]
  walletAddress: string | null
}

const EMPTY_LOCAL_STATE: LocalQuestState = { completed: [], usedAssets: [], walletAddress: null }

const STORAGE_KEY = 'uct-pay-link:quest-state'
const HANDOFF_KEY = 'qs'

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

/**
 * Returns `targetUrl` with this browser's current quest state appended as a
 * URL fragment, so whatever loads `targetUrl` next can pick up the same
 * progress (see consumeHandoff). Falls back to `targetUrl` unchanged if
 * there's nothing worth carrying over yet.
 */
export async function withHandoff(targetUrl: string): Promise<string> {
  try {
    const state = readLocalState()
    if (state.completed.length === 0 && state.usedAssets.length === 0 && !state.walletAddress) {
      return targetUrl
    }

    const payload = encodeURIComponent(JSON.stringify(state))
    const [base, existingHash] = targetUrl.split('#')
    const hash = existingHash ? `${existingHash}&${HANDOFF_KEY}=${payload}` : `${HANDOFF_KEY}=${payload}`
    return `${base}#${hash}`
  } catch (err) {
    console.error('Failed to build session handoff URL', err)
    return targetUrl
  }
}

/**
 * Call once, at the very start of app bootstrap (before reading local
 * state). If the current URL was handed quest progress via withHandoff()
 * above, writes it into this partition's localStorage before anything else
 * reads it — this is what makes quest progress actually follow the person
 * from the standalone tab into the Sphere iframe.
 *
 * Always strips the handoff fragment from the visible URL afterwards
 * (found or not), so it never lingers in the address bar, browser history,
 * or gets shared if the person copies the URL.
 *
 * Returns true if a handed-off state was found and applied.
 */
export async function consumeHandoff(): Promise<boolean> {
  const rawHash = window.location.hash.startsWith('#') ? window.location.hash.slice(1) : window.location.hash
  if (!rawHash) return false

  const params = new URLSearchParams(rawHash)
  const payload = params.get(HANDOFF_KEY)
  if (!payload) return false

  // Single-use — strip it before we even try to parse it, so a failed
  // parse can't leave it sitting in the URL either.
  params.delete(HANDOFF_KEY)
  const rest = params.toString()
  const cleanUrl = window.location.pathname + window.location.search + (rest ? `#${rest}` : '')
  window.history.replaceState(null, '', cleanUrl)

  try {
    const state = JSON.parse(decodeURIComponent(payload)) as Partial<LocalQuestState>
    writeLocalState({
      completed: Array.isArray(state.completed) ? state.completed : [],
      usedAssets: Array.isArray(state.usedAssets) ? state.usedAssets : [],
      walletAddress: typeof state.walletAddress === 'string' ? state.walletAddress : null,
    })
    return true
  } catch (err) {
    console.error('Failed to resume handed-off quest state', err)
    return false
  }
}
