import { describe, expect, it } from 'vitest'
import { FOCUS_MODE_CLASS, focusLayoutClass } from './focusMode'

describe('modo foco en la maquetación', () => {
  it('solo oculta cosas durante un bloque de concentración de este reloj', () => {
    expect(focusLayoutClass(true, 'focus', 'running')).toBe(FOCUS_MODE_CLASS)
    expect(focusLayoutClass(true, 'focus', 'paused')).toBe(FOCUS_MODE_CLASS)
  })

  it('con el reloj parado, en descanso o al acabar, se ve todo aunque el modo siga activo', () => {
    // p. ej. otra pestaña activó el modo foco y esta tiene el reloj parado
    expect(focusLayoutClass(true, 'idle', 'paused')).toBeNull()
    expect(focusLayoutClass(true, 'break', 'running')).toBeNull()
    expect(focusLayoutClass(true, 'focus', 'finished')).toBeNull()
    expect(focusLayoutClass(false, 'focus', 'running')).toBeNull()
  })
})
