/**
 * Puente entre la app y el ordenador: window.lockinDesktop (ver src/platform/index.ts en la raíz).
 *
 * Se ejecuta en modo sandbox: solo puede usar `electron` (contextBridge, ipcRenderer), nada de
 * archivos propios. Por eso los nombres de los canales están copiados de state.ts.
 */
import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'

const CHANNELS = {
  openExternal: 'lockin:open-external',
  setBlockedSites: 'lockin:set-blocked-sites',
  blockedNavigation: 'lockin:blocked-navigation',
  openTab: 'lockin:open-tab',
} as const

type UrlCallback = (url: string) => void

function readVersion(): string {
  const prefix = '--lockin-version='
  const arg = process.argv.find((a) => a.startsWith(prefix))
  return arg ? arg.slice(prefix.length) : ''
}

function listen(channel: string, callback: unknown): () => void {
  if (typeof callback !== 'function') return () => {}
  const listener = (_event: IpcRendererEvent, url: unknown) => {
    if (typeof url === 'string') (callback as UrlCallback)(url)
  }
  ipcRenderer.on(channel, listener)
  return () => {
    ipcRenderer.removeListener(channel, listener)
  }
}

// Enlaces «en pestaña nueva» de las webs: los abre el navegador de LockIn. Si la app aún no
// escucha (versión antigua de la web), se abren en el navegador del sistema para no perderlos.
const openTabListeners = new Set<UrlCallback>()
ipcRenderer.on(CHANNELS.openTab, (_event: IpcRendererEvent, url: unknown) => {
  if (typeof url !== 'string') return
  if (openTabListeners.size === 0) ipcRenderer.send(CHANNELS.openExternal, url)
  else for (const callback of openTabListeners) callback(url)
})

contextBridge.exposeInMainWorld('lockinDesktop', {
  version: readVersion(),
  platform: process.platform,
  openExternal: (url: unknown) => {
    if (typeof url === 'string') ipcRenderer.send(CHANNELS.openExternal, url)
  },
  setBlockedSites: (hosts: unknown) => {
    const list = Array.isArray(hosts) ? hosts.filter((h): h is string => typeof h === 'string') : []
    ipcRenderer.send(CHANNELS.setBlockedSites, list)
  },
  onBlockedNavigation: (callback: unknown) => listen(CHANNELS.blockedNavigation, callback),
  onOpenTab: (callback: unknown) => {
    if (typeof callback !== 'function') return () => {}
    const fn = callback as UrlCallback
    openTabListeners.add(fn)
    return () => {
      openTabListeners.delete(fn)
    }
  },
})
