import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// Anek variable fonts with BOTH axes (weight 100-800, width 75-125%): the
// wdth.css entry is the full-axes build. Bundled so it works offline.
import '@fontsource-variable/anek-latin/wdth.css'
import '@fontsource-variable/anek-devanagari/wdth.css'
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
