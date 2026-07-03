export default function Footer() {
  return (
    <footer className="footer">
      <div className="footer-content">
        <span className="footer-text">
          Powered by{' '}
          <a
            href="https://www.unicity.ai/"
            target="_blank"
            rel="noreferrer"
            className="footer-brand-link"
          >
            Unicity Labs
          </a>
        </span>
        <div className="footer-links">
          <a 
            href="https://x.com/uctpaylink" 
            target="_blank" 
            rel="noreferrer"
            className="footer-link"
            title="X (Twitter)"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 4l16 16M4 20l16-16"/>
            </svg>
          </a>
        </div>
      </div>
    </footer>
  )
}
