interface IconProps {
  size?: number
}

/** Minimal brand glyphs — kept as inline SVG so no extra icon-library dependency is needed. */
function WhatsAppIcon({ size = 16 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12.004 2.003c-5.514 0-9.997 4.483-9.997 9.997 0 1.762.462 3.483 1.34 4.997L2 22l5.117-1.342a9.96 9.96 0 0 0 4.887 1.244h.004c5.514 0 9.997-4.483 9.997-9.997 0-2.67-1.04-5.18-2.928-7.068a9.935 9.935 0 0 0-7.073-2.834zm0 18.174h-.003a8.15 8.15 0 0 1-4.152-1.137l-.298-.177-3.036.796.81-2.96-.194-.304a8.15 8.15 0 0 1-1.253-4.395c0-4.508 3.669-8.176 8.18-8.176a8.12 8.12 0 0 1 5.786 2.398 8.12 8.12 0 0 1 2.393 5.784c-.001 4.508-3.67 8.171-8.233 8.171z" />
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" />
    </svg>
  )
}

function TelegramIcon({ size = 16 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2zm4.94 6.86-1.66 7.84c-.125.56-.457.696-.927.433l-2.56-1.887-1.235 1.19c-.137.137-.293.252-.556.252l.196-2.792 5.086-4.594c.221-.196-.048-.306-.342-.11l-6.286 3.958-2.708-.846c-.588-.184-.6-.588.123-.87l10.58-4.077c.49-.178.918.11.79.94z" />
    </svg>
  )
}

export type ShareChannel = 'whatsapp' | 'telegram'

interface ShareButtonsProps {
  /** The payment link being shared. */
  link: string
  /** Optional message sent alongside the link (e.g. "Payment request: 10 UCT for @alice"). */
  message?: string
  /**
   * 'full' renders two labeled, full-width buttons (Express preview card).
   * 'icon' renders two compact icon-only buttons (Bulk table rows).
   */
  variant?: 'full' | 'icon'
  /** Fired after a share window is opened — handy for quest/analytics tracking. */
  onShare?: (channel: ShareChannel) => void
}

/**
 * Direct-share buttons for WhatsApp and Telegram.
 *
 * Both platforms are opened via their public web share endpoints (no app
 * install, SDK, or API key required) — this works identically on desktop
 * (opens web.whatsapp.com / web.telegram.org, or the desktop app if
 * registered as the URL handler) and mobile (opens the native app directly
 * via its universal link).
 */
export default function ShareButtons({ link, message, variant = 'full', onShare }: ShareButtonsProps) {
  // Both platforms get the exact same message shape: caption first, link LAST,
  // nothing after it. This matters more than it sounds like it should — some
  // WhatsApp/Telegram clients auto-linkify a URL that's immediately followed
  // by more text (even on its own line, separated by a single "\n") by
  // extending the link's boundary into that trailing text instead of
  // stopping at the line break. Putting the link at the very end means
  // there's nothing left for that boundary bug to swallow.
  //
  // Telegram's own share widget (t.me/share/url?url=...&text=...) composes
  // the message as "{url}\n{text}" — i.e. the opposite, unsafe order, with
  // our caption trailing the link — so instead of relying on its `text`
  // param at all, everything is folded into one string and passed via
  // `text` only, with `url` left empty.
  const shareText = message ? `${message}\n${link}` : link
  const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(shareText)}`
  const telegramUrl = `https://t.me/share/url?url=&text=${encodeURIComponent(shareText)}`

  const openShare = (channel: ShareChannel, url: string) => {
    window.open(url, '_blank', 'noopener,noreferrer')
    onShare?.(channel)
  }

  if (variant === 'icon') {
    return (
      <>
        <button
          type="button"
          className="link-share-btn link-share-whatsapp"
          title="Share via WhatsApp"
          aria-label="Share via WhatsApp"
          onClick={() => openShare('whatsapp', whatsappUrl)}
        >
          <WhatsAppIcon size={14} />
        </button>
        <button
          type="button"
          className="link-share-btn link-share-telegram"
          title="Share via Telegram"
          aria-label="Share via Telegram"
          onClick={() => openShare('telegram', telegramUrl)}
        >
          <TelegramIcon size={14} />
        </button>
      </>
    )
  }

  return (
    <div className="share-row">
      <button
        type="button"
        className="btn-share btn-share-whatsapp"
        onClick={() => openShare('whatsapp', whatsappUrl)}
      >
        <WhatsAppIcon size={18} />
        WhatsApp
      </button>
      <button
        type="button"
        className="btn-share btn-share-telegram"
        onClick={() => openShare('telegram', telegramUrl)}
      >
        <TelegramIcon size={18} />
        Telegram
      </button>
    </div>
  )
}
