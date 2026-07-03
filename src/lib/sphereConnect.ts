import {
  ConnectClient,
  SPHERE_NETWORKS,
  type ConnectTransport,
  type SphereConnectMessage,
  isSphereConnectMessage,
} from '@unicitylabs/sphere-sdk/connect'
import { PostMessageTransport } from '@unicitylabs/sphere-sdk/connect/browser'

export const SPHERE_ORIGIN = 'https://sphere.unicity.network'
export const SPHERE_AGENT_BASE = `${SPHERE_ORIGIN}/agents/custom`
export const SPHERE_CONNECT_URL = `${SPHERE_ORIGIN}/connect`

/** sessionStorage key used to resume a popup connection across reloads (see CONNECT.md → "Popup Mode (P3) — Session Resume"). */
const POPUP_SESSION_KEY = 'sphere-connect-popup-session'

/**
 * True when this page is running inside Sphere's own iframe (i.e. someone
 * opened it via the "Open in Sphere Wallet" agent flow). Sphere-connect
 * calls only work in this context — postMessage has a parent to talk to.
 */
export function isInsideSphere(): boolean {
  return window !== window.parent
}

/** Sphere agent URL that, when opened, loads `targetUrl` inside Sphere's iframe. */
export function sphereAgentUrl(targetUrl: string = window.location.href): string {
  return `${SPHERE_AGENT_BASE}?url=${encodeURIComponent(targetUrl)}`
}

/**
 * postMessage-based transport used whenever *we* are the iframe child and
 * Sphere Wallet is the parent frame. This is the only transport this app
 * needs today (Sphere is always the host) — same object shape the SDK
 * expects from a browser-extension transport, just backed by
 * window.parent.postMessage instead of an extension bridge.
 */
export function createIframeTransport(): ConnectTransport {
  return {
    send(msg: SphereConnectMessage) {
      window.parent.postMessage(msg, '*')
    },
    onMessage(handler: (msg: SphereConnectMessage) => void) {
      const fn = (e: MessageEvent) => {
        const fromParent = e.source === window.parent || e.source === window.top
        if (fromParent && isSphereConnectMessage(e.data)) handler(e.data)
      }
      window.addEventListener('message', fn)
      return () => window.removeEventListener('message', fn)
    },
    destroy() {},
  }
}

/** Creates a ConnectClient wired to the iframe transport, ready to `.connect()` / `.query()` / `.intent()`. */
export function createSphereClient(dappDescription: string) {
  return new ConnectClient({
    transport: createIframeTransport(),
    dapp: {
      name: 'UCT Pay Link',
      description: dappDescription,
      url: window.location.origin,
    },
    network: SPHERE_NETWORKS.testnet2,
  })
}

/**
 * `client.connect()` resolves with a wallet `identity`. The SDK's exact
 * shape isn't pinned down here, so this accepts whatever it hands back —
 * a bare string, or an object exposing a nametag/address/id — and returns
 * a single display/storage string (e.g. "alice" or "0xabc...").
 */
export function extractIdentityAddress(identity: unknown): string {
  if (typeof identity === 'string') return identity.trim()

  if (identity && typeof identity === 'object') {
    const candidate = identity as Record<string, unknown>
    const value = candidate.nametag ?? candidate.address ?? candidate.id ?? candidate.publicKey
    if (typeof value === 'string') return value.trim()
  }

  return ''
}

/**
 * Connects to Sphere Wallet (must be called from inside Sphere's iframe,
 * see isInsideSphere()) and returns the linked identity as a plain string.
 * Throws if not inside Sphere, if the user rejects the connection, or if
 * Sphere doesn't hand back a usable identity.
 */
export async function connectSphereWallet(dappDescription: string): Promise<string> {
  if (!isInsideSphere()) {
    throw new Error('Open this page inside Sphere Wallet to connect.')
  }

  const client = createSphereClient(dappDescription)
  const { identity } = await client.connect()
  const address = extractIdentityAddress(identity)

  if (!address) {
    throw new Error('Sphere Wallet did not return a usable identity.')
  }

  return address
}

// ---------------------------------------------------------------------------
// Popup mode (P3) — used when this page is a normal browser tab, not embedded
// inside Sphere's iframe. Opens sphere.unicity.network/connect in a small
// centered popup (same "Sign Message" approval dialog Sphere shows anywhere
// else) and talks to it over window.postMessage instead of window.parent.
// See Sphere's CONNECT.md → "Connection Modes" for the full P1/P2/P3 spec.
// ---------------------------------------------------------------------------

/**
 * Opens Sphere's own /connect page in a small centered popup window. Throws
 * if the browser blocked the popup (must be called directly from a user
 * gesture, e.g. a button's onClick, or the browser will block it).
 */
export function openSpherePopup(): Window {
  const width = 420
  const height = 640
  const left = Math.round(window.screenX + (window.outerWidth - width) / 2)
  const top = Math.round(window.screenY + (window.outerHeight - height) / 2)

  const url = `${SPHERE_CONNECT_URL}?origin=${encodeURIComponent(window.location.origin)}`
  const popup = window.open(
    url,
    'sphere-connect',
    `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes`,
  )

  if (!popup) {
    throw new Error('Popup blocked — please allow popups for this site and try again.')
  }

  return popup
}

/** Creates a ConnectClient wired to a popup window instead of a parent iframe. */
export function createPopupClient(dappDescription: string, popup: Window, resumeSessionId?: string) {
  console.log('Creating popup client:', {
    targetOrigin: window.location.origin,
    resumeSessionId: !!resumeSessionId,
  })

  return new ConnectClient({
    transport: PostMessageTransport.forClient({ 
      target: popup,
      targetOrigin: window.location.origin
    }),
    dapp: {
      name: 'UCT Pay Link',
      description: dappDescription,
      url: window.location.origin,
    },
    network: SPHERE_NETWORKS.testnet2,
    ...(resumeSessionId ? { resumeSessionId } : {}),
  })
}

export function saveSpherePopupSession(sessionId: string) {
  sessionStorage.setItem(POPUP_SESSION_KEY, sessionId)
}

export function clearSpherePopupSession() {
  sessionStorage.removeItem(POPUP_SESSION_KEY)
}

export function getSavedSpherePopupSession(): string | null {
  return sessionStorage.getItem(POPUP_SESSION_KEY)
}

/**
 * Connects to Sphere Wallet via a popup window — the fallback used whenever
 * this page is a normal tab rather than something opened inside Sphere's own
 * iframe. Opens sphere.unicity.network/connect, which shows the same
 * "Sign Message" approval dialog as any other Sphere connect flow, and
 * resolves with the linked identity once the user approves in that popup.
 *
 * Note: per Sphere's popup-mode spec, the popup must stay open for the
 * connection to keep working — closing it ends the session. The returned
 * `popup` handle lets the caller decide when to close it (e.g. right after a
 * one-off payment intent finishes, or keep it open for a longer session).
 */
export async function connectSphereWalletViaPopup(dappDescription: string): Promise<{
  address: string
  client: ConnectClient
  popup: Window
}> {
  const popup = openSpherePopup()

  try {
    // Wait for popup to fully load before creating client
    await new Promise(resolve => setTimeout(resolve, 1000))
    
    console.log('Creating popup client...', {
      popupOrigin: popup.location.origin,
      parentOrigin: window.location.origin,
    })

    const savedSession = getSavedSpherePopupSession() ?? undefined
    const client = createPopupClient(dappDescription, popup, savedSession)
    
    console.log('Waiting for client.connect()...')
    const { identity, sessionId } = await client.connect()
    
    console.log('Connected successfully!', { identity, sessionId })
    const address = extractIdentityAddress(identity)

    if (!address) {
      throw new Error('Sphere Wallet did not return a usable identity.')
    }

    if (sessionId) saveSpherePopupSession(sessionId)

    return { address, client, popup }
  } catch (err) {
    console.error('connectSphereWalletViaPopup failed:', err)
    clearSpherePopupSession()
    popup.close()
    throw err
  }
}
