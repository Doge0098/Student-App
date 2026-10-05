import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// La base común va primero: así el CSS propio de cada función puede ajustarla.
import './styles.css'
import App from './App'
import { platform } from './platform'
import { captureInstallPrompt, registerServiceWorker } from './platform/install'

captureInstallPrompt()
// En desarrollo no se usa para no guardar versiones viejas; en escritorio no hace falta.
if (import.meta.env.PROD && !platform.isDesktop) registerServiceWorker()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
