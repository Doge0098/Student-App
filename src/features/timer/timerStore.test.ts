import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createStore } from '../../hooks/store'
import {
  IDLE,
  finishSoloBlock,
  normalizeTimer,
  readFreshTimer,
  soloStudiedMinutes,
  updateFreshTimer,
  type TimerState,
} from './timerStore'

const MIN = 60_000
const NOW = Date.UTC(2026, 9, 5, 16, 0)

/** localStorage de mentira, compartido por las «pestañas» de cada prueba. */
function fakeStorage() {
  const map = new Map<string, string>()
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
    map,
  }
}

/**
 * Cada pestaña tiene su propio store en memoria sobre el mismo almacenamiento. Aquí no llega el aviso
 * entre pestañas (evento `storage`): es justo el caso en que una pestaña va con retraso.
 */
const openTab = () => createStore<unknown>('timer', IDLE)

const running = (endsAt: number): TimerState => ({
  phase: 'focus',
  status: 'running',
  durationMs: 30 * MIN,
  endsAt,
  remainingMs: 30 * MIN,
  taskId: 't1',
  taskSubject: 'matematicas',
})

let storage: ReturnType<typeof fakeStorage>

beforeEach(() => {
  storage = fakeStorage()
  vi.stubGlobal('localStorage', storage)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('estado guardado del temporizador', () => {
  it('lee lo guardado con la forma de siempre', () => {
    const old = { phase: 'focus', status: 'paused', durationMs: 30 * MIN, endsAt: null, remainingMs: 12 * MIN }
    expect(normalizeTimer(old)).toEqual({ ...old, taskId: null, taskSubject: null })
    expect(normalizeTimer(running(NOW))).toEqual(running(NOW))
  })

  it('si está roto, vuelve al reposo', () => {
    expect(normalizeTimer(null)).toBe(IDLE)
    expect(normalizeTimer('hola')).toBe(IDLE)
    expect(normalizeTimer({ phase: 'otra', status: 'running' })).toBe(IDLE)
    expect(normalizeTimer({ phase: 'focus', status: 'running', durationMs: 'x', endsAt: 'y', remainingMs: -5 })).toMatchObject({
      durationMs: 0,
      endsAt: null,
      remainingMs: 0,
    })
  })

  it('lee lo último que escribió otra pestaña', () => {
    const a = openTab()
    const b = openTab()
    a.set(running(NOW + 30 * MIN))
    expect(normalizeTimer(b.get()).phase).toBe('idle') // B aún no se ha enterado…
    expect(readFreshTimer(b)).toEqual(running(NOW + 30 * MIN)) // …pero lo guardado sí lo tiene
    storage.map.set('student-app:timer', '{roto')
    expect(readFreshTimer(b)).toEqual(normalizeTimer(b.get()))
  })
})

describe('varias pestañas con el mismo bloque', () => {
  it('al llegar a cero solo una pestaña apunta el bloque', () => {
    const endsAt = NOW + 30 * MIN
    const a = openTab()
    a.set(running(endsAt))
    const b = openTab() // B se abre con el bloque en marcha

    const first = finishSoloBlock(endsAt, a)
    expect(first).toEqual(running(endsAt))
    expect(readFreshTimer(a)).toMatchObject({ phase: 'focus', status: 'finished', endsAt: null, remainingMs: 0 })

    expect(finishSoloBlock(endsAt, b)).toBeNull()
    // B se pone al día con lo guardado.
    expect(normalizeTimer(b.get())).toMatchObject({ status: 'finished' })
  })

  it('un bloque que se terminó en otra pestaña no vuelve como «terminado» ni se apunta', () => {
    const endsAt = NOW + 30 * MIN
    const a = openTab()
    a.set(running(endsAt))
    const b = openTab()

    // «Terminar» en A a los 29 min: se para antes de apuntar.
    const stopped = updateFreshTimer((s) => ({ ...IDLE, taskId: s.taskId ?? null, taskSubject: s.taskSubject ?? null }), a)
    expect(soloStudiedMinutes(stopped, endsAt - MIN)).toBe(29)

    // B (con el bloque viejo en memoria) llega a cero: no apunta nada ni pisa el reposo.
    expect(finishSoloBlock(endsAt, b)).toBeNull()
    expect(readFreshTimer(a)).toMatchObject({ phase: 'idle', taskId: 't1' })

    // Y si B también pulsa «Terminar», no hay nada más que contar.
    const again = updateFreshTimer((s) => s, b)
    expect(soloStudiedMinutes(again, endsAt - MIN)).toBe(0)
  })

  it('unirse a una sala en otra pestaña para el bloque propio para todas', () => {
    const endsAt = NOW + 30 * MIN
    const a = openTab()
    a.set(running(endsAt))
    const b = openTab()

    const before = updateFreshTimer((s) => ({ ...IDLE, taskId: s.taskId ?? null }), b)
    expect(soloStudiedMinutes(before, NOW + 10 * MIN)).toBe(10)
    expect(finishSoloBlock(endsAt, a)).toBeNull()
    expect(normalizeTimer(a.get()).phase).toBe('idle')
  })

  it('no apunta un bloque nuevo con otra hora de fin', () => {
    const a = openTab()
    a.set(running(NOW + 30 * MIN))
    const b = openTab()
    // A empieza otro bloque; B llega a cero con el viejo.
    updateFreshTimer(() => running(NOW + 60 * MIN), a)
    expect(finishSoloBlock(NOW + 30 * MIN, b)).toBeNull()
    expect(readFreshTimer(a)).toEqual(running(NOW + 60 * MIN))
    expect(finishSoloBlock(null, a)).toBeNull()
  })
})

describe('sin poder guardar (almacenamiento lleno)', () => {
  it('el reloj sigue funcionando con lo de esta pestaña', () => {
    const endsAt = NOW + 30 * MIN
    const a = openTab()
    storage.setItem = () => {
      throw new Error('QuotaExceededError')
    }
    updateFreshTimer(() => running(endsAt), a)
    expect(readFreshTimer(a)).toEqual(running(endsAt))
    expect(updateFreshTimer((s) => ({ ...s, status: 'paused', endsAt: null, remainingMs: 10 * MIN }), a)).toEqual(running(endsAt))
    updateFreshTimer((s) => ({ ...s, status: 'running', endsAt }), a)
    expect(finishSoloBlock(endsAt, a)).toMatchObject({ phase: 'focus', endsAt })
    expect(readFreshTimer(a)).toMatchObject({ status: 'finished' })
  })
})

describe('minutos estudiados al parar', () => {
  it('cuenta solo bloques de estudio sin terminar', () => {
    const endsAt = NOW + 30 * MIN
    expect(soloStudiedMinutes(running(endsAt), NOW + 12.5 * MIN)).toBe(12)
    expect(soloStudiedMinutes({ ...running(endsAt), status: 'paused', endsAt: null, remainingMs: 10 * MIN }, NOW)).toBe(20)
    expect(soloStudiedMinutes({ ...running(endsAt), status: 'finished' }, NOW)).toBe(0)
    expect(soloStudiedMinutes({ ...running(endsAt), phase: 'break' }, NOW + 5 * MIN)).toBe(0)
    expect(soloStudiedMinutes(IDLE, NOW)).toBe(0)
  })
})
