import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import { SettingsProvider } from './context/SettingsContext'
import { AuthProvider } from './context/AuthContext'
import { TVNavigationProvider } from './context/TVNavigationContext'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AuthProvider>
      <SettingsProvider>
        <TVNavigationProvider>
          <App />
        </TVNavigationProvider>
      </SettingsProvider>
    </AuthProvider>
  </React.StrictMode>,
)

// Use contextBridge
window.ipcRenderer?.on('main-process-message', (_event, message) => {
  console.log(message)
})
