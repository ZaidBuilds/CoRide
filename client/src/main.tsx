import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { initTheme } from './utils/theme'
import { installNativeBackButton } from './utils/nativeBridge'

// Before render, so the app never paints the wrong palette and the Android
// system bars match from the first frame.
initTheme()
installNativeBackButton()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
