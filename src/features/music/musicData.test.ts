import { describe, expect, it } from 'vitest'
import { cleanMusicData } from './musicData'

const yt = { id: 'a', name: 'Lofi', url: 'https://www.youtube.com/watch?v=jfKfPfyJRdk' }
const sp = { id: 'b', name: 'Deep Focus', url: 'https://open.spotify.com/playlist/37i9dQZF1DWZeKCadgRdKQ' }

describe('cleanMusicData (lo que se guardó de Spotify)', () => {
  it('quita las listas de Spotify y deja las de YouTube', () => {
    const r = cleanMusicData(null, [sp, yt])
    expect(r.stations).toEqual([yt])
  })

  it('si solo había Spotify, vuelven las listas de serie', () => {
    const r = cleanMusicData(null, [sp])
    expect(r.stations.length).toBeGreaterThan(0)
    expect(r.stations.every((s) => s.url.includes('youtube.com'))).toBe(true)
  })

  it('lo que cuelga de Spotify (la canción que sonaba) se descarta', () => {
    expect(cleanMusicData({ provider: 'spotify', kind: 'playlist', id: 'x' }, [yt]).source).toBeNull()
    const ok = { provider: 'youtube', videoId: 'jfKfPfyJRdk' }
    expect(cleanMusicData(ok, [yt]).source).toBe(ok)
  })

  it('si no hay nada que quitar devuelve lo mismo (sin volver a guardar)', () => {
    const list = [yt]
    expect(cleanMusicData(null, list).stations).toBe(list)
  })

  it('datos rotos no rompen nada', () => {
    expect(cleanMusicData(undefined, 'x').stations.length).toBeGreaterThan(0)
  })
})
