import { Twitter, Github } from 'lucide-react'

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
            title="Twitter"
          >
            <Twitter size={18} />
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
