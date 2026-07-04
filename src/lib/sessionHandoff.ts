import { supabase } from './supabaseClient'

/**
 * THE BUG THIS FILE FIXES
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
 * supabase-js persists the anonymous session in localStorage. Different
 * bucket -> `getSession()` inside the iframe finds nothing -> a brand new
 * anonymous user gets created there -> connectWallet() links the wallet to
 * that *new, mostly-empty* profile instead of the one the person actually
 * built up points on. That's exactly the 55-pts-vs-15-pts mismatch between
 * the standalone tab and the Sphere-embedded view.
 *
 * There's no way for JS in one storage partition to read another
 * partition's localStorage directly (that's the whole point of
 * partitioning). The only channel left is the URL itself, so this module
 * carries the current session's tokens across in a `#fragment` — fragments
 * are never sent to any server (unlike query params), so this never shows
 * up in Vercel/Sphere logs, only in the browser's own address bar, and
 * only for the few seconds until consumeHandoff() strips it.
 *
 * This is safe to do for this app's *anonymous* session specifically: the
 * token only grants access to that one anonymous user's own
 * quest_completions / asset_usage rows (enforced by Postgres RLS in
 * 0001_points_system.sql) — it has nothing to do with Sphere Wallet's own
 * auth, and can't touch funds or any personal data.
 */

const HANDOFF_KEY = 'qs_at'

/**
 * Returns `targetUrl` with the current Supabase session tokens appended as
 * a URL fragment, so whatever loads `targetUrl` next can resume the exact
 * same anonymous identity (see consumeHandoff). Falls back to `targetUrl`
 * unchanged if there's no session to hand off yet.
 */
export async function withHandoff(targetUrl: string): Promise<string> {
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession()

    if (!session?.access_token || !session?.refresh_token) return targetUrl

    const payload = encodeURIComponent(
      JSON.stringify({ at: session.access_token, rt: session.refresh_token }),
    )

    const [base, existingHash] = targetUrl.split('#')
    const hash = existingHash ? `${existingHash}&${HANDOFF_KEY}=${payload}` : `${HANDOFF_KEY}=${payload}`
    return `${base}#${hash}`
  } catch (err) {
    console.error('Failed to build session handoff URL', err)
    return targetUrl
  }
}

/**
 * Call once, at the very start of app bootstrap (before any anonymous
 * sign-in decision is made). If the current URL was handed a session via
 * withHandoff() above, resumes THAT session instead of letting the caller
 * create a fresh one — this is what makes quest progress actually follow
 * the person from the standalone tab into the Sphere iframe.
 *
 * Always strips the handoff fragment from the visible URL afterwards
 * (found or not), so the tokens never linger in the address bar, browser
 * history, or get shared if the person copies the URL.
 *
 * Returns true if a session was resumed.
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
    const { at, rt } = JSON.parse(decodeURIComponent(payload)) as { at?: string; rt?: string }
    if (!at || !rt) return false

    const { error } = await supabase.auth.setSession({ access_token: at, refresh_token: rt })
    if (error) throw error
    return true
  } catch (err) {
    console.error('Failed to resume handed-off session', err)
    return false
  }
}
