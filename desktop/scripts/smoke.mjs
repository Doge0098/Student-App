/**
 * Prueba de humo de LockIn para ordenador (Playwright + Electron).
 *
 *   npm run smoke                       (necesita la web construida: npm run build en la raíz)
 *   LOCKIN_WEB_DIR=/otra/dist npm run smoke
 *   xvfb-run -a npm run smoke           (Linux sin pantalla)
 *
 * Usa Playwright si está instalado (playwright o playwright-core), o la ruta de PLAYWRIGHT_MODULE.
 * Si existe HTTPS_PROXY se pasa a Chromium con --proxy-server.
 */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const desktopDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

function loadPlaywright() {
  const ids = [process.env.PLAYWRIGHT_MODULE, 'playwright', 'playwright-core', '/opt/node22/lib/node_modules/playwright']
  for (const id of ids.filter(Boolean)) {
    try {
      return require(id)
    } catch {
      /* siguiente */
    }
  }
  console.error('No encuentro Playwright. Instálalo (npm i -D playwright-core) o indica PLAYWRIGHT_MODULE=/ruta.')
  process.exit(2)
}

const { _electron: electron } = loadPlaywright()
const electronBinary = require(path.join(desktopDir, 'node_modules', 'electron'))

const results = []
function check(name, ok, detail = '') {
  results.push({ name, ok: Boolean(ok) })
  console.log(`${ok ? 'OK   ' : 'FALLO'} ${name}${detail ? ` — ${detail}` : ''}`)
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
async function waitFor(fn, timeout = 20000, step = 250) {
  const end = Date.now() + timeout
  let last
  while (Date.now() < end) {
    last = await fn().catch((e) => ({ error: String(e) }))
    if (last && !last.error) return last
    await sleep(step)
  }
  return null
}

const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'lockin-smoke-'))
const args = [desktopDir]
// Chromium no arranca como root con su sandbox de sistema (solo pasa en contenedores de pruebas).
if (process.getuid?.() === 0) args.push('--no-sandbox')
const proxy = process.env.HTTPS_PROXY || process.env.https_proxy
if (proxy) args.push(`--proxy-server=${proxy}`)

const app = await electron.launch({
  executablePath: electronBinary,
  args,
  env: { ...process.env, LOCKIN_USER_DATA: userData },
  timeout: 60000,
})

try {
  const win = await app.firstWindow()
  await win.waitForLoadState('domcontentloaded')
  check('La ventana carga la app desde app://lockin/', win.url().startsWith('app://lockin/'), win.url())

  // Sin guía de bienvenida para poder usar la barra de direcciones.
  await win.evaluate(() => localStorage.setItem('student-app:welcome-done', 'true'))
  await win.reload()
  const address = 'input[aria-label="Buscar o escribir dirección"]'
  await win.waitForSelector(address, { timeout: 20000 })
  for (let i = 0; i < 3; i++) await win.keyboard.press('Escape')

  const bridge = await win.evaluate(() => {
    const b = window.lockinDesktop
    return b ? { version: b.version, platform: b.platform, fns: Object.keys(b).filter((k) => typeof b[k] === 'function').sort() } : null
  })
  check(
    'window.lockinDesktop existe con su API',
    bridge && bridge.version && ['onBlockedNavigation', 'onOpenTab', 'openExternal', 'setBlockedSites'].every((f) => bridge.fns.includes(f)),
    JSON.stringify(bridge),
  )
  check('La app no tiene Node (require/process)', await win.evaluate(() => typeof window.require === 'undefined' && typeof window.process === 'undefined'))

  // Se apuntan los enlaces que irían al navegador del sistema en vez de abrirlos.
  const patched = await app.evaluate(({ shell }) => {
    globalThis.__opened = []
    try {
      shell.openExternal = async (url) => {
        globalThis.__opened.push(url)
      }
      return true
    } catch {
      return false
    }
  })
  const opened = () => app.evaluate(() => globalThis.__opened ?? [])

  await win.evaluate(() => {
    window.__blocked = []
    window.__tabs = []
    window.lockinDesktop.onBlockedNavigation((u) => window.__blocked.push(u))
  })

  /* --- 1. Una web cualquiera en una pestaña <webview> --- */
  await win.fill(address, 'https://example.com/')
  await win.press(address, 'Enter')
  await win.waitForSelector('webview', { state: 'attached', timeout: 20000 })
  const guests = () =>
    app.evaluate(({ webContents, session }) =>
      webContents
        .getAllWebContents()
        .filter((w) => w.getType() === 'webview')
        .map((w) => ({
          id: w.id,
          url: w.getURL(),
          title: w.getTitle(),
          loading: w.isLoading(),
          webSession: w.session === session.fromPartition('persist:lockin-web'),
          history: w.navigationHistory.length(),
        })),
    )
  const loaded = await waitFor(async () => {
    const list = await guests()
    const g = list.find((x) => x.url.startsWith('https://example.com') && !x.loading && x.title === 'Example Domain')
    if (!g) throw new Error('todavía no')
    return g
  }, 40000)
  check('Una web externa carga en una pestaña <webview>', loaded, loaded ? `${loaded.url} «${loaded.title}»` : JSON.stringify(await guests()))
  check('La pestaña usa la sesión persist:lockin-web', loaded?.webSession)
  const firstId = loaded?.id
  const runInGuest = (id, code) => app.evaluate(({ webContents }, [gid, js]) => webContents.fromId(gid).executeJavaScript(js, true), [id, code])
  const guestUrl = (id) => app.evaluate(({ webContents }, gid) => webContents.fromId(gid)?.getURL(), id)

  const tabTitles = () => win.$$eval('.tab-title', (els) => els.map((e) => e.textContent))
  const titled = await waitFor(async () => {
    const t = await tabTitles()
    if (!t.includes('Example Domain')) throw new Error('sin título')
    return t
  }, 10000)
  check('onNavigate: la pestaña recibe el título real de la página', titled, JSON.stringify(titled ?? (await tabTitles())))

  if (firstId) {
    const inside = await runInGuest(firstId, '[typeof require, typeof process, navigator.userAgent]')
    check('La web no tiene Node', inside[0] === 'undefined' && inside[1] === 'undefined')
    check('Agente de usuario sin «Electron»', !/Electron|LockIn/i.test(inside[2]) && /Chrome\//.test(inside[2]), inside[2])
    const notif = await runInGuest(firstId, 'Notification.requestPermission()')
    check('Las webs no pueden mandar notificaciones', notif === 'denied', notif)
  }
  check('La app sí puede notificar (temporizador)', (await win.evaluate(() => Notification.permission)) === 'granted')

  /* --- 2. Modo Estricto: enlace a una web bloqueada --- */
  const clickLink = (id, href) =>
    runInGuest(id, `(() => { const a = document.createElement('a'); a.href = ${JSON.stringify(href)}; a.textContent = 'x'; document.body.append(a); a.click(); return true })()`)
  if (firstId) {
    await win.evaluate(() => window.lockinDesktop.setBlockedSites(['iana.org']))
    await clickLink(firstId, 'https://www.iana.org/')
    await sleep(2500)
    const blocked = await win.evaluate(() => window.__blocked.slice())
    const stayed = await guestUrl(firstId)
    check('Un enlace a una web bloqueada se cancela', stayed.startsWith('https://example.com'), stayed)
    check('…y la app recibe onBlockedNavigation', blocked.some((u) => u.includes('iana.org')), JSON.stringify(blocked))
    const toast = await win.$eval('.toast-region', (el) => el.textContent).catch(() => '')
    check('…y se ve el aviso', /bloquead/i.test(toast), toast)

    /* --- 3. Sin bloqueo, el enlace navega y la app se entera --- */
    await win.evaluate(() => window.lockinDesktop.setBlockedSites([]))
    await clickLink(firstId, 'https://es.wikipedia.org/wiki/Luna')
    const moved = await waitFor(async () => {
      const t = await tabTitles()
      const u = await guestUrl(firstId)
      if (!u.includes('wikipedia.org/wiki/Luna') || !t.some((x) => /Luna/.test(x))) throw new Error('aún no')
      return { u, t }
    }, 30000)
    check('Al navegar dentro, la pestaña cambia de dirección y título (onNavigate)', moved, JSON.stringify(moved ?? (await tabTitles())))
    const history = await win.evaluate(() => JSON.parse(localStorage.getItem('student-app:browser-history') || '[]').map((h) => `${h.title} | ${h.url}`))
    check('…y la página real se guarda en el historial', history.some((h) => /wikipedia\.org\/wiki\/Luna/.test(h)), JSON.stringify(history.slice(0, 3)))

    /* --- 4. Barrera final: «Atrás/Adelante» hacia una web bloqueada --- */
    await win.evaluate(() => window.lockinDesktop.setBlockedSites(['example.com']))
    await win.evaluate(() => (window.__blocked = []))
    await app.evaluate(({ webContents }, gid) => webContents.fromId(gid).navigationHistory.goBack(), firstId)
    await sleep(3000)
    const afterBack = await guestUrl(firstId)
    const blockedBack = await win.evaluate(() => window.__blocked.slice())
    check('«Atrás» hacia una web bloqueada se cancela', !afterBack.startsWith('https://example.com') || blockedBack.length > 0, `${afterBack} ${JSON.stringify(blockedBack)}`)
    await win.evaluate(() => window.lockinDesktop.setBlockedSites([]))

    /* --- 5. Ventanas nuevas desde una web --- */
    await win.evaluate(() => window.lockinDesktop.setBlockedSites(['tiktok.com']))
    await win.evaluate(() => {
      window.__blocked = []
      window.__unsubTab = window.lockinDesktop.onOpenTab((u) => window.__tabs.push(u))
    })
    await runInGuest(firstId, `window.open('https://es.wikipedia.org/wiki/Sol'); true`)
    await runInGuest(firstId, `window.open('https://www.tiktok.com/', '_blank'); true`)
    await sleep(1500)
    const tabs = await win.evaluate(() => window.__tabs.slice())
    const blockedPopups = await win.evaluate(() => window.__blocked.slice())
    check('target=_blank / window.open → pestaña nueva de LockIn (onOpenTab)', tabs.some((u) => u.includes('/wiki/Sol')), JSON.stringify(tabs))
    check('…pero no si es una web bloqueada', blockedPopups.some((u) => u.includes('tiktok.com')) && !tabs.some((u) => u.includes('tiktok')), JSON.stringify(blockedPopups))

    await win.evaluate(() => window.__unsubTab())
    await runInGuest(firstId, `window.open('https://example.org/'); true`)
    await sleep(1500)
    check('Si la app no escucha onOpenTab, el enlace va al navegador del sistema', !patched || (await opened()).some((u) => u.includes('example.org')), JSON.stringify(await opened()))

    await runInGuest(firstId, `window.open('https://example.com/', 'acceso', 'popup,width=420,height=520'); true`)
    const popup = await waitFor(async () => {
      const list = await app.evaluate(({ BrowserWindow, session }) =>
        BrowserWindow.getAllWindows()
          .filter((w) => !w.webContents.getURL().startsWith('app://'))
          .map((w) => ({ url: w.webContents.getURL(), webSession: w.webContents.session === session.fromPartition('persist:lockin-web') })),
      )
      if (!list.length) throw new Error('sin ventana')
      return list[0]
    }, 15000)
    check('Una ventana emergente (window.open con tamaño) se abre en una ventana de LockIn', popup, JSON.stringify(popup))
    check('…en la sesión de las webs', popup?.webSession)
    const popupNoNode = await app.evaluate(async ({ BrowserWindow }) => {
      const w = BrowserWindow.getAllWindows().find((x) => !x.webContents.getURL().startsWith('app://'))
      const r = w ? await w.webContents.executeJavaScript('typeof require + "," + typeof process') : null
      w?.close()
      return r
    })
    check('…y sin Node', popupNoNode === 'undefined,undefined', popupNoNode)
    await win.evaluate(() => window.lockinDesktop.setBlockedSites([]))
  }

  /* --- 6. Pestañas ocultas conservan su estado --- */
  const beforeSecond = firstId ? await guestUrl(firstId) : ''
  await win.fill(address, 'https://www.iana.org/')
  await win.press(address, 'Enter')
  const second = await waitFor(async () => {
    const list = await guests()
    const g = list.find((x) => x.id !== firstId && x.url.includes('iana.org') && !x.loading)
    if (!g) throw new Error('aún no')
    return g
  }, 30000)
  check('Se abre una segunda pestaña', second, second?.url)
  const hiddenFirst = await win.$$eval('.browser-frame', (els) => els.map((e) => e.hidden))
  const firstAlive = firstId ? await guestUrl(firstId) : null
  check('La primera pestaña sigue viva y en la misma página mientras está oculta', firstAlive === beforeSecond && hiddenFirst.includes(true), `${firstAlive} hidden=${JSON.stringify(hiddenFirst)}`)

  /* --- 7. La ventana de la app no se deja llevar a otra web --- */
  await win.evaluate(() => {
    location.href = 'https://example.net/'
  })
  await sleep(1500)
  check('La app no sale de app://lockin/', win.url().startsWith('app://lockin/'), win.url())
  check('…y el enlace va al navegador del sistema', !patched || (await opened()).some((u) => u.includes('example.net')))

  /* --- 8. <webview> manipuladas desde la app: siempre seguras --- */
  const attached = await win.evaluate(async () => {
    const make = (attrs) => {
      const v = document.createElement('webview')
      for (const [k, val] of Object.entries(attrs)) v.setAttribute(k, val)
      v.style.width = '10px'
      v.style.height = '10px'
      document.body.append(v)
      return v
    }
    make({ src: 'file:///etc/hostname' })
    make({ src: 'https://example.com/?x=1', nodeintegration: '', preload: 'file:///tmp/nada.js', webpreferences: 'contextIsolation=no, sandbox=no', partition: 'persist:otra' })
    await new Promise((r) => setTimeout(r, 4000))
    return true
  })
  const hardened = await app.evaluate(async ({ webContents, session }) => {
    const all = webContents.getAllWebContents().filter((w) => w.getType() === 'webview')
    const fileGuest = all.some((w) => w.getURL().startsWith('file:'))
    const g = all.find((w) => w.getURL().includes('?x=1'))
    if (!g) return { fileGuest, found: false }
    const inside = await g.executeJavaScript('typeof require + "," + typeof process')
    return { fileGuest, found: true, inside, webSession: g.session === session.fromPartition('persist:lockin-web') }
  })
  check('Una <webview> con file:// no se crea', attached && !hardened.fileGuest, JSON.stringify(hardened))
  check('Una <webview> con nodeintegration/preload/otra sesión se fuerza a la segura', hardened.found && hardened.inside === 'undefined,undefined' && hardened.webSession, JSON.stringify(hardened))

  /* --- 9. Informativo: reproductor de YouTube dentro de la app --- */
  const yt = await win.evaluate(async () => {
    const f = document.createElement('iframe')
    f.src = 'https://www.youtube.com/embed/jfKfPfyJRdk?enablejsapi=1&origin=' + encodeURIComponent(location.origin)
    f.width = '320'
    f.height = '180'
    f.id = 'yt-smoke'
    document.body.append(f)
    await new Promise((r) => setTimeout(r, 8000))
    return true
  })
  const ytText = await app.evaluate(async ({ BrowserWindow }) => {
    const w = BrowserWindow.getAllWindows().find((x) => x.webContents.getURL().startsWith('app://'))
    const frame = w?.webContents.mainFrame.framesInSubtree.find((f) => f.url.includes('youtube.com/embed'))
    return frame ? await frame.executeJavaScript('document.body.innerText.slice(0, 200)') : 'sin marco'
  })
  console.log(`INFO  Reproductor de YouTube en la app: ${yt ? JSON.stringify(ytText) : 'no probado'}`)
} catch (error) {
  check('La prueba terminó sin errores', false, String(error?.stack ?? error))
} finally {
  await app.close().catch(() => {})
  fs.rmSync(userData, { recursive: true, force: true })
}

const failed = results.filter((r) => !r.ok)
console.log(`\n${results.length - failed.length}/${results.length} comprobaciones correctas.`)
process.exit(failed.length ? 1 : 0)
