/**
 * Reglas de seguridad de LockIn para ordenador, sin depender de Electron (así se pueden probar).
 *
 * - La app (la «carcasa») se sirve desde app://lockin/ en la sesión por defecto.
 * - Las webs (pestañas <webview> y ventanas emergentes) van en otra sesión: persist:lockin-web.
 *   Así ninguna web puede cargar la app ni leer lo que guarda (tareas, apuntes, claves de IA).
 */
import path from 'node:path'

export const APP_SCHEME = 'app'
export const APP_HOST = 'lockin'
export const APP_ORIGIN = `${APP_SCHEME}://${APP_HOST}`
export const APP_ENTRY = `${APP_ORIGIN}/index.html`
/** Sesión de las webs (cookies e inicios de sesión de las pestañas). */
export const WEB_PARTITION = 'persist:lockin-web'
/** Máximo de dominios bloqueados que se aceptan del renderer. */
export const MAX_BLOCKED_HOSTS = 1000

/* ------------------------------------------------------------------ */
/* Direcciones                                                         */
/* ------------------------------------------------------------------ */

function parse(raw: unknown): URL | null {
  if (typeof raw !== 'string' || raw.length > 8192) return null
  try {
    return new URL(raw)
  } catch {
    return null
  }
}

/** Solo http y https: lo único que se abre fuera o se carga en una pestaña. */
export function parseWebUrl(raw: unknown): URL | null {
  const url = parse(raw)
  return url && (url.protocol === 'http:' || url.protocol === 'https:') ? url : null
}

export function isWebUrl(raw: unknown): boolean {
  return parseWebUrl(raw) !== null
}

/** Página de la propia app (app://lockin/...). */
export function isAppUrl(raw: unknown): boolean {
  const url = parse(raw)
  return url !== null && url.protocol === `${APP_SCHEME}:` && url.host === APP_HOST
}

/* ------------------------------------------------------------------ */
/* Modo Estricto: dominios bloqueados                                  */
/* ------------------------------------------------------------------ */

const HOSTNAME = /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)*[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/

/**
 * Limpia la lista que manda el renderer: solo dominios válidos, en minúsculas, sin repetir.
 * Cualquier otra cosa se ignora (no se confía en lo que llega por IPC).
 */
export function normalizeHosts(input: unknown, max = MAX_BLOCKED_HOSTS): string[] {
  if (!Array.isArray(input)) return []
  const hosts = new Set<string>()
  for (const item of input) {
    if (typeof item !== 'string') continue
    const host = item.trim().toLowerCase().replace(/^\*?\.+/, '').replace(/\.+$/, '')
    if (HOSTNAME.test(host)) hosts.add(host)
    if (hosts.size >= max) break
  }
  return [...hosts].sort()
}

/** «www.instagram.com» y «instagram.com» coinciden con «instagram.com»; «noinstagram.com» no. */
export function hostMatches(hostname: string, host: string): boolean {
  const name = hostname.toLowerCase().replace(/\.+$/, '')
  return name === host || name.endsWith(`.${host}`)
}

/** Devuelve el dominio bloqueado con el que coincide la dirección (o null si se puede abrir). */
export function findBlockedHost(raw: unknown, blocked: readonly string[]): string | null {
  if (blocked.length === 0) return null
  const url = parseWebUrl(raw)
  if (!url) return null
  return blocked.find((host) => hostMatches(url.hostname, host)) ?? null
}

/* ------------------------------------------------------------------ */
/* Navegación                                                          */
/* ------------------------------------------------------------------ */

export type ShellNavigation = 'allow' | 'external' | 'deny'

/** La ventana de la app nunca sale de app://lockin/; los enlaces web se abren en el navegador del sistema. */
export function decideShellNavigation(raw: unknown): ShellNavigation {
  if (isAppUrl(raw)) return 'allow'
  return isWebUrl(raw) ? 'external' : 'deny'
}

export type GuestNavigation = 'allow' | 'blocked' | 'deny'

/** Esquemas que puede abrir una web dentro de una pestaña (los marcos internos usan a veces about:, blob: o data:). */
const GUEST_SCHEMES = new Set(['http:', 'https:', 'about:', 'blob:', 'data:'])

/**
 * Una pestaña (o ventana emergente) quiere ir a otra dirección.
 * Nunca a la app ni a archivos del ordenador; en modo Estricto, tampoco a webs bloqueadas.
 */
export function decideGuestNavigation(raw: unknown, isMainFrame: boolean, blocked: readonly string[]): GuestNavigation {
  const url = parse(raw)
  if (!url || !GUEST_SCHEMES.has(url.protocol)) return 'deny'
  if (isMainFrame && url.protocol === 'data:') return 'deny'
  if (isMainFrame && findBlockedHost(raw, blocked)) return 'blocked'
  return 'allow'
}

/* ------------------------------------------------------------------ */
/* Ventanas nuevas (window.open, target=_blank)                        */
/* ------------------------------------------------------------------ */

export type Disposition = 'default' | 'foreground-tab' | 'background-tab' | 'new-window' | 'other'

export type ShellPopup = 'deny' | 'login-window' | 'external'

/**
 * Ventanas pedidas por la propia app:
 * - ventanas emergentes (inicio de sesión de Google) → ventana de LockIn con la sesión de las webs;
 * - enlaces normales (↗, «Descargar»…) → navegador del sistema.
 */
export function decideShellPopup(raw: unknown, disposition: Disposition): ShellPopup {
  if (!isWebUrl(raw)) return 'deny'
  return disposition === 'new-window' ? 'login-window' : 'external'
}

export type GuestPopup = 'deny' | 'blocked' | 'popup' | 'tab'

/**
 * Ventanas pedidas por una web abierta en una pestaña:
 * - ventanas emergentes de verdad (window.open con tamaño: «Iniciar sesión con Google», compartir…)
 *   → ventana pequeña de LockIn, para que la web pueda seguir hablando con ella;
 * - enlaces «en pestaña nueva» → pestaña nueva de LockIn (el estudiante no sale de la app).
 */
export function decideGuestPopup(raw: unknown, disposition: Disposition, blocked: readonly string[]): GuestPopup {
  if (!isWebUrl(raw)) return 'deny'
  if (findBlockedHost(raw, blocked)) return 'blocked'
  return disposition === 'new-window' ? 'popup' : 'tab'
}

/**
 * En qué sesión se abre una ventana de inicio de sesión pedida por la app: la de las pestañas
 * (Docs, Drive, Classroom y YouTube usan la cuenta de Google que se inicie ahí).
 */
export function loginSessionFor(_raw: unknown): 'web' {
  return 'web'
}

/* ------------------------------------------------------------------ */
/* Permisos                                                            */
/* ------------------------------------------------------------------ */

export type PermissionDecision = 'allow' | 'deny' | 'ask'

/** Lo que puede pedir la app: avisos del temporizador, pantalla completa de vídeos, copiar, DRM. */
const SHELL_PERMISSIONS = new Set([
  'notifications',
  'fullscreen',
  'clipboard-sanitized-write',
  'mediaKeySystem',
  'screen-wake-lock',
  'persistent-storage',
])

/**
 * Lo que puede pedir una web: pantalla completa, copiar, contenido protegido (DRM), bloquear el
 * ratón (simuladores 3D) y acceso a su almacenamiento. Cámara y micrófono (Meet, Teams…) se preguntan.
 * Las notificaciones de webs no: distraen.
 */
const WEB_PERMISSIONS = new Set([
  'fullscreen',
  'clipboard-sanitized-write',
  'mediaKeySystem',
  'pointerLock',
  'persistent-storage',
  'storage-access',
  'top-level-storage-access',
])

/** Lo que pueden pedir los reproductores incrustados en la app (YouTube): DRM y pantalla completa. */
const EMBED_PERMISSIONS = new Set(['fullscreen', 'mediaKeySystem', 'storage-access'])

export function decidePermission(permission: string, context: 'shell' | 'web', origin: string): PermissionDecision {
  if (context === 'shell') {
    if (isAppUrl(`${origin}/`)) return SHELL_PERMISSIONS.has(permission) ? 'allow' : 'deny'
    return isWebUrl(`${origin}/`) && EMBED_PERMISSIONS.has(permission) ? 'allow' : 'deny'
  }
  if (!isWebUrl(`${origin}/`)) return 'deny'
  if (WEB_PERMISSIONS.has(permission)) return 'allow'
  return permission === 'media' ? 'ask' : 'deny'
}

/** Origen (https://meet.google.com, app://lockin) de una dirección, o '' si no es web ni la app. */
export function originOf(raw: unknown): string {
  const url = parse(raw)
  if (!url || !url.host || !['http:', 'https:', `${APP_SCHEME}:`].includes(url.protocol)) return ''
  return `${url.protocol}//${url.host}`
}

/* ------------------------------------------------------------------ */
/* Identidad ante YouTube                                              */
/* ------------------------------------------------------------------ */

/**
 * YouTube exige que su reproductor incrustado sepa qué app lo usa (cabecera Referer). Desde
 * app://lockin/ (o al abrir un vídeo incrustado como página en una pestaña) Chromium no la manda y
 * YouTube muestra «Error 153». En apps, YouTube pide «https://<id de la app>».
 */
export const APP_REFERER = 'https://app.lockin.desktop/'
export const YOUTUBE_EMBED_URLS = [
  'https://www.youtube.com/embed/*',
  'https://youtube.com/embed/*',
  'https://m.youtube.com/embed/*',
  'https://www.youtube-nocookie.com/embed/*',
]

/** Añade la identidad de LockIn si la petición no lleva Referer (si ya lo lleva, no se toca). */
export function withAppReferer(headers: Record<string, string>): Record<string, string> {
  const has = Object.keys(headers).some((k) => k.toLowerCase() === 'referer' && headers[k])
  return has ? headers : { ...headers, Referer: APP_REFERER }
}

/* ------------------------------------------------------------------ */
/* Agente de usuario                                                   */
/* ------------------------------------------------------------------ */

/**
 * Quita «Electron/x» y el nombre de la app del agente de usuario para que las webs (Google, etc.)
 * traten a LockIn como a Chrome.
 */
export function cleanUserAgent(ua: string, appNames: readonly string[] = []): string {
  const names = ['Electron', ...appNames].map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  const token = new RegExp(`\\s(?:${names.join('|')})\\/\\S+`, 'gi')
  return ua.replace(token, '').replace(/\s{2,}/g, ' ').trim()
}

/* ------------------------------------------------------------------ */
/* Archivos de la app                                                  */
/* ------------------------------------------------------------------ */

/**
 * Traduce app://lockin/<ruta> a un archivo dentro de la carpeta de la app web.
 * Devuelve null si la ruta intenta salir de esa carpeta.
 */
export function resolveAppFile(root: string, pathname: string): string | null {
  let decoded: string
  try {
    decoded = decodeURIComponent(pathname)
  } catch {
    return null
  }
  if (decoded.includes('\0')) return null
  const relative = decoded.replace(/^\/+/, '') || 'index.html'
  const base = path.resolve(root)
  const file = path.resolve(base, relative)
  if (file !== base && !file.startsWith(base + path.sep)) return null
  return file === base ? path.join(base, 'index.html') : file
}

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg',
  '.wav': 'audio/wav',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.wasm': 'application/wasm',
}

/** Tipo de contenido de un archivo de la app web (los módulos JS necesitan el suyo exacto). */
export function mimeTypeFor(file: string): string {
  return MIME_TYPES[path.extname(file).toLowerCase()] ?? 'application/octet-stream'
}

/* ------------------------------------------------------------------ */
/* Atajos de teclado en las pestañas                                   */
/* ------------------------------------------------------------------ */

export interface KeyInput {
  type: string
  key: string
  alt: boolean
  control: boolean
  meta: boolean
  shift: boolean
}

export type TabShortcut = 'back' | 'forward' | 'reload' | null

/** Atrás/Adelante/Recargar como en cualquier navegador (Alt+←/→, ⌘[ ⌘], F5, Ctrl/⌘+R). */
export function tabShortcut(input: KeyInput, platform: string): TabShortcut {
  if (input.type !== 'keyDown') return null
  const mac = platform === 'darwin'
  const mod = mac ? input.meta : input.control
  if (input.key === 'F5' || (mod && !input.shift && input.key.toLowerCase() === 'r')) return 'reload'
  if (input.key === 'BrowserBack') return 'back'
  if (input.key === 'BrowserForward') return 'forward'
  if (mac && input.meta && !input.alt && !input.control) {
    if (input.key === '[' || input.key === 'ArrowLeft') return 'back'
    if (input.key === ']' || input.key === 'ArrowRight') return 'forward'
  }
  if (!mac && input.alt && !input.control && !input.meta) {
    if (input.key === 'ArrowLeft') return 'back'
    if (input.key === 'ArrowRight') return 'forward'
  }
  return null
}

/* ------------------------------------------------------------------ */
/* Avisos repetidos                                                    */
/* ------------------------------------------------------------------ */

/**
 * Para no avisar dos veces del mismo bloqueo (una navegación puede cancelarse en dos sitios).
 * Devuelve true si hay que avisar.
 */
export function createRepeatFilter(windowMs: number, now: () => number = Date.now) {
  const seen = new Map<string, number>()
  return (key: string): boolean => {
    const t = now()
    for (const [k, at] of seen) if (t - at > windowMs) seen.delete(k)
    if (seen.has(key)) return false
    seen.set(key, t)
    return true
  }
}
