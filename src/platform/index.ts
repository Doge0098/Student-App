/**
 * Todo lo que cambia entre la versión web y la versión de escritorio pasa por aquí.
 *
 * La versión de escritorio (Electron, carpeta desktop/) expone `window.lockinDesktop` desde su
 * script de precarga. Con ese puente la app muestra cualquier web dentro (pestañas <webview>, sin
 * las limitaciones de los iframes), sabe qué página ve el estudiante y abre los enlaces externos en
 * el navegador del sistema. Sin él, se usa lo que permite un navegador normal.
 */
export interface DesktopBridge {
  version: string
  /** Sistema operativo ('win32', 'darwin', 'linux'). */
  platform?: string
  /** Abre un enlace en el navegador del sistema. */
  openExternal: (url: string) => void
  /** Webs (dominios) que no se pueden abrir ahora dentro de las pestañas, ni siguiendo enlaces. */
  setBlockedSites: (hosts: string[]) => void
  /** Avisa cuando se ha impedido abrir una web bloqueada. Devuelve la función para dejar de escuchar. */
  onBlockedNavigation: (callback: (url: string) => void) => () => void
  /**
   * Una web abierta en una pestaña pide abrir un enlace en una pestaña nueva (target=_blank,
   * window.open, «Abrir enlace en una pestaña nueva» del botón derecho). Devuelve la función para
   * dejar de escuchar. Si nadie escucha, el enlace se abre en el navegador del sistema.
   */
  onOpenTab?: (callback: (url: string) => void) => () => void
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

  /** Versión de LockIn para ordenador (null en la web). */
  get desktopVersion(): string | null {
    return bridge()?.version || null
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

  /** Solo escritorio: una web pide abrir un enlace en una pestaña nueva de LockIn (ver DesktopBridge). */
  onOpenTab(callback: (url: string) => void): () => void {
    return bridge()?.onOpenTab?.(callback) ?? (() => {})
  },
}
