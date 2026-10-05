import path from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  cleanUserAgent,
  createRepeatFilter,
  decideGuestNavigation,
  decideGuestPopup,
  decidePermission,
  decideShellNavigation,
  decideShellPopup,
  findBlockedHost,
  hostMatches,
  isAppUrl,
  isWebUrl,
  loginSessionFor,
  mimeTypeFor,
  normalizeHosts,
  originOf,
  parseWebUrl,
  resolveAppFile,
  tabShortcut,
  type KeyInput,
} from './policy'

describe('direcciones', () => {
  it('solo acepta http y https como webs', () => {
    expect(isWebUrl('https://es.wikipedia.org/wiki/Luna')).toBe(true)
    expect(isWebUrl('http://example.com')).toBe(true)
    for (const bad of ['file:///etc/passwd', 'javascript:alert(1)', 'app://lockin/', 'data:text/html,hola', 'chrome://gpu', 'no es una url', 42, null]) {
      expect(isWebUrl(bad)).toBe(false)
    }
    expect(parseWebUrl('https://a.com/x')?.hostname).toBe('a.com')
  })

  it('reconoce las páginas de la app', () => {
    expect(isAppUrl('app://lockin/index.html')).toBe(true)
    expect(isAppUrl('app://otra/index.html')).toBe(false)
    expect(isAppUrl('https://lockin/index.html')).toBe(false)
  })

  it('saca el origen de webs y de la app', () => {
    expect(originOf('https://meet.google.com/abc-defg')).toBe('https://meet.google.com')
    expect(originOf('app://lockin/index.html')).toBe('app://lockin')
    expect(originOf('app://lockin')).toBe('app://lockin')
    expect(originOf('file:///tmp/x')).toBe('')
    expect(originOf('')).toBe('')
  })
})

describe('dominios bloqueados', () => {
  it('limpia la lista que llega de la app', () => {
    expect(normalizeHosts([' Instagram.com ', '*.tiktok.com', '.reddit.com.', 'instagram.com', 'mal dominio', 5, null, '', 'a/b'])).toEqual([
      'instagram.com',
      'reddit.com',
      'tiktok.com',
    ])
    expect(normalizeHosts('instagram.com')).toEqual([])
    expect(normalizeHosts(['a.com', 'b.com', 'c.com'], 2)).toEqual(['a.com', 'b.com'])
  })

  it('bloquea el dominio y sus subdominios, no los parecidos', () => {
    expect(hostMatches('www.instagram.com', 'instagram.com')).toBe(true)
    expect(hostMatches('instagram.com.', 'instagram.com')).toBe(true)
    expect(hostMatches('noinstagram.com', 'instagram.com')).toBe(false)
    const blocked = ['instagram.com', 'tiktok.com']
    expect(findBlockedHost('https://www.tiktok.com/@alguien', blocked)).toBe('tiktok.com')
    expect(findBlockedHost('https://es.wikipedia.org/', blocked)).toBeNull()
    expect(findBlockedHost('https://www.instagram.com/', [])).toBeNull()
    expect(findBlockedHost('javascript:alert(1)', blocked)).toBeNull()
  })
})

describe('navegación', () => {
  it('la app nunca sale de app://lockin; los enlaces web van al navegador del sistema', () => {
    expect(decideShellNavigation('app://lockin/index.html')).toBe('allow')
    expect(decideShellNavigation('https://example.com/')).toBe('external')
    expect(decideShellNavigation('file:///etc/passwd')).toBe('deny')
    expect(decideShellNavigation('app://otra/')).toBe('deny')
  })

  it('las pestañas no pueden ir a la app ni a archivos, y respetan el modo Estricto', () => {
    const blocked = ['instagram.com']
    expect(decideGuestNavigation('https://es.wikipedia.org/', true, blocked)).toBe('allow')
    expect(decideGuestNavigation('https://www.instagram.com/reel/1', true, blocked)).toBe('blocked')
    // Un marco interno (p. ej. una publicación incrustada) no se bloquea: solo la página principal.
    expect(decideGuestNavigation('https://www.instagram.com/p/1/embed', false, blocked)).toBe('allow')
    expect(decideGuestNavigation('app://lockin/index.html', true, [])).toBe('deny')
    expect(decideGuestNavigation('app://lockin/index.html', false, [])).toBe('deny')
    expect(decideGuestNavigation('file:///etc/passwd', true, [])).toBe('deny')
    expect(decideGuestNavigation('data:text/html,hola', true, [])).toBe('deny')
    expect(decideGuestNavigation('data:text/html,hola', false, [])).toBe('allow')
    expect(decideGuestNavigation('about:blank', false, [])).toBe('allow')
  })
})

describe('ventanas nuevas', () => {
  it('la app: inicios de sesión en ventana de LockIn, el resto al navegador del sistema', () => {
    expect(decideShellPopup('https://accounts.google.com/', 'new-window')).toBe('login-window')
    expect(decideShellPopup('https://code.visualstudio.com/download', 'foreground-tab')).toBe('external')
    expect(decideShellPopup('file:///etc/passwd', 'new-window')).toBe('deny')
  })

  it('las webs: enlaces en pestaña nueva de LockIn, emergentes en ventana, bloqueadas no', () => {
    const blocked = ['tiktok.com']
    expect(decideGuestPopup('https://es.wikipedia.org/wiki/Luna', 'foreground-tab', blocked)).toBe('tab')
    expect(decideGuestPopup('https://es.wikipedia.org/wiki/Luna', 'background-tab', blocked)).toBe('tab')
    expect(decideGuestPopup('https://accounts.google.com/o/oauth2', 'new-window', blocked)).toBe('popup')
    expect(decideGuestPopup('https://www.tiktok.com/', 'foreground-tab', blocked)).toBe('blocked')
    expect(decideGuestPopup('https://www.tiktok.com/', 'new-window', blocked)).toBe('blocked')
    expect(decideGuestPopup('javascript:alert(1)', 'new-window', blocked)).toBe('deny')
  })

  it('Spotify inicia sesión junto al reproductor; Google junto a las pestañas', () => {
    expect(loginSessionFor('https://accounts.spotify.com/login')).toBe('shell')
    expect(loginSessionFor('https://accounts.google.com/ServiceLogin')).toBe('web')
    expect(loginSessionFor('https://notspotify.com/')).toBe('web')
  })
})

describe('permisos', () => {
  it('la app puede avisar (temporizador) pero no usar la cámara', () => {
    expect(decidePermission('notifications', 'shell', 'app://lockin')).toBe('allow')
    expect(decidePermission('fullscreen', 'shell', 'app://lockin')).toBe('allow')
    expect(decidePermission('media', 'shell', 'app://lockin')).toBe('deny')
    // Un iframe de la app (YouTube) no recibe los permisos de la app.
    expect(decidePermission('notifications', 'shell', 'https://www.youtube.com')).toBe('deny')
  })

  it('las webs: cámara y micrófono se preguntan; notificaciones y ubicación no', () => {
    expect(decidePermission('media', 'web', 'https://meet.google.com')).toBe('ask')
    expect(decidePermission('fullscreen', 'web', 'https://www.youtube.com')).toBe('allow')
    expect(decidePermission('mediaKeySystem', 'web', 'https://open.spotify.com')).toBe('allow')
    expect(decidePermission('notifications', 'web', 'https://web.whatsapp.com')).toBe('deny')
    expect(decidePermission('geolocation', 'web', 'https://example.com')).toBe('deny')
    expect(decidePermission('usb', 'web', 'https://example.com')).toBe('deny')
    expect(decidePermission('media', 'web', '')).toBe('deny')
    expect(decidePermission('fullscreen', 'web', 'app://lockin')).toBe('deny')
  })
})

describe('agente de usuario', () => {
  it('quita Electron y el nombre de la app', () => {
    const ua =
      'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) LockIn/0.1.0 Chrome/146.0.7680.0 Electron/44.5.1 Safari/537.36'
    expect(cleanUserAgent(ua, ['LockIn'])).toBe(
      'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.7680.0 Safari/537.36',
    )
    expect(cleanUserAgent('Mozilla/5.0 Chrome/1 Safari/537.36')).toBe('Mozilla/5.0 Chrome/1 Safari/537.36')
  })
})

describe('archivos de la app', () => {
  const root = path.resolve('/opt/lockin/web')

  it('sirve los archivos de la carpeta y index.html por defecto', () => {
    expect(resolveAppFile(root, '/')).toBe(path.join(root, 'index.html'))
    expect(resolveAppFile(root, '')).toBe(path.join(root, 'index.html'))
    expect(resolveAppFile(root, '/assets/index-abc.js')).toBe(path.join(root, 'assets', 'index-abc.js'))
    expect(resolveAppFile(root, '/icono%20grande.png')).toBe(path.join(root, 'icono grande.png'))
  })

  it('no deja salir de la carpeta', () => {
    expect(resolveAppFile(root, '/../secreto.txt')).toBeNull()
    expect(resolveAppFile(root, '/%2e%2e/%2e%2e/etc/passwd')).toBeNull()
    expect(resolveAppFile(root, '/assets/..%2f..%2f..%2fetc/passwd')).toBeNull()
    expect(resolveAppFile(root, '/%E0%A4%A')).toBeNull()
    expect(resolveAppFile(root, '/a%00.js')).toBeNull()
  })

  it('da el tipo de contenido correcto', () => {
    expect(mimeTypeFor('/x/index.html')).toMatch(/^text\/html/)
    expect(mimeTypeFor('/x/assets/app.JS')).toMatch(/^text\/javascript/)
    expect(mimeTypeFor('/x/manifest.webmanifest')).toMatch(/^application\/manifest\+json/)
    expect(mimeTypeFor('/x/sin-extension')).toBe('application/octet-stream')
  })
})

describe('atajos en las pestañas', () => {
  const key = (k: string, mods: Partial<KeyInput> = {}): KeyInput => ({
    type: 'keyDown',
    key: k,
    alt: false,
    control: false,
    meta: false,
    shift: false,
    ...mods,
  })

  it('Windows y Linux', () => {
    expect(tabShortcut(key('ArrowLeft', { alt: true }), 'win32')).toBe('back')
    expect(tabShortcut(key('ArrowRight', { alt: true }), 'linux')).toBe('forward')
    expect(tabShortcut(key('r', { control: true }), 'linux')).toBe('reload')
    expect(tabShortcut(key('F5'), 'win32')).toBe('reload')
    expect(tabShortcut(key('ArrowLeft'), 'win32')).toBeNull()
    expect(tabShortcut(key('r', { control: true, shift: true }), 'linux')).toBeNull()
    expect(tabShortcut({ ...key('ArrowLeft', { alt: true }), type: 'keyUp' }, 'win32')).toBeNull()
  })

  it('Mac', () => {
    expect(tabShortcut(key('[', { meta: true }), 'darwin')).toBe('back')
    expect(tabShortcut(key(']', { meta: true }), 'darwin')).toBe('forward')
    expect(tabShortcut(key('r', { meta: true }), 'darwin')).toBe('reload')
    expect(tabShortcut(key('ArrowLeft', { alt: true }), 'darwin')).toBeNull()
  })
})

describe('avisos repetidos', () => {
  it('avisa una vez por dirección en la ventana de tiempo', () => {
    let now = 0
    const shouldNotify = createRepeatFilter(1000, () => now)
    expect(shouldNotify('https://www.tiktok.com/')).toBe(true)
    expect(shouldNotify('https://www.tiktok.com/')).toBe(false)
    expect(shouldNotify('https://www.instagram.com/')).toBe(true)
    now = 1500
    expect(shouldNotify('https://www.tiktok.com/')).toBe(true)
  })
})
