import { describe, expect, it } from 'vitest'
import { MAX_DISTRACTIONS, addDistraction } from './myDistractions'

describe('addDistraction', () => {
  it('añade el dominio limpio al final', () => {
    expect(addDistraction('https://www.marca.com/futbol', ['as.com'])).toEqual({
      ok: true,
      list: ['as.com', 'marca.com'],
      domain: 'marca.com',
    })
  })

  it('explica por qué no se añade', () => {
    expect(addDistraction('hola que tal', [])).toMatchObject({ ok: false, error: expect.stringContaining('no parece una web') })
    expect(addDistraction('Marca.com', ['marca.com'])).toEqual({ ok: false, error: 'Ya está en tu lista.' })
    expect(addDistraction('instagram.com', [])).toEqual({ ok: false, error: 'No hace falta: ya vigilo Instagram.' })
    expect(addDistraction('www.poki.es', [])).toEqual({ ok: false, error: 'No hace falta: ya vigilo juegos online.' })
  })

  it('YouTube entero se puede añadir (de serie solo se vigilan los Shorts)', () => {
    expect(addDistraction('youtube.com', [])).toMatchObject({ ok: true, domain: 'youtube.com' })
  })

  it('tiene un tope', () => {
    const full = Array.from({ length: MAX_DISTRACTIONS }, (_, i) => `web${i}.com`)
    expect(addDistraction('marca.com', full)).toMatchObject({ ok: false, error: expect.stringContaining('llena') })
  })

  it('si se escribe una parte que ya vigilo (Shorts), lo dice en vez de añadir YouTube entero', () => {
    const r = addDistraction('https://www.youtube.com/shorts/abcdefghijk', [])
    expect(r.ok).toBe(false)
    expect(!r.ok && r.error).toMatch(/Shorts/)
    expect(addDistraction('youtube.com/shorts', []).ok).toBe(false)
  })
})
