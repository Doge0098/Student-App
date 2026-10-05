/**
 * Vigilancia de cada «webContents»: la ventana de la app y las webs (pestañas y ventanas emergentes).
 * Sigue la lista de seguridad de Electron: nada de Node en las webs, navegación controlada,
 * ventanas nuevas controladas y ninguna web puede crear <webview>.
 */
import {
  app,
  BrowserWindow,
  clipboard,
  Menu,
  shell,
  type BrowserWindowConstructorOptions,
  type ContextMenuParams,
  type MenuItemConstructorOptions,
  type WebContents,
  type WebPreferences,
} from 'electron'
import {
  decideGuestNavigation,
  decideGuestPopup,
  decideShellNavigation,
  decideShellPopup,
  findBlockedHost,
  isAppUrl,
  isWebUrl,
  loginSessionFor,
  parseWebUrl,
  tabShortcut,
  WEB_PARTITION,
} from './policy'
import { getBlockedHosts, getShell, notifyBlocked, requestTab } from './state'

/** Preferencias seguras para cualquier página web. */
export function safeWebPreferences(): WebPreferences {
  return {
    nodeIntegration: false,
    nodeIntegrationInSubFrames: false,
    nodeIntegrationInWorker: false,
    contextIsolation: true,
    sandbox: true,
    webSecurity: true,
    allowRunningInsecureContent: false,
    experimentalFeatures: false,
    webviewTag: false,
    navigateOnDragDrop: false,
    safeDialogs: true,
    spellcheck: true,
    devTools: !app.isPackaged,
  }
}

/** Abre una dirección web en el navegador del sistema (solo http y https). */
export function openExternalSafe(raw: unknown): void {
  const url = parseWebUrl(raw)
  if (url) void shell.openExternal(url.href).catch(() => {})
}

function shellWindow(): BrowserWindow | undefined {
  const contents = getShell()
  return (contents && BrowserWindow.fromWebContents(contents)) || undefined
}

/* ------------------------------------------------------------------ */
/* Webs: pestañas <webview> y ventanas emergentes                      */
/* ------------------------------------------------------------------ */

const guarded = new WeakSet<WebContents>()

/** Aplica las reglas de las webs a un webContents (se puede llamar varias veces). */
export function guardWebContents(contents: WebContents): void {
  if (guarded.has(contents)) return
  guarded.add(contents)

  const checkNavigation = (event: Electron.Event, url: string, isMainFrame: boolean) => {
    const decision = decideGuestNavigation(url, isMainFrame, getBlockedHosts())
    if (decision === 'allow') return
    event.preventDefault()
    if (decision === 'blocked') notifyBlocked(url)
  }
  // Enlaces pulsados, formularios y scripts de la página (en cualquier marco).
  contents.on('will-frame-navigate', (event) => checkNavigation(event, event.url, event.isMainFrame))
  // Redirecciones (p. ej. un acortador que lleva a una web bloqueada).
  contents.on('will-redirect', (event) => checkNavigation(event, event.url, event.isMainFrame))

  contents.setWindowOpenHandler(({ url, disposition }) => {
    switch (decideGuestPopup(url, disposition, getBlockedHosts())) {
      case 'blocked':
        notifyBlocked(url)
        return { action: 'deny' }
      case 'tab':
        requestTab(url)
        return { action: 'deny' }
      case 'popup':
        // Ventana emergente de verdad (inicio de sesión con Google en otra web, compartir…):
        // la web necesita seguir conectada con ella (window.opener), así que se abre aquí mismo.
        return { action: 'allow', overrideBrowserWindowOptions: popupWindowOptions() }
      default:
        return { action: 'deny' }
    }
  })
  contents.on('did-create-window', (win) => guardWebContents(win.webContents))

  // Ninguna web puede crear sus propias <webview>.
  contents.on('will-attach-webview', (event) => event.preventDefault())

  contents.on('context-menu', (_event, params) => showContextMenu(contents, params, true))

  contents.on('before-input-event', (event, input) => {
    const action = tabShortcut(input, process.platform)
    if (!action) return
    const history = contents.navigationHistory
    event.preventDefault()
    if (action === 'back' && history.canGoBack()) history.goBack()
    else if (action === 'forward' && history.canGoForward()) history.goForward()
    else if (action === 'reload') contents.reload()
  })
}

function popupWindowOptions(): BrowserWindowConstructorOptions {
  return {
    width: 520,
    height: 720,
    autoHideMenuBar: true,
    backgroundColor: '#ffffff',
    webPreferences: safeWebPreferences(),
  }
}

/* ------------------------------------------------------------------ */
/* Ventanas de inicio de sesión pedidas por la app                     */
/* ------------------------------------------------------------------ */

const loginWindows = new Map<'shell' | 'web', BrowserWindow>()

/**
 * Inicio de sesión de Google o Spotify (botón «Iniciar sesión» de LockIn). Se hace en la página
 * oficial, en una ventana de LockIn que comparte sesión con las pestañas (Google) o con el
 * reproductor de música (Spotify), para que la cuenta sirva dentro de la app.
 */
export function openLoginWindow(url: string): void {
  const kind = loginSessionFor(url)
  const existing = loginWindows.get(kind)
  if (existing && !existing.isDestroyed()) {
    void existing.loadURL(url)
    existing.focus()
    return
  }
  const parent = shellWindow()
  const win = new BrowserWindow({
    ...popupWindowOptions(),
    parent,
    title: 'Iniciar sesión',
    webPreferences: {
      ...safeWebPreferences(),
      // Spotify: la sesión de la app (su reproductor está en el panel de Música). Lo demás: la de las pestañas.
      ...(kind === 'web' ? { partition: WEB_PARTITION } : {}),
    },
  })
  loginWindows.set(kind, win)
  win.on('closed', () => {
    if (loginWindows.get(kind) === win) loginWindows.delete(kind)
  })
  guardWebContents(win.webContents)
  void win.loadURL(url)
}

/* ------------------------------------------------------------------ */
/* La ventana de la app                                                */
/* ------------------------------------------------------------------ */

export function guardShell(contents: WebContents): void {
  // La app nunca sale de app://lockin/. Un enlace web suelto se abre en el navegador del sistema.
  contents.on('will-frame-navigate', (event) => {
    if (!event.isMainFrame) return
    const decision = decideShellNavigation(event.url)
    if (decision === 'allow') return
    event.preventDefault()
    if (decision === 'external') openExternalSafe(event.url)
  })
  contents.on('will-redirect', (event) => {
    if (event.isMainFrame && !isAppUrl(event.url)) event.preventDefault()
  })

  contents.setWindowOpenHandler(({ url, disposition }) => {
    const decision = decideShellPopup(url, disposition)
    if (decision === 'login-window') openLoginWindow(url)
    else if (decision === 'external') openExternalSafe(url)
    return { action: 'deny' }
  })

  // Pestañas del navegador de LockIn: siempre con preferencias seguras y en la sesión de las webs.
  contents.on('will-attach-webview', (event, webPreferences, params) => {
    if (!isWebUrl(params.src)) {
      event.preventDefault()
      return
    }
    const prefs = webPreferences as WebPreferences & Record<string, unknown>
    delete prefs.preload
    delete prefs.preloadURL
    delete prefs.enableBlinkFeatures
    delete prefs.additionalArguments
    Object.assign(prefs, safeWebPreferences())
    params.partition = WEB_PARTITION
  })
  contents.on('did-attach-webview', (_event, guest) => guardWebContents(guest))

  contents.on('context-menu', (_event, params) => showContextMenu(contents, params, false))
}

/* ------------------------------------------------------------------ */
/* Menú del botón derecho                                              */
/* ------------------------------------------------------------------ */

function showContextMenu(contents: WebContents, params: ContextMenuParams, isTab: boolean): void {
  const items: MenuItemConstructorOptions[] = []
  const separator = () => {
    if (items.length > 0 && items[items.length - 1].type !== 'separator') items.push({ type: 'separator' })
  }

  if (params.misspelledWord) {
    for (const word of params.dictionarySuggestions.slice(0, 4)) {
      items.push({ label: word, click: () => contents.replaceMisspelling(word) })
    }
    separator()
  }

  if (isTab && isWebUrl(params.linkURL)) {
    const link = params.linkURL
    items.push(
      {
        label: 'Abrir enlace en una pestaña nueva',
        click: () => (findBlockedHost(link, getBlockedHosts()) ? notifyBlocked(link) : requestTab(link)),
      },
      { label: 'Copiar dirección del enlace', click: () => clipboard.writeText(link) },
    )
    separator()
  }

  const { editFlags } = params
  if (params.isEditable) {
    items.push(
      { label: 'Cortar', enabled: editFlags.canCut, click: () => contents.cut() },
      { label: 'Copiar', enabled: editFlags.canCopy, click: () => contents.copy() },
      { label: 'Pegar', enabled: editFlags.canPaste, click: () => contents.paste() },
      { label: 'Seleccionar todo', enabled: editFlags.canSelectAll, click: () => contents.selectAll() },
    )
  } else if (params.selectionText.trim()) {
    items.push({ label: 'Copiar', enabled: editFlags.canCopy, click: () => contents.copy() })
  }

  if (isTab) {
    const history = contents.navigationHistory
    separator()
    items.push(
      { label: 'Atrás', enabled: history.canGoBack(), click: () => history.goBack() },
      { label: 'Adelante', enabled: history.canGoForward(), click: () => history.goForward() },
      { label: 'Volver a cargar', click: () => contents.reload() },
    )
  }

  if (items.length === 0) return
  const owner = BrowserWindow.fromWebContents(contents.hostWebContents ?? contents) ?? undefined
  Menu.buildFromTemplate(items).popup({ window: owner })
}
