import { useEffect, useRef } from 'react'
import { platform } from '../../platform'
import type {
  WebviewElement,
  WebviewInPageNavigateEvent,
  WebviewNavigateEvent,
  WebviewTitleEvent,
} from '../../platform/webview'

const IFRAME_SANDBOX =
  'allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-presentation allow-modals allow-downloads allow-storage-access-by-user-activation'

/** Sesión de las webs en escritorio (cookies e inicios de sesión de las pestañas). Ver desktop/src/policy.ts. */
const WEB_PARTITION = 'persist:lockin-web'

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
export function BrowserFrame(props: BrowserFrameProps) {
  return platform.isDesktop ? <DesktopFrame {...props} /> : <WebFrame {...props} />
}

function WebFrame({ src, title, hidden }: BrowserFrameProps) {
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

/**
 * Escritorio: <webview> de Electron (cualquier web, también las que no se dejan meter en un iframe).
 * Se crea a mano una sola vez para que React no la vuelva a montar: al ocultar la pestaña solo se
 * oculta su contenedor y la página conserva su estado (vídeo, scroll, lo escrito...).
 * Las reglas de seguridad (sin Node, sesión aparte, webs bloqueadas) las impone desktop/src/guards.ts.
 */
function DesktopFrame({ src, title, hidden, onNavigate }: BrowserFrameProps) {
  const hostRef = useRef<HTMLDivElement>(null)
  const viewRef = useRef<WebviewElement | null>(null)
  // Dirección que se le ha pedido a la vista (al navegar dentro no cambia: no se recarga).
  const initialSrc = useRef(src)
  const navigateRef = useRef(onNavigate)

  useEffect(() => {
    navigateRef.current = onNavigate
  })

  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    const view = document.createElement('webview') as WebviewElement
    view.setAttribute('partition', WEB_PARTITION)
    // Las ventanas nuevas las decide el proceso principal (pestaña de LockIn o ventana emergente).
    view.setAttribute('allowpopups', '')
    view.setAttribute('src', initialSrc.current)
    view.style.width = '100%'
    view.style.height = '100%'

    // Se avisa una vez por página, ya con su título (o al estar lista, si no tiene).
    let url = initialSrc.current
    let pageTitle = ''
    let pending = false
    const report = () => navigateRef.current?.(url, pageTitle)

    const onNavigated = (event: Event) => {
      url = (event as WebviewNavigateEvent).url
      pageTitle = ''
      pending = true
    }
    const onTitle = (event: Event) => {
      const e = event as WebviewTitleEvent
      if (!e.explicitSet || (e.title === pageTitle && !pending)) return
      pageTitle = e.title
      pending = false
      report()
    }
    const onReady = () => {
      if (!pending) return
      pending = false
      report()
    }
    const onInPage = (event: Event) => {
      const e = event as WebviewInPageNavigateEvent
      if (!e.isMainFrame || e.url === url) return
      url = e.url
      report()
    }

    view.addEventListener('did-navigate', onNavigated)
    view.addEventListener('page-title-updated', onTitle)
    view.addEventListener('dom-ready', onReady)
    view.addEventListener('did-navigate-in-page', onInPage)
    host.appendChild(view)
    viewRef.current = view

    return () => {
      view.removeEventListener('did-navigate', onNavigated)
      view.removeEventListener('page-title-updated', onTitle)
      view.removeEventListener('dom-ready', onReady)
      view.removeEventListener('did-navigate-in-page', onInPage)
      view.remove()
      viewRef.current = null
    }
  }, [])

  // Si la pestaña pide otra dirección (no pasa al navegar dentro), se carga en la misma vista.
  useEffect(() => {
    const view = viewRef.current
    if (!view || src === initialSrc.current) return
    initialSrc.current = src
    view.setAttribute('src', src)
  }, [src])

  useEffect(() => {
    viewRef.current?.setAttribute('aria-label', title)
  }, [title])

  return <div ref={hostRef} className="browser-frame" hidden={hidden} />
}
