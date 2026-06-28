import { BrowserRouter, Routes, Route, Link } from 'react-router-dom'
import GeneratorPage from './pages/GeneratorPage'
import PayPage from './pages/PayPage'
import './App.css'

function App() {
  return (
    <BrowserRouter>
      <nav className="navbar">
        <span className="logo">⚡ UCT Pay Link</span>
        <div className="nav-links">
          <Link to="/">Create Link</Link>
          <a href="https://sphere.unicity.network" target="_blank" rel="noreferrer">
            Sphere Wallet ↗
          </a>
        </div>
      </nav>

      <main className="main-content">
        <Routes>
          <Route path="/" element={<GeneratorPage />} />
          <Route path="/pay" element={<PayPage />} />
        </Routes>
      </main>
    </BrowserRouter>
  )
}

export default App
