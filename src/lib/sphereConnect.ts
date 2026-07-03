import {
  ConnectClient,
  SPHERE_NETWORKS,
  type ConnectTransport,
  type SphereConnectMessage,
  isSphereConnectMessage,
} from '@unicitylabs/sphere-sdk/connect'

export const SPHERE_ORIGIN = 'https://sphere.unicity.network'
export const SPHERE_AGENT_BASE = `${SPHERE_ORIGIN}/agents/custom`

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
