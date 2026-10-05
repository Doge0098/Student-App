/**
 * Todo lo que cambia entre la versión web y la futura versión de escritorio pasa por aquí.
 *
 * La versión de escritorio (Electron) expondrá `window.lockinDesktop` desde su script de
 * precarga. Con ese puente la app podrá mostrar cualquier web dentro (sin las limitaciones de los
 * iframes), abrir programas instalados, etc. Sin él, se usa lo que permite un navegador normal.
 */
export interface DesktopBridge {
  version: string
  /** Abre un enlace en el navegador del sistema. */
  openExternal: (url: string) => void
  /** Webs (dominios) que no se pueden abrir ahora dentro de las pestañas, ni siguiendo enlaces. */
  setBlockedSites: (hosts: string[]) => void
  /** Avisa cuando se ha impedido abrir una web bloqueada. Devuelve la función para dejar de escuchar. */
  onBlockedNavigation: (callback: (url: string) => void) => () => void
}

declare global {
  interface Window {
    lockinDesktop?: DesktopBridge
  }
}

function bridge(): DesktopBridge | undefined {
  return typeof window === 'undefined' ? undefined : window.lockinDesktop
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

  /**
   * Modo Estricto: estas webs quedan bloqueadas dentro de las pestañas (también al pulsar enlaces).
   * Solo tiene efecto en escritorio; en la web el navegador no deja vigilar los enlaces de otras webs.
   */
  setBlockedSites(hosts: string[]): void {
    bridge()?.setBlockedSites(hosts)
  },

  onBlockedNavigation(callback: (url: string) => void): () => void {
    return bridge()?.onBlockedNavigation(callback) ?? (() => {})
  },
}
