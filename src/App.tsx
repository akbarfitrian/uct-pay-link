import { BrowserRouter, Routes, Route, Link } from 'react-router-dom'
import LandingPage from './pages/LandingPage'
import GeneratorPage from './pages/GeneratorPage'
import PayPage from './pages/PayPage'
import Footer from './components/Footer'
import ThemeToggle from './components/ThemeToggle'
import QuestWidget from './components/QuestWidget'
import './App.css'

/** Shared chrome (nav + footer) for the working app screens */
function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <nav className="navbar">
        <Link to="/" className="logo" style={{ textDecoration: 'none' }}>
          <img src="/logo.png" alt="UCT Pay Link" className="logo-icon" />
          UNICITY PAY LINK
        </Link>
        <div className="nav-right">
          <div className="nav-links">
            <a href="https://sphere.unicity.network" target="_blank" rel="noreferrer">
              Sphere Wallet
            </a>
          </div>
          <QuestWidget />
          <ThemeToggle />
        </div>
      </nav>

      <main className="main-content">{children}</main>

      <Footer />
    </>
  )
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route
          path="/app"
          element={
            <AppLayout>
              <GeneratorPage />
            </AppLayout>
          }
        />
        <Route
          path="/pay"
          element={
            <AppLayout>
              <PayPage />
            </AppLayout>
          }
        />
      </Routes>
    </BrowserRouter>
  )
}

export default App
