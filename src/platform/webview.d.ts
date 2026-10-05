/**
 * Lo que usa LockIn de la etiqueta <webview> de Electron (solo existe en la versión de escritorio).
 * Ver https://www.electronjs.org/docs/latest/api/webview-tag
 */

export interface WebviewElement extends HTMLElement {
  src: string
  /** Solo se pueden llamar después del primer «dom-ready». */
  getURL(): string
  getTitle(): string
  loadURL(url: string): Promise<void>
  reload(): void
  stop(): void
  canGoBack(): boolean
  canGoForward(): boolean
  goBack(): void
  goForward(): void
}

/** «did-navigate»: la página principal ha cambiado. */
export interface WebviewNavigateEvent extends Event {
  url: string
}

/** «did-navigate-in-page»: cambio de dirección sin recargar (#ancla, apps de una sola página). */
export interface WebviewInPageNavigateEvent extends Event {
  url: string
  isMainFrame: boolean
}

/** «page-title-updated». `explicitSet` es false si la página no tiene <title>. */
export interface WebviewTitleEvent extends Event {
  title: string
  explicitSet: boolean
}
