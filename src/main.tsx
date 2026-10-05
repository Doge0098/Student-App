import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { platform } from './platform'
import { captureInstallPrompt, registerServiceWorker } from './platform/install'
import './styles.css'

captureInstallPrompt()
// En desarrollo no se usa para no guardar versiones viejas; en escritorio no hace falta.
if (import.meta.env.PROD && !platform.isDesktop) registerServiceWorker()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
