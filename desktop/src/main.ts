/**
 * LockIn para ordenador (Electron).
 *
 * Carga la app web ya construida (carpeta dist/ de la raíz) desde app://lockin/ y le da un puente
 * (preload → window.lockinDesktop) para abrir cualquier web dentro de sus pestañas <webview>.
 */
import fs from 'node:fs'
import path from 'node:path'
import { app, BrowserWindow, dialog, ipcMain, Menu, webContents, nativeTheme, protocol, type IpcMainEvent, type MenuItemConstructorOptions } from 'electron'
import { guardShell, guardWebContents, openExternalSafe } from './guards'
import { APP_ENTRY, APP_HOST, APP_SCHEME, findBlockedHost, isAppUrl, mimeTypeFor, resolveAppFile } from './policy'
import { configureSessions, webSession } from './sessions'
import { CHANNELS, getBlockedHosts, getShell, notifyBlocked, setBlockedHosts, setShell } from './state'

// app:// se comporta como una web segura (localStorage, módulos JS, fetch…).
protocol.registerSchemesAsPrivileged([
  {
    scheme: APP_SCHEME,
    privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, codeCache: true },
  },
])

let mainWindow: BrowserWindow | null = null

/** Carpeta con la app web: dist/ de la raíz al desarrollar; recursos/web en la app empaquetada. */
function findWebRoot(): string | null {
  // LOCKIN_WEB_DIR (solo al desarrollar): probar con otra build de la web.
  const candidates = app.isPackaged
    ? [path.join(process.resourcesPath, 'web')]
    : [process.env.LOCKIN_WEB_DIR, path.join(__dirname, '..', '..', 'dist')]
  for (const dir of candidates) {
    if (dir && fs.existsSync(path.join(dir, 'index.html'))) return path.resolve(dir)
  }
  return null
}

function registerAppProtocol(webRoot: string): void {
  protocol.handle(APP_SCHEME, async (request) => {
    const url = new URL(request.url)
    const file = url.host === APP_HOST ? resolveAppFile(webRoot, url.pathname) : null
    if (!file || (request.method !== 'GET' && request.method !== 'HEAD')) {
      return new Response('No encontrado', { status: 404 })
    }
    try {
      const data = await fs.promises.readFile(file)
      const headers = new Headers({
        'Content-Type': mimeTypeFor(file),
        'X-Content-Type-Options': 'nosniff',
        'Cache-Control': 'no-cache',
      })
      // Nadie puede meter la app dentro de otra página; tampoco plugins.
      if (file.endsWith('.html')) headers.set('Content-Security-Policy', "object-src 'none'; base-uri 'self'; frame-ancestors 'none'")
      return new Response(request.method === 'HEAD' ? null : data, { status: 200, headers })
    } catch {
      return new Response('No encontrado', { status: 404 })
    }
  })
}

/** Solo la página principal de la app puede usar el puente (no los iframes de YouTube/Spotify). */
function fromShell(event: IpcMainEvent): boolean {
  const frame = event.senderFrame
  return event.sender === getShell() && frame !== null && frame === event.sender.mainFrame && isAppUrl(frame.url)
}

function registerIpc(): void {
  ipcMain.on(CHANNELS.openExternal, (event, url: unknown) => {
    if (fromShell(event)) openExternalSafe(url)
  })
  ipcMain.on(CHANNELS.setBlockedSites, (event, hosts: unknown) => {
    if (!fromShell(event)) return
    setBlockedHosts(hosts)
    // Las pestañas que ya mostraban una web ahora bloqueada se vacían (una web que cambia de página
    // sin recargar no pasa por los filtros de navegación).
    for (const contents of webContents.getAllWebContents()) {
      if (contents.session !== webSession() || contents.isDestroyed()) continue
      const url = contents.getURL()
      if (url && findBlockedHost(url, getBlockedHosts())) {
        void contents.loadURL('about:blank')
        notifyBlocked(url)
      }
    }
  })
}

function createMainWindow(webRoot: string): void {
  const icon = path.join(webRoot, 'icon-512.png')
  const win = new BrowserWindow({
    width: 1360,
    height: 860,
    minWidth: 380,
    minHeight: 520,
    show: false,
    title: 'LockIn',
    autoHideMenuBar: true,
    backgroundColor: nativeTheme.shouldUseDarkColors ? '#0e1016' : '#f5f6f9',
    ...(fs.existsSync(icon) ? { icon } : {}),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      webviewTag: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
      spellcheck: true,
      devTools: !app.isPackaged,
      additionalArguments: [`--lockin-version=${app.getVersion()}`],
    },
  })
  mainWindow = win
  setShell(win.webContents)
  guardShell(win.webContents)
  win.once('ready-to-show', () => win.show())
  win.on('closed', () => {
    if (mainWindow === win) mainWindow = null
    setShell(null)
  })
  void win.loadURL(APP_ENTRY)
}

function buildMenu(): void {
  const isMac = process.platform === 'darwin'
  const template: MenuItemConstructorOptions[] = [
    ...(isMac
      ? [
          {
            label: 'LockIn',
            submenu: [
              { role: 'about', label: 'Acerca de LockIn' },
              { type: 'separator' },
              { role: 'hide', label: 'Ocultar LockIn' },
              { role: 'hideOthers', label: 'Ocultar otros' },
              { role: 'unhide', label: 'Mostrar todo' },
              { type: 'separator' },
              { role: 'quit', label: 'Salir de LockIn' },
            ],
          } satisfies MenuItemConstructorOptions,
        ]
      : []),
    {
      label: 'Edición',
      submenu: [
        { role: 'undo', label: 'Deshacer' },
        { role: 'redo', label: 'Rehacer' },
        { type: 'separator' },
        { role: 'cut', label: 'Cortar' },
        { role: 'copy', label: 'Copiar' },
        { role: 'paste', label: 'Pegar' },
        { role: 'selectAll', label: 'Seleccionar todo' },
      ],
    },
    {
      label: 'Ver',
      submenu: [
        { role: 'resetZoom', label: 'Tamaño normal' },
        { role: 'zoomIn', label: 'Ampliar' },
        { role: 'zoomOut', label: 'Reducir' },
        { type: 'separator' },
        { role: 'togglefullscreen', label: 'Pantalla completa' },
        ...(app.isPackaged
          ? []
          : ([
              { type: 'separator' },
              { role: 'reload', label: 'Recargar la app' },
              { role: 'toggleDevTools', label: 'Herramientas de desarrollo' },
            ] satisfies MenuItemConstructorOptions[])),
      ],
    },
    {
      label: 'Ventana',
      submenu: [
        { role: 'minimize', label: 'Minimizar' },
        { role: 'close', label: 'Cerrar' },
      ],
    },
  ]
  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}

async function start(): Promise<void> {
  const webRoot = findWebRoot()
  if (!webRoot) {
    dialog.showErrorBox(
      'LockIn',
      'No encuentro la app web. En la carpeta principal de LockIn ejecuta «npm run build» y vuelve a abrir.',
    )
    app.quit()
    return
  }
  configureSessions()
  registerAppProtocol(webRoot)
  registerIpc()
  buildMenu()
  createMainWindow(webRoot)
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow(webRoot)
  })
}

// Las webs (pestañas y sus ventanas emergentes) siempre con las reglas de seguridad.
app.on('web-contents-created', (_event, contents) => {
  const type = contents.getType()
  if (type === 'webview' || (type === 'window' && contents.session === webSession())) guardWebContents(contents)
})

if (process.platform === 'win32') app.setAppUserModelId('app.lockin.desktop')
// Otra carpeta de datos (pruebas, varios perfiles): LOCKIN_USER_DATA=/ruta.
if (process.env.LOCKIN_USER_DATA) app.setPath('userData', path.resolve(process.env.LOCKIN_USER_DATA))

if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (!mainWindow) return
    if (mainWindow.isMinimized()) mainWindow.restore()
    mainWindow.focus()
  })
  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit()
  })
  void app.whenReady().then(start)
}
