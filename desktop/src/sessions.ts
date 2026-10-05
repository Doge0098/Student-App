/**
 * Las dos sesiones de LockIn:
 * - la de la app (sesión por defecto): app://lockin/, reproductores de música, notificaciones del temporizador;
 * - la de las webs (persist:lockin-web): pestañas, ventanas emergentes e inicios de sesión de Google.
 */
import { app, BrowserWindow, dialog, session, type MediaAccessPermissionRequest, type Session, type WebContents } from 'electron'
import { cleanUserAgent, decidePermission, findBlockedHost, originOf, WEB_PARTITION, withAppReferer, YOUTUBE_EMBED_URLS } from './policy'
import { getBlockedHosts, notifyBlocked } from './state'

export function webSession(): Session {
  return session.fromPartition(WEB_PARTITION)
}

/** Agente de usuario como el de Chrome (sin «Electron/x» ni «LockIn/x»). */
export function chromeLikeUserAgent(ua: string): string {
  return cleanUserAgent(ua, [app.getName(), 'lockin-desktop'])
}

export function configureSessions(): void {
  app.userAgentFallback = chromeLikeUserAgent(app.userAgentFallback)
  configure(session.defaultSession, 'shell')
  configure(webSession(), 'web')

  // Modo Estricto, última barrera: cualquier carga de página principal en una pestaña (también
  // «Atrás», recargar o una redirección) hacia un dominio bloqueado se cancela.
  webSession().webRequest.onBeforeRequest({ urls: ['http://*/*', 'https://*/*'], types: ['mainFrame'] }, (details, callback) => {
    if (findBlockedHost(details.url, getBlockedHosts())) {
      notifyBlocked(details.url)
      callback({ cancel: true })
    } else {
      callback({})
    }
  })
}

function configure(ses: Session, context: 'shell' | 'web'): void {
  ses.setUserAgent(chromeLikeUserAgent(ses.getUserAgent()))

  ses.setPermissionRequestHandler((contents, permission, callback, details) => {
    const media = details as MediaAccessPermissionRequest
    const origin = originOf(media.securityOrigin || details.requestingUrl)
    const decision = decidePermission(permission, context, origin)
    if (decision === 'ask') void askForMedia(contents, origin, media.mediaTypes ?? []).then(callback)
    else callback(decision === 'allow')
  })

  ses.setPermissionCheckHandler((_contents, permission, requestingOrigin) => {
    const origin = originOf(requestingOrigin)
    const decision = decidePermission(permission, context, origin)
    return decision === 'allow' || (decision === 'ask' && mediaGrants.has(origin))
  })

  // Sin esto el reproductor de YouTube (panel de Música, vídeos en pestañas) muestra «Error 153».
  ses.webRequest.onBeforeSendHeaders({ urls: YOUTUBE_EMBED_URLS, types: ['mainFrame', 'subFrame'] }, (details, callback) =>
    callback({ requestHeaders: withAppReferer(details.requestHeaders) }),
  )

  // USB, HID, puertos serie…: ninguna web de estudio los necesita.
  ses.setDevicePermissionHandler(() => false)

  try {
    if (process.platform !== 'darwin') ses.setSpellCheckerLanguages(['es-ES', 'en-US'])
  } catch {
    /* sin diccionarios: se sigue sin corrector */
  }
}

/* ------------------------------------------------------------------ */
/* Cámara y micrófono (Meet, Teams…): se pregunta al estudiante        */
/* ------------------------------------------------------------------ */

/** Webs a las que el estudiante ha dejado usar cámara/micrófono mientras LockIn está abierto. */
const mediaGrants = new Set<string>()
const pendingAsks = new Map<string, Promise<boolean>>()

function askForMedia(contents: WebContents, origin: string, types: readonly string[]): Promise<boolean> {
  if (mediaGrants.has(origin)) return Promise.resolve(true)
  const pending = pendingAsks.get(origin)
  if (pending) return pending

  const what =
    types.includes('video') && types.includes('audio')
      ? 'la cámara y el micrófono'
      : types.includes('video')
        ? 'la cámara'
        : 'el micrófono'
  const site = origin.replace(/^https?:\/\//, '')
  const owner = BrowserWindow.fromWebContents(contents.hostWebContents ?? contents)
  const options = {
    type: 'question' as const,
    buttons: ['Permitir', 'No permitir'],
    defaultId: 1,
    cancelId: 1,
    noLink: true,
    title: 'LockIn',
    message: `¿Dejar que ${site} use ${what}?`,
    detail: 'Solo mientras LockIn esté abierto.',
  }
  const ask = (owner ? dialog.showMessageBox(owner, options) : dialog.showMessageBox(options))
    .then(({ response }) => {
      const granted = response === 0
      if (granted) mediaGrants.add(origin)
      return granted
    })
    .catch(() => false)
    .finally(() => pendingAsks.delete(origin))
  pendingAsks.set(origin, ask)
  return ask
}
