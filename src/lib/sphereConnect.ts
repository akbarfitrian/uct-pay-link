import { autoConnect, type AutoConnectResult } from '@unicitylabs/sphere-sdk/connect/browser'
import { SPHERE_NETWORKS } from '@unicitylabs/sphere-sdk/connect'

/** Sphere Wallet's own site — the popup opens `${SPHERE_ORIGIN}/connect`, not a copy of this app. */
export const SPHERE_ORIGIN = 'https://sphere.unicity.network'

/** The connected client type handed back by connectSpherePopup(), for typing callers like PayPage. */
export type SphereClient = AutoConnectResult['client']

/**
 * Opens a real Sphere Wallet popup window and connects to it over
 * postMessage — Sphere Connect's "popup" transport, forced explicitly here
 * rather than auto-detected (this app previously used the "iframe"
 * transport, which required being embedded inside Sphere's own site first;
 * popup mode works from a normal standalone tab, which is how this app
 * actually runs).
 *
 * Resolves once the user approves the connection in the popup. Callers that
 * need to keep talking to the wallet afterwards (queries, intents — see
 * PayPage.tsx) should hold onto `.client` and call `.disconnect()`
 * themselves when finished, which also closes the popup window. Callers
 * that only need the identity should disconnect immediately after reading
 * it (see connectSphereWalletAddress below).
 *
 * Throws if the popup is blocked, the user closes it before approving, or
 * they reject the connection.
 */
export async function connectSpherePopup(dappDescription: string): Promise<AutoConnectResult> {
  return autoConnect({
    dapp: {
      name: 'UCT Pay Link',
      description: dappDescription,
      url: window.location.origin,
    },
    network: SPHERE_NETWORKS.testnet2,
    walletUrl: SPHERE_ORIGIN,
    forceTransport: 'popup',
  })
}

/**
 * `client.connect()` resolves with a wallet `identity` (`PublicIdentity`:
 * `chainPubkey`, optional `directAddress`/`nametag`). This prefers the
 * human-readable nametag, with a couple of defensive fallbacks in case the
 * shape drifts, and returns a single display/storage string.
 */
export function extractIdentityAddress(identity: unknown): string {
  if (typeof identity === 'string') return identity.trim()

  if (identity && typeof identity === 'object') {
    const candidate = identity as Record<string, unknown>
    const value =
      candidate.nametag ?? candidate.directAddress ?? candidate.chainPubkey ?? candidate.address ?? candidate.id
    if (typeof value === 'string') return value.trim()
  }

  return ''
}

/**
 * Connects via the wallet popup purely to read the identity, then
 * disconnects right away (closing the popup) — for flows that just need to
 * label local progress with an address rather than hold a live session open
 * for further queries/intents. Throws if the popup is blocked/closed, the
 * user rejects, or the wallet doesn't hand back a usable identity.
 */
export async function connectSphereWalletAddress(dappDescription: string): Promise<string> {
  const result = await connectSpherePopup(dappDescription)
  try {
    const address = extractIdentityAddress(result.connection.identity)
    if (!address) throw new Error('Sphere Wallet did not return a usable identity.')
    return address
  } finally {
    await result.disconnect()
  }
}

/**
 * Turns a raw connect/intent error into a short, user-facing message.
 * Shared by PayPage (intents) and useQuests (wallet-address connect) so the
 * two flows read the same failure the same way.
 */
export function describeSphereError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err)
  if (msg.match(/popup blocker|failed to open wallet popup/i)) {
    return 'Wallet popup was blocked — allow popups for this site and try again.'
  }
  if (msg.match(/did not respond in time/i)) {
    return 'Wallet popup did not respond in time. Please try again.'
  }
  if (msg.match(/closed before connecting/i)) {
    return 'Wallet popup was closed before connecting.'
  }
  if (msg.match(/reject|cancel|denied/i)) return 'Connection cancelled.'
  return msg
}
