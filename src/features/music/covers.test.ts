import { describe, expect, it } from 'vitest'
import { coverUrl, providerLabel } from './covers'

describe('coverUrl', () => {
  it('YouTube: la portada sale del identificador del vídeo', () => {
    expect(coverUrl('https://www.youtube.com/watch?v=jfKfPfyJRdk')).toBe('https://i.ytimg.com/vi/jfKfPfyJRdk/hqdefault.jpg')
    expect(coverUrl('https://music.youtube.com/watch?v=jfKfPfyJRdk&list=RDAMVM1')).toBe('https://i.ytimg.com/vi/jfKfPfyJRdk/hqdefault.jpg')
  })

  it('Spotify: usa la portada guardada, y solo si es https', () => {
    expect(coverUrl('https://open.spotify.com/playlist/abc', 'https://i.scdn.co/image/x')).toBe('https://i.scdn.co/image/x')
    expect(coverUrl('https://open.spotify.com/playlist/abc')).toBeNull()
    expect(coverUrl('https://open.spotify.com/playlist/abc', 'javascript:alert(1)')).toBeNull()
  })

  it('una lista de YouTube sin vídeo no tiene portada', () => {
    expect(coverUrl('https://www.youtube.com/playlist?list=PL123abc')).toBeNull()
  })
})

describe('providerLabel', () => {
  it('nombra las dos fuentes como las conoce el estudiante', () => {
    expect(providerLabel('https://open.spotify.com/playlist/abc')).toBe('Spotify')
    expect(providerLabel('https://music.youtube.com/playlist?list=PL1')).toBe('YouTube Music')
  })
})
