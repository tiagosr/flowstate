import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './style.css'
import { App } from './App'

createRoot(document.getElementById('app')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// Use contextBridge
window.ipcRenderer.on('main-process-message', (_event, message) => {
  console.log(message)
})
