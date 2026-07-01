import { Github } from 'lucide-react'

export default function Footer() {
  return (
    <footer className="footer">
      <div className="footer-content">
        <span className="footer-text">Powered by Unicity Labs</span>
        <div className="footer-links">
          <a 
            href="https://x.com/moriganarcy" 
            target="_blank" 
            rel="noreferrer"
            className="footer-link"
            title="X (Twitter)"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 4l16 16M4 20l16-16"/>
            </svg>
          </a>
          <a 
            href="https://github.com/akbarfitrian" 
            target="_blank" 
            rel="noreferrer"
            className="footer-link"
            title="GitHub"
          >
            <Github size={18} />
          </a>
        </div>
      </div>
    </footer>
  )
}
