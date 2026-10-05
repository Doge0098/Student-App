import { detectSubject, type SubjectId } from './subjects'
import { hostMatches } from './text'

/* ------------------------------------------------------------------ */
/* Entrada de la barra de direcciones                                  */
/* ------------------------------------------------------------------ */

export const SEARCH_ENGINES = {
  google: { label: 'Google', build: (q: string) => `https://www.google.com/search?q=${encodeURIComponent(q)}` },
  wikipedia: {
    label: 'Wikipedia',
    build: (q: string) => `https://es.wikipedia.org/w/index.php?search=${encodeURIComponent(q)}`,
  },
} as const

export type SearchEngineId = keyof typeof SEARCH_ENGINES

function tryUrl(text: string): URL | null {
  try {
    const url = new URL(text)
    return url.protocol === 'http:' || url.protocol === 'https:' ? url : null
  } catch {
    return null
  }
}

const DOMAIN_LIKE = /^[\w-]+(\.[\w-]+)*\.[a-z]{2,}(:\d+)?([/?#].*)?$/i

/** Convierte lo que escribe el estudiante en una dirección: o es un enlace, o es una búsqueda. */
export function resolveInput(raw: string, engine: SearchEngineId = 'google'): URL | null {
  const text = raw.trim()
  if (!text) return null
  if (/^https?:\/\//i.test(text)) {
    const url = tryUrl(text)
    if (url) return url
  }
  if (!/\s/.test(text) && DOMAIN_LIKE.test(text)) {
    const url = tryUrl(`https://${text}`)
    if (url) return url
  }
  return new URL(SEARCH_ENGINES[engine].build(text))
}

/* ------------------------------------------------------------------ */
/* Distracciones                                                       */
/* ------------------------------------------------------------------ */

const DISTRACTIONS: { label: string; hosts: string[]; path?: RegExp }[] = [
  { label: 'YouTube Shorts', hosts: ['youtube.com'], path: /^\/shorts\// },
  { label: 'Instagram', hosts: ['instagram.com'] },
  { label: 'TikTok', hosts: ['tiktok.com'] },
  { label: 'Facebook', hosts: ['facebook.com', 'fb.com'] },
  { label: 'X (Twitter)', hosts: ['twitter.com', 'x.com'] },
  { label: 'Reddit', hosts: ['reddit.com'] },
  { label: 'Twitch', hosts: ['twitch.tv'] },
  { label: 'Snapchat', hosts: ['snapchat.com'] },
  { label: 'Pinterest', hosts: ['pinterest.com', 'pinterest.es'] },
  { label: 'Netflix', hosts: ['netflix.com'] },
  { label: 'Prime Video', hosts: ['primevideo.com'] },
  { label: 'Disney+', hosts: ['disneyplus.com'] },
  { label: 'HBO Max', hosts: ['max.com', 'hbomax.com'] },
  {
    label: 'juegos online',
    hosts: ['poki.com', 'poki.es', 'roblox.com', 'miniclip.com', 'friv.com', 'y8.com', 'crazygames.com'],
  },
]

/** Devuelve el nombre de la distracción si la web lo es (redes sociales, reels, streaming, juegos). */
export function getDistraction(url: URL): string | null {
  for (const d of DISTRACTIONS) {
    if (d.hosts.some((h) => hostMatches(url.hostname, h)) && (!d.path || d.path.test(url.pathname))) {
      return d.label
    }
  }
  return null
}

/* ------------------------------------------------------------------ */
/* Categorías                                                          */
/* ------------------------------------------------------------------ */

export type CategoryId =
  | 'busqueda'
  | 'google'
  | 'video'
  | 'lectura'
  | 'herramienta'
  | 'clase'
  | 'programacion'
  | 'idiomas'
  | 'ia'
  | 'distraccion'
  | 'web'

export const CATEGORIES: Record<CategoryId, string> = {
  busqueda: 'Búsqueda',
  google: 'Google',
  video: 'Vídeo',
  lectura: 'Lectura',
  herramienta: 'Herramienta',
  clase: 'Clase',
  programacion: 'Programación',
  idiomas: 'Idiomas',
  ia: 'IA',
  distraccion: 'Distracción',
  web: 'Web',
}

const CATEGORY_RULES: { category: CategoryId; hosts: string[] }[] = [
  {
    category: 'ia',
    hosts: [
      'chatgpt.com', 'chat.openai.com', 'claude.ai', 'gemini.google.com', 'notebooklm.google.com',
      'perplexity.ai', 'copilot.microsoft.com', 'chat.deepseek.com',
    ],
  },
  { category: 'programacion', hosts: ['colab.research.google.com'] },
  {
    category: 'google',
    hosts: [
      'docs.google.com', 'drive.google.com', 'classroom.google.com', 'calendar.google.com',
      'mail.google.com', 'keep.google.com', 'meet.google.com', 'sites.google.com', 'forms.google.com',
      'translate.google.com', 'scholar.google.com', 'docs.new', 'sheets.new', 'slides.new', 'forms.new',
      'keep.new',
    ],
  },
  { category: 'video', hosts: ['youtube.com', 'youtu.be', 'youtube-nocookie.com', 'vimeo.com', 'ted.com', 'dailymotion.com'] },
  {
    category: 'clase',
    hosts: [
      'instructure.com', 'teams.microsoft.com', 'khanacademy.org', 'coursera.org', 'edx.org',
      'udemy.com', 'quizlet.com', 'kahoot.it', 'kahoot.com', 'edpuzzle.com', 'brainly.com',
      'brainly.lat', 'blinklearning.com', 'savia.es',
    ],
  },
  {
    category: 'programacion',
    hosts: [
      'github.com', 'stackoverflow.com', 'developer.mozilla.org', 'w3schools.com', 'replit.com',
      'codepen.io', 'geeksforgeeks.org', 'freecodecamp.org', 'python.org', 'scratch.mit.edu', 'vscode.dev',
      'webvm.io', 'bellard.org', 'copy.sh',
    ],
  },
  {
    category: 'idiomas',
    hosts: ['duolingo.com', 'deepl.com', 'wordreference.com', 'linguee.es', 'linguee.com', 'reverso.net', 'dictionary.cambridge.org'],
  },
  {
    category: 'herramienta',
    hosts: [
      'desmos.com', 'geogebra.org', 'wolframalpha.com', 'symbolab.com', 'mathway.com', 'phet.colorado.edu',
      'canva.com', 'overleaf.com', 'ptable.com', 'photomath.com', 'excalidraw.com', 'diagrams.net',
      'photopea.com', 'tinkercad.com', 'notion.so', 'notion.com', 'ankiweb.net',
    ],
  },
  {
    category: 'lectura',
    hosts: [
      'wikipedia.org', 'wiktionary.org', 'wikibooks.org', 'wikisource.org', 'wikiversity.org', 'rae.es',
      'britannica.com', 'sciencedirect.com', 'jstor.org', 'dialnet.unirioja.es',
    ],
  },
]

const GOOGLE_SEARCH_HOST = /^(www\.)?google\.[a-z.]+$/
const SEARCH_HOST = /^(www\.|html\.)?(google\.[a-z.]+|bing\.com|duckduckgo\.com|ecosia\.org)$|^search\.yahoo\.com$/

/** Texto que se buscó, si la dirección es una página de resultados. */
export function getSearchQuery(url: URL): string | null {
  const host = url.hostname
  if (SEARCH_HOST.test(host)) {
    const q = url.searchParams.get('q')
    if (q && ['/search', '/', '/html/'].includes(url.pathname)) return q
  }
  if (hostMatches(host, 'wikipedia.org')) return url.searchParams.get('search')
  if (hostMatches(host, 'youtube.com') && url.pathname === '/results') return url.searchParams.get('search_query')
  return null
}

function isClassroomPlatform(host: string): boolean {
  return /moodle|aulavirtual|campusvirtual|educamos/.test(host)
}

export function categorize(url: URL): CategoryId {
  if (getDistraction(url)) return 'distraccion'
  if (getSearchQuery(url) !== null) return 'busqueda'
  const host = url.hostname
  if (isClassroomPlatform(host)) return 'clase'
  for (const rule of CATEGORY_RULES) {
    if (rule.hosts.some((h) => hostMatches(host, h))) return rule.category
  }
  return 'web'
}

/* ------------------------------------------------------------------ */
/* Google Workspace                                                    */
/* ------------------------------------------------------------------ */

const GOOGLE_FILE_TYPES: Record<string, string> = {
  document: 'Documento de Google',
  spreadsheets: 'Hoja de cálculo de Google',
  presentation: 'Presentación de Google',
  forms: 'Formulario de Google',
  drawings: 'Dibujo de Google',
}

/** Detecta enlaces a archivos de Docs, Hojas, Presentaciones y Formularios. */
export function getGoogleFile(url: URL): { type: string; label: string; id: string } | null {
  if (!hostMatches(url.hostname, 'docs.google.com')) return null
  const match = url.pathname.match(/^\/(document|spreadsheets|presentation|forms|drawings)\/(?:u\/\d+\/)?d\/(?:e\/)?([\w-]+)/)
  if (!match) return null
  return { type: match[1], label: GOOGLE_FILE_TYPES[match[1]], id: match[2] }
}

const GOOGLE_APP_NAMES: [string, string][] = [
  ['drive.google.com', 'Google Drive'],
  ['classroom.google.com', 'Google Classroom'],
  ['calendar.google.com', 'Google Calendar'],
  ['mail.google.com', 'Gmail'],
  ['keep.google.com', 'Google Keep'],
  ['meet.google.com', 'Google Meet'],
  ['translate.google.com', 'Traductor de Google'],
  ['scholar.google.com', 'Google Académico'],
  ['sites.google.com', 'Google Sites'],
]

/* ------------------------------------------------------------------ */
/* Música: YouTube, YouTube Music y Spotify                            */
/* ------------------------------------------------------------------ */

export interface YouTubeRef {
  videoId?: string
  listId?: string
}

const YT_ID = /^[\w-]{11}$/

export function parseYouTube(url: URL): YouTubeRef | null {
  const host = url.hostname
  const isYouTube = hostMatches(host, 'youtube.com') || hostMatches(host, 'youtube-nocookie.com')
  const isShort = hostMatches(host, 'youtu.be')
  if (!isYouTube && !isShort) return null

  let videoId: string | undefined
  if (isShort) {
    videoId = url.pathname.slice(1).split('/')[0]
  } else if (url.pathname === '/watch') {
    videoId = url.searchParams.get('v') ?? undefined
  } else {
    const m = url.pathname.match(/^\/(?:embed|shorts|live|v)\/([\w-]+)/)
    if (m && m[1] !== 'videoseries') videoId = m[1]
  }
  if (videoId && !YT_ID.test(videoId)) videoId = undefined

  const list = url.searchParams.get('list')
  const listId = list && /^[\w-]+$/.test(list) ? list : undefined
  if (!videoId && !listId) return null
  return { videoId, listId }
}

export type SpotifyKind = 'playlist' | 'album' | 'track' | 'episode' | 'show' | 'artist'

export interface SpotifyRef {
  kind: SpotifyKind
  id: string
}

export function parseSpotify(input: string): SpotifyRef | null {
  const text = input.trim()
  const uri = text.match(/^spotify:(playlist|album|track|episode|show|artist):([A-Za-z0-9]+)$/)
  if (uri) return { kind: uri[1] as SpotifyKind, id: uri[2] }
  const url = tryUrl(text)
  if (!url || !hostMatches(url.hostname, 'open.spotify.com')) return null
  const m = url.pathname.match(/^\/(?:intl-[\w-]+\/)?(?:embed\/)?(playlist|album|track|episode|show|artist)\/([A-Za-z0-9]+)/)
  return m ? { kind: m[1] as SpotifyKind, id: m[2] } : null
}

export type MusicSource = ({ provider: 'youtube' } & YouTubeRef) | ({ provider: 'spotify' } & SpotifyRef)

export function parseMusicInput(raw: string): MusicSource | null {
  const spotify = parseSpotify(raw)
  if (spotify) return { provider: 'spotify', ...spotify }
  const url = tryUrl(raw.trim()) ?? tryUrl(`https://${raw.trim()}`)
  const yt = url ? parseYouTube(url) : null
  return yt ? { provider: 'youtube', ...yt } : null
}

/** Enlaces que son solo de música y van directos al reproductor. */
export function isMusicUrl(url: URL): boolean {
  return hostMatches(url.hostname, 'music.youtube.com') || hostMatches(url.hostname, 'open.spotify.com')
}

export function musicSourceUrl(src: MusicSource): string {
  if (src.provider === 'spotify') return `https://open.spotify.com/${src.kind}/${src.id}`
  if (src.videoId) {
    return `https://www.youtube.com/watch?v=${src.videoId}${src.listId ? `&list=${src.listId}` : ''}`
  }
  return `https://www.youtube.com/playlist?list=${src.listId}`
}

/* ------------------------------------------------------------------ */
/* Ver la web dentro de la app                                         */
/* ------------------------------------------------------------------ */

export interface EmbedInfo {
  src: string
  /** Aviso a mostrar junto a la página incrustada. */
  hint?: 'google-login' | 'search'
}

const EMBEDDABLE_HOSTS = [
  'wikipedia.org', 'wiktionary.org', 'wikibooks.org', 'wikisource.org', 'wikiversity.org', 'wikimedia.org',
  'desmos.com', 'geogebra.org', 'phet.colorado.edu', 'excalidraw.com', 'photopea.com', 'bellard.org', 'copy.sh',
]

/**
 * La mayoría de webs (Instagram, Gmail, Classroom...) prohíben mostrarse dentro de otra página.
 * Aquí están las que sí se dejan; el resto se abre en una pestaña nueva.
 */
export function getEmbed(url: URL): EmbedInfo | null {
  const yt = parseYouTube(url)
  if (yt && !hostMatches(url.hostname, 'music.youtube.com')) {
    if (yt.videoId) {
      return { src: `https://www.youtube.com/embed/${yt.videoId}${yt.listId ? `?list=${yt.listId}` : ''}` }
    }
    return { src: `https://www.youtube.com/embed/videoseries?list=${yt.listId}` }
  }

  if (hostMatches(url.hostname, 'vimeo.com')) {
    const m = url.pathname.match(/^\/(\d+)/)
    if (m) return { src: `https://player.vimeo.com/video/${m[1]}` }
  }

  const query = getSearchQuery(url)
  if (query !== null && GOOGLE_SEARCH_HOST.test(url.hostname)) {
    return { src: `https://www.google.com/search?igu=1&q=${encodeURIComponent(query)}`, hint: 'search' }
  }

  if (getGoogleFile(url)) return { src: url.href, hint: 'google-login' }
  if (hostMatches(url.hostname, 'calendar.google.com') && url.pathname.startsWith('/calendar/embed')) {
    return { src: url.href }
  }

  if (EMBEDDABLE_HOSTS.some((h) => hostMatches(url.hostname, h))) return { src: url.href }
  return null
}

/* ------------------------------------------------------------------ */
/* Título y asignatura                                                 */
/* ------------------------------------------------------------------ */

function prettifySegment(segment: string): string {
  let text = segment
  try {
    text = decodeURIComponent(segment)
  } catch {
    /* se queda como está */
  }
  text = text.replace(/\.(html?|php|aspx?)$/i, '').replace(/[_+-]+/g, ' ').trim()
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : ''
}

export function siteName(url: URL): string {
  return url.hostname.replace(/^(www|m)\./, '')
}

/** Título legible a partir de la dirección (sin tener que abrir la página). */
export function deriveTitle(url: URL): string {
  const query = getSearchQuery(url)
  if (query !== null) {
    return hostMatches(url.hostname, 'wikipedia.org') ? `Wikipedia: ${query}` : `Búsqueda: ${query}`
  }
  const file = getGoogleFile(url)
  if (file) return file.label
  for (const [host, name] of GOOGLE_APP_NAMES) {
    if (hostMatches(url.hostname, host)) return name
  }
  if (parseYouTube(url)) return 'Vídeo de YouTube'

  const segments = url.pathname.split('/').filter(Boolean)
  const last = segments.at(-1)
  if (hostMatches(url.hostname, 'wikipedia.org') && segments[0] === 'wiki' && last) return prettifySegment(last)
  const pretty = last && !/^[\w-]{20,}$/.test(last) && !/^\d+$/.test(last) ? prettifySegment(last) : ''
  return pretty || siteName(url)
}

export function detectSubjectForUrl(url: URL, title: string): SubjectId {
  const query = getSearchQuery(url)
  if (query !== null) return detectSubject(query)
  let path = url.pathname
  try {
    path = decodeURIComponent(path)
  } catch {
    /* se queda como está */
  }
  return detectSubject(`${title} ${path}`, url.hostname)
}

/** Clave para no guardar dos veces la misma página. */
export function pageKey(url: URL): string {
  const copy = new URL(url.href)
  copy.hash = ''
  copy.searchParams.delete('igu')
  return copy.href.replace(/\/$/, '')
}
