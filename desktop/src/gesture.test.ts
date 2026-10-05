import { describe, expect, it } from 'vitest'
import { createGestureGate } from './gesture'
import { createMediaGrants, DENIAL_MEMORY_MS, normalizeMediaTypes } from './mediaGrants'

describe('puerta de gestos (ventanas emergentes)', () => {
  it('sin ninguna acción del estudiante no se abre nada', () => {
    const gate = createGestureGate(() => 5000)
    expect(gate.consume()).toBe(false)
  })

  it('tras un clic se deja abrir una, y solo una', () => {
    let t = 1000
    const gate = createGestureGate(() => t)
    gate.noteInput()
    t += 300
    expect(gate.consume()).toBe(true)
    expect(gate.consume()).toBe(false)
  })

  it('un clic de hace rato ya no vale', () => {
    let t = 1000
    const gate = createGestureGate(() => t)
    gate.noteInput()
    t += 1500
    expect(gate.consume()).toBe(false)
  })
})

describe('permisos de cámara y micrófono', () => {
  const origin = 'https://meet.example'

  it('dejar usar el micrófono no deja usar la cámara', () => {
    const g = createMediaGrants()
    g.grant(origin, ['audio'])
    expect(g.check(origin, ['audio']).action).toBe('allow')
    expect(g.check(origin, ['video'])).toEqual({ action: 'ask', missing: ['video'] })
    expect(g.check(origin, ['audio', 'video'])).toEqual({ action: 'ask', missing: ['video'] })
    expect(g.isGranted(origin, 'video')).toBe(false)
  })

  it('un «No permitir» se recuerda un rato y luego se puede volver a preguntar', () => {
    let t = 0
    const g = createMediaGrants(() => t)
    g.deny(origin, ['audio'])
    expect(g.check(origin, ['audio']).action).toBe('deny')
    t += DENIAL_MEMORY_MS + 1
    expect(g.check(origin, ['audio']).action).toBe('ask')
  })

  it('cada web tiene los suyos', () => {
    const g = createMediaGrants()
    g.grant(origin, ['audio'])
    expect(g.check('https://otra.example', ['audio']).action).toBe('ask')
  })

  it('normaliza los tipos pedidos', () => {
    expect(normalizeMediaTypes(['video', 'audio', 'video'])).toEqual(['video', 'audio'])
    expect(normalizeMediaTypes(undefined)).toEqual(['audio'])
    expect(normalizeMediaTypes(['raro'])).toEqual(['audio'])
  })
})
