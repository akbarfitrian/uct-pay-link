import {
  ConnectClient,
  SPHERE_NETWORKS,
  type ConnectTransport,
  type SphereConnectMessage,
  isSphereConnectMessage,
} from '@unicitylabs/sphere-sdk/connect'

export const SPHERE_ORIGIN = 'https://sphere.unicity.network'
export const SPHERE_AGENT_BASE = `${SPHERE_ORIGIN}/agents/custom`
export const SPHERE_CONNECT_URL = `${SPHERE_ORIGIN}/connect`

const POPUP_SESSION_KEY = 'sphere-connect-popup-session'

export function isInsideSphere(): boolean {
  return window !== window.parent
}

export function sphereAgentUrl(targetUrl: string = window.location.href): string {
  return `${SPHERE_AGENT_BASE}?url=${encodeURIComponent(targetUrl)}`
}

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

function createPopupTransport(popup: Window): ConnectTransport {
  const handlers: Set<(msg: SphereConnectMessage) => void> = new Set()
  let messageHandler: ((e: MessageEvent) => void) | null = null

  const setupListener = () => {
    messageHandler = (e: MessageEvent) => {
      if (isSphereConnectMessage(e.data)) {
        for (const handler of handlers) {
          try {
            handler(e.data)
          } catch (err) {
            console.error('Handler error:', err)
          }
        }
      }
    }
    window.addEventListener('message', messageHandler)
  }

  setupListener()

  return {
    send(msg: SphereConnectMessage) {
      popup.postMessage(msg, SPHERE_ORIGIN)
    },
    onMessage(handler: (msg: SphereConnectMessage) => void) {
      handlers.add(handler)
      return () => {
        handlers.delete(handler)
      }
    },
    destroy() {
      handlers.clear()
      if (messageHandler) {
        window.removeEventListener('message', messageHandler)
      }
    },
  }
}

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

export function extractIdentityAddress(identity: unknown): string {
  if (typeof identity === 'string') return identity.trim()

  if (identity && typeof identity === 'object') {
    const candidate = identity as Record<string, unknown>
    const value = candidate.nametag ?? candidate.address ?? candidate.id ?? candidate.publicKey
    if (typeof value === 'string') return value.trim()
  }

  return ''
}

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

export function createPopupClient(dappDescription: string, popup: Window, resumeSessionId?: string) {
  return new ConnectClient({
    transport: createPopupTransport(popup),
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

export async function connectSphereWalletViaPopup(dappDescription: string): Promise<{
  address: string
  client: ConnectClient
  popup: Window
}> {
  const popup = openSpherePopup()

  try {
    await new Promise(resolve => setTimeout(resolve, 800))

    const savedSession = getSavedSpherePopupSession() ?? undefined
    const client = createPopupClient(dappDescription, popup, savedSession)
    
    const { identity, sessionId } = await client.connect()
    const address = extractIdentityAddress(identity)

    if (!address) {
      throw new Error('Sphere Wallet did not return a usable identity.')
    }

    if (sessionId) saveSpherePopupSession(sessionId)

    return { address, client, popup }
  } catch (err) {
    console.error('Wallet connection failed:', err)
    clearSpherePopupSession()
    popup.close()
    throw err
  }
}