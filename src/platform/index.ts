/**
 * Todo lo que cambia entre la versión web y la futura versión de escritorio pasa por aquí.
 *
 * La versión de escritorio (Electron) expondrá `window.studentAppDesktop` desde su script de
 * precarga. Con ese puente la app podrá mostrar cualquier web dentro (sin las limitaciones de los
 * iframes), abrir programas instalados, etc. Sin él, se usa lo que permite un navegador normal.
 */
export interface DesktopBridge {
  version: string
  /** Abre un enlace en el navegador del sistema. */
  openExternal: (url: string) => void
}

declare global {
  interface Window {
    studentAppDesktop?: DesktopBridge
  }
}

function bridge(): DesktopBridge | undefined {
  return typeof window === 'undefined' ? undefined : window.studentAppDesktop
}

export const platform = {
  get isDesktop(): boolean {
    return Boolean(bridge())
  },

  /** En escritorio cualquier web se puede ver dentro de la app; en la web solo las que lo permiten. */
  get canEmbedAnySite(): boolean {
    return Boolean(bridge())
  },

  /** ¿Se está usando como app instalada (PWA o escritorio)? */
  get isInstalled(): boolean {
    return Boolean(bridge()) || window.matchMedia('(display-mode: standalone)').matches
  },

  openExternal(url: string): void {
    const desktop = bridge()
    if (desktop) desktop.openExternal(url)
    else window.open(url, '_blank', 'noopener,noreferrer')
  },
}
