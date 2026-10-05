/**
 * Estado compartido del proceso principal: la ventana de la app (la «carcasa») y los dominios
 * bloqueados ahora mismo por el modo Estricto.
 */
import type { WebContents } from 'electron'
import { createRepeatFilter, normalizeHosts } from './policy'

/** Canales IPC. El preload tiene una copia (en modo sandbox no puede importar archivos propios). */
export const CHANNELS = {
  openExternal: 'lockin:open-external',
  setBlockedSites: 'lockin:set-blocked-sites',
  blockedNavigation: 'lockin:blocked-navigation',
  openTab: 'lockin:open-tab',
} as const

let shellContents: WebContents | null = null
let blockedHosts: string[] = []
const shouldNotify = createRepeatFilter(1500)

export function setShell(contents: WebContents | null): void {
  shellContents = contents
}

export function getShell(): WebContents | null {
  return shellContents && !shellContents.isDestroyed() ? shellContents : null
}

export function getBlockedHosts(): readonly string[] {
  return blockedHosts
}

/** Lista que manda la app (se limpia: solo dominios válidos). */
export function setBlockedHosts(input: unknown): void {
  blockedHosts = normalizeHosts(input)
}

/** Avisa a la app de que se ha impedido abrir una web bloqueada (una vez por intento). */
export function notifyBlocked(url: string): void {
  if (shouldNotify(url)) getShell()?.send(CHANNELS.blockedNavigation, url)
}

/** Pide a la app que abra el enlace en una pestaña nueva (allí se aplican avisos e historial). */
export function requestTab(url: string): void {
  getShell()?.send(CHANNELS.openTab, url)
}
