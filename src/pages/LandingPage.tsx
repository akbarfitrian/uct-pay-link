import { useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import {
  FileSpreadsheet,
  Link2,
  MousePointerClick,
  RadioTower,
  Bot,
  ArrowRight,
} from 'lucide-react'
import Footer from '../components/Footer'
import './LandingPage.css'

const FEATURES = [
  {
    icon: FileSpreadsheet,
    title: 'Bulk Generation Efficiency',
    description:
      'Batch-create thousands of unique payment links instantly using a simple Excel/CSV template.',
  },
  {
    icon: Link2,
    title: 'Seamless Integration',
    description:
      'Fully compatible with native Web3 infrastructure like Sphere Wallet for friction-free client payments.',
  },
  {
    icon: MousePointerClick,
    title: 'Zero-Friction UX',
    description:
      'A minimalist, high-speed interface engineered specifically to optimize daily accounting operations.',
  },
  {
    icon: RadioTower,
    title: 'Real-time Reconciliation',
    description:
      'Instantly track and monitor incoming payments with live status updates for seamless internal bookkeeping.',
  },
]

export default function LandingPage() {
  const revealRefs = useRef<HTMLElement[]>([])

  useEffect(() => {
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (prefersReduced) {
      revealRefs.current.forEach((el) => el.classList.add('is-visible'))
      return
    }
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible')
            observer.unobserve(entry.target)
          }
        })
      },
      { threshold: 0.15 }
    )
    revealRefs.current.forEach((el) => el && observer.observe(el))
    return () => observer.disconnect()
  }, [])

  const addReveal = (el: HTMLElement | null) => {
    if (el && !revealRefs.current.includes(el)) revealRefs.current.push(el)
  }

  return (
    <div className="landing">
      {/* Navigation */}
      <nav className="landing-nav">
        <Link to="/" className="landing-logo">
          <img src="/logo.png" alt="Unicity Pay Link" className="landing-logo-icon" />
          <span>UNICITY PAY LINK</span>
        </Link>
        <div className="landing-nav-links">
          <Link to="/app" className="landing-btn landing-btn-primary landing-btn-nav">
            Launch App
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <header className="hero">
        <div className="hero-copy">
          <p className="hero-eyebrow">Powered by Unicity Labs</p>
          <h1 className="hero-headline">
            Massive Crypto Invoicing for Businesses, Simplified.
          </h1>
          <p className="hero-subhead">
            Generate and distribute hundreds of Web3 payment links and QR codes to
            your clients in a single click. Fast, secure, and built for modern
            agents.
          </p>
          <div className="hero-actions">
            <Link to="/app" className="landing-btn landing-btn-primary landing-btn-lg">
              Launch App
              <ArrowRight size={18} strokeWidth={2.25} />
            </Link>
          </div>
        </div>

        <div className="hero-visual" aria-hidden="true">
          <div className="hero-card">
            <div className="hero-card-row">
              <span className="hero-card-label">Payment Link</span>
              <span className="hero-card-status">Paid</span>
            </div>
            <div className="hero-card-amount">
              <span className="hero-card-figure">1,250</span>
              <span className="hero-card-coin">USDC</span>
            </div>
            <div className="hero-card-address">@moriganarcy</div>
            <div className="hero-card-divider" />
            <div className="hero-card-qr">
              <div className="hero-card-qr-grid">
                {Array.from({ length: 49 }).map((_, i) => (
                  <span key={i} className={Math.random() > 0.58 ? 'on' : ''} />
                ))}
              </div>
            </div>
          </div>
          <div className="hero-card hero-card-back" />
        </div>
      </header>

      {/* Value Proposition / Features */}
      <section className="features" ref={addReveal}>
        <div className="section-heading">
          <h2>Built for high-volume, everyday invoicing</h2>
          <p>Everything a finance team needs to move from spreadsheet to settlement.</p>
        </div>
        <div className="features-grid">
          {FEATURES.map(({ icon: Icon, title, description }) => (
            <div className="feature-card" key={title}>
              <div className="feature-icon">
                <Icon size={22} strokeWidth={2} />
              </div>
              <h3>{title}</h3>
              <p>{description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Roadmap */}
      <section className="roadmap" ref={addReveal}>
        <div className="roadmap-card">
          <div className="roadmap-icon">
            <Bot size={26} strokeWidth={1.75} />
          </div>
          <div className="roadmap-copy">
            <span className="roadmap-badge">Coming Soon</span>
            <h3>AI Agent Integration</h3>
            <p>
              Invoicing powered by natural language. Soon, corporate agents will be
              able to simply type a command directly to an AI agent (like Claude) to
              automatically parse client data, generate payment links, and
              distribute them across channels instantly — without manual
              spreadsheet uploads.
            </p>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  )
}
