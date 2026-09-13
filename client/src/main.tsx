import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { initTheme } from './utils/theme'
import { initializeNativeApp } from './utils/nativeBridge'

// Before render, so the app never paints the wrong palette first.
initTheme()
initializeNativeApp()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
