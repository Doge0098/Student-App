import { describe, expect, it } from 'vitest'
import { coverUrl } from './covers'

describe('coverUrl', () => {
  it('YouTube: la portada sale del identificador del vídeo', () => {
    expect(coverUrl('https://www.youtube.com/watch?v=jfKfPfyJRdk')).toBe('https://i.ytimg.com/vi/jfKfPfyJRdk/hqdefault.jpg')
    expect(coverUrl('https://music.youtube.com/watch?v=jfKfPfyJRdk&list=RDAMVM1')).toBe('https://i.ytimg.com/vi/jfKfPfyJRdk/hqdefault.jpg')
  })

  it('una lista de YouTube sin vídeo no tiene portada', () => {
    expect(coverUrl('https://www.youtube.com/playlist?list=PL123abc')).toBeNull()
  })
})
