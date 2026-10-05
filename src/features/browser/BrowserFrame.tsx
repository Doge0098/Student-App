import { platform } from '../../platform'

const IFRAME_SANDBOX =
  'allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-presentation allow-modals allow-downloads allow-storage-access-by-user-activation'

export interface BrowserFrameProps {
  src: string
  title: string
  hidden: boolean
  /**
   * Solo en escritorio: la página ha cambiado de dirección o de título (el estudiante ha
   * pulsado un enlace dentro). En la web los navegadores no dejan saberlo.
   */
  onNavigate?: (url: string, title: string) => void
}

/** Página web mostrada dentro de LockIn: iframe en la web; en escritorio, una vista completa. */
export function BrowserFrame({ src, title, hidden }: BrowserFrameProps) {
  if (platform.isDesktop) {
    // La versión de escritorio la implementa desktop/ (webview de Electron).
  }
  return (
    <iframe
      src={src}
      title={title}
      hidden={hidden}
      sandbox={IFRAME_SANDBOX}
      allow="autoplay; encrypted-media; picture-in-picture; fullscreen; clipboard-write"
      referrerPolicy="strict-origin-when-cross-origin"
      className="browser-frame"
    />
  )
}
