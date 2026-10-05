import { describe, expect, it } from 'vitest'
import {
  categorize,
  deriveTitle,
  detectSubjectForUrl,
  getDistraction,
  getEmbed,
  getGoogleFile,
  getMessagingApp,
  getSearchQuery,
  isMusicUrl,
  pageKey,
  parseMusicInput,
  parseSpotify,
  parseYouTube,
  resolveInput,
} from './web'

const u = (s: string) => new URL(s)

describe('resolveInput', () => {
  it('reconoce enlaces completos y dominios sueltos', () => {
    expect(resolveInput('https://es.wikipedia.org/wiki/Derivada')?.href).toBe('https://es.wikipedia.org/wiki/Derivada')
    expect(resolveInput('es.wikipedia.org/wiki/Derivada')?.href).toBe('https://es.wikipedia.org/wiki/Derivada')
    expect(resolveInput('docs.new')?.href).toBe('https://docs.new/')
  })

  it('convierte texto libre en una búsqueda', () => {
    expect(resolveInput('derivadas de un producto')?.href).toBe(
      'https://www.google.com/search?q=derivadas%20de%20un%20producto',
    )
    expect(resolveInput('fotosíntesis', 'wikipedia')?.hostname).toBe('es.wikipedia.org')
  })

  it('ignora entradas vacías', () => {
    expect(resolveInput('   ')).toBeNull()
  })
})

describe('getDistraction', () => {
  it('detecta redes sociales, reels y juegos', () => {
    expect(getDistraction(u('https://www.instagram.com/reels/abc'))).toBe('Instagram')
    expect(getDistraction(u('https://www.tiktok.com/@alguien'))).toBe('TikTok')
    expect(getDistraction(u('https://www.youtube.com/shorts/abcdefghijk'))).toBe('YouTube Shorts')
    expect(getDistraction(u('https://x.com/home'))).toBe('X (Twitter)')
    expect(getDistraction(u('https://poki.com/es'))).toBe('juegos online')
  })

  it('no marca webs de estudio', () => {
    expect(getDistraction(u('https://www.youtube.com/watch?v=dQw4w9WgXcQ'))).toBeNull()
    expect(getDistraction(u('https://es.wikipedia.org/wiki/Roma'))).toBeNull()
    expect(getDistraction(u('https://box.com'))).toBeNull()
  })
})

describe('getMessagingApp', () => {
  it('reconoce apps de mensajería, que no son distracciones bloqueadas', () => {
    expect(getMessagingApp(u('https://web.whatsapp.com/'))).toBe('WhatsApp')
    expect(getMessagingApp(u('https://discord.gg/abc'))).toBe('Discord')
    expect(getMessagingApp(u('https://web.telegram.org/k/'))).toBe('Telegram')
    expect(getMessagingApp(u('https://classroom.google.com/'))).toBeNull()
    expect(getDistraction(u('https://web.whatsapp.com/'))).toBeNull()
  })
})

describe('categorize', () => {
  it('clasifica por tipo de web', () => {
    expect(categorize(u('https://www.google.com/search?q=mitosis'))).toBe('busqueda')
    expect(categorize(u('https://docs.google.com/document/d/abc123/edit'))).toBe('google')
    expect(categorize(u('https://classroom.google.com/c/xyz'))).toBe('google')
    expect(categorize(u('https://www.youtube.com/watch?v=dQw4w9WgXcQ'))).toBe('video')
    expect(categorize(u('https://es.wikipedia.org/wiki/Roma'))).toBe('lectura')
    expect(categorize(u('https://www.desmos.com/calculator'))).toBe('herramienta')
    expect(categorize(u('https://moodle.colegio.es/course/view.php?id=3'))).toBe('clase')
    expect(categorize(u('https://chatgpt.com/'))).toBe('ia')
    expect(categorize(u('https://www.instagram.com/'))).toBe('distraccion')
    expect(categorize(u('https://ejemplo.com/'))).toBe('web')
    expect(categorize(u('https://vscode.dev/'))).toBe('programacion')
    expect(categorize(u('https://colab.research.google.com/drive/abc'))).toBe('programacion')
    expect(categorize(u('https://excalidraw.com/'))).toBe('herramienta')
    expect(categorize(u('https://web.whatsapp.com/'))).toBe('mensajeria')
    expect(categorize(u('https://discord.com/app'))).toBe('mensajeria')
    expect(categorize(u('https://teams.microsoft.com/'))).toBe('clase')
  })
})

describe('getSearchQuery', () => {
  it('extrae lo buscado solo en buscadores', () => {
    expect(getSearchQuery(u('https://www.google.es/search?q=edad+media'))).toBe('edad media')
    expect(getSearchQuery(u('https://es.wikipedia.org/w/index.php?search=atomo'))).toBe('atomo')
    expect(getSearchQuery(u('https://drive.google.com/drive/search?q=apuntes'))).toBeNull()
    expect(getSearchQuery(u('https://es.wikipedia.org/wiki/Atomo'))).toBeNull()
  })
})

describe('Google Workspace', () => {
  it('detecta archivos de Docs, Hojas y Presentaciones', () => {
    expect(getGoogleFile(u('https://docs.google.com/document/d/1AbC_d-E/edit?usp=sharing'))).toEqual({
      type: 'document',
      label: 'Documento de Google',
      id: '1AbC_d-E',
    })
    expect(getGoogleFile(u('https://docs.google.com/spreadsheets/u/0/d/XYZ/edit'))?.type).toBe('spreadsheets')
    expect(getGoogleFile(u('https://docs.google.com/presentation/d/PPT/edit'))?.label).toBe('Presentación de Google')
    expect(getGoogleFile(u('https://docs.google.com/document/u/0/'))).toBeNull()
  })

  it('pone nombre a las apps de Google', () => {
    expect(deriveTitle(u('https://classroom.google.com/u/0/c/123'))).toBe('Google Classroom')
    expect(deriveTitle(u('https://mail.google.com/mail/u/0/'))).toBe('Gmail')
  })
})

describe('música', () => {
  it('entiende enlaces de YouTube y YouTube Music', () => {
    expect(parseYouTube(u('https://www.youtube.com/watch?v=jfKfPfyJRdk'))).toEqual({ videoId: 'jfKfPfyJRdk', listId: undefined })
    expect(parseYouTube(u('https://youtu.be/jfKfPfyJRdk?t=10'))?.videoId).toBe('jfKfPfyJRdk')
    expect(parseYouTube(u('https://music.youtube.com/watch?v=jfKfPfyJRdk&list=RDAMVM123'))).toEqual({
      videoId: 'jfKfPfyJRdk',
      listId: 'RDAMVM123',
    })
    expect(parseYouTube(u('https://music.youtube.com/playlist?list=PL123abc'))).toEqual({ videoId: undefined, listId: 'PL123abc' })
    expect(parseYouTube(u('https://www.youtube.com/@LofiGirl'))).toBeNull()
  })

  it('entiende enlaces y URIs de Spotify', () => {
    expect(parseSpotify('https://open.spotify.com/playlist/37i9dQZF1DWZeKCadgRdKQ?si=abc')).toEqual({
      kind: 'playlist',
      id: '37i9dQZF1DWZeKCadgRdKQ',
    })
    expect(parseSpotify('https://open.spotify.com/intl-es/album/1A2b3C')).toEqual({ kind: 'album', id: '1A2b3C' })
    expect(parseSpotify('spotify:track:6rqhFgbbKwnb9MLmUQDhG6')?.kind).toBe('track')
    expect(parseSpotify('https://example.com/playlist/1')).toBeNull()
  })

  it('elige el reproductor adecuado', () => {
    expect(parseMusicInput('open.spotify.com/playlist/abc')).toBeNull()
    expect(parseMusicInput('https://open.spotify.com/playlist/abc')?.provider).toBe('spotify')
    expect(parseMusicInput('youtu.be/jfKfPfyJRdk')?.provider).toBe('youtube')
    expect(isMusicUrl(u('https://music.youtube.com/watch?v=jfKfPfyJRdk'))).toBe(true)
    expect(isMusicUrl(u('https://www.youtube.com/watch?v=jfKfPfyJRdk'))).toBe(false)
  })
})

describe('getEmbed', () => {
  it('muestra dentro de la app las webs que lo permiten', () => {
    expect(getEmbed(u('https://www.youtube.com/watch?v=jfKfPfyJRdk'))?.src).toBe('https://www.youtube.com/embed/jfKfPfyJRdk')
    expect(getEmbed(u('https://es.wikipedia.org/wiki/Derivada'))?.src).toBe('https://es.wikipedia.org/wiki/Derivada')
    expect(getEmbed(u('https://www.google.com/search?q=mitosis'))).toEqual({
      src: 'https://www.google.com/search?igu=1&q=mitosis',
      hint: 'search',
    })
    expect(getEmbed(u('https://docs.google.com/document/d/abc/edit'))?.hint).toBe('google-login')
    expect(getEmbed(u('https://excalidraw.com/'))?.src).toBe('https://excalidraw.com/')
    expect(getEmbed(u('https://bellard.org/jslinux/'))?.src).toBe('https://bellard.org/jslinux/')
  })

  it('manda a pestaña nueva las que lo bloquean', () => {
    expect(getEmbed(u('https://classroom.google.com/'))).toBeNull()
    expect(getEmbed(u('https://www.instagram.com/'))).toBeNull()
    expect(getEmbed(u('https://music.youtube.com/watch?v=jfKfPfyJRdk'))).toBeNull()
    expect(getEmbed(u('https://vscode.dev/'))).toBeNull()
    expect(getEmbed(u('https://chatgpt.com/'))).toBeNull()
  })
})

describe('títulos y asignaturas', () => {
  it('saca un título legible de la dirección', () => {
    expect(deriveTitle(u('https://es.wikipedia.org/wiki/Revoluci%C3%B3n_francesa'))).toBe('Revolución francesa')
    expect(deriveTitle(u('https://www.google.com/search?q=mitosis'))).toBe('Búsqueda: mitosis')
    expect(deriveTitle(u('https://www.desmos.com/calculator'))).toBe('Calculator')
    expect(deriveTitle(u('https://ejemplo.com/'))).toBe('ejemplo.com')
  })

  it('adivina la asignatura de lo que se está viendo', () => {
    const wiki = u('https://es.wikipedia.org/wiki/Revoluci%C3%B3n_francesa')
    expect(detectSubjectForUrl(wiki, deriveTitle(wiki))).toBe('historia')
    const search = u('https://www.google.com/search?q=como+hacer+derivadas')
    expect(detectSubjectForUrl(search, deriveTitle(search))).toBe('matematicas')
    const desmos = u('https://www.desmos.com/calculator')
    expect(detectSubjectForUrl(desmos, deriveTitle(desmos))).toBe('matematicas')
  })

  it('genera la misma clave para la misma página', () => {
    expect(pageKey(u('https://www.google.com/search?igu=1&q=x'))).toBe(pageKey(u('https://www.google.com/search?q=x')))
    expect(pageKey(u('https://ejemplo.com/a/#parte'))).toBe('https://ejemplo.com/a')
  })
})
