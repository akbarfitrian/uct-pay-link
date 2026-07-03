import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import { QuestsProvider } from './context/QuestsContext'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QuestsProvider>
      <App />
    </QuestsProvider>
  </React.StrictMode>,
)
