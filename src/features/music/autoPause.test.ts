import { describe, expect, it } from 'vitest'
import { holdOnBreak, nextHold, pauseMessage, shouldResume, timerTransition, type Hold, type TimerPoint } from './autoPause'

const idle: TimerPoint = { phase: 'idle', status: 'paused' }
const focus: TimerPoint = { phase: 'focus', status: 'running' }
const focusPaused: TimerPoint = { phase: 'focus', status: 'paused' }
const focusDone: TimerPoint = { phase: 'focus', status: 'finished' }
const rest: TimerPoint = { phase: 'break', status: 'running' }
const restPaused: TimerPoint = { phase: 'break', status: 'paused' }
const restDone: TimerPoint = { phase: 'break', status: 'finished' }

describe('timerTransition', () => {
  it('detecta el inicio del descanso al responder «descansar»', () => {
    expect(timerTransition(focusDone, rest)).toBe('break-start')
    expect(timerTransition(idle, rest)).toBe('break-start')
    expect(timerTransition(focus, rest)).toBe('break-start')
  })

  it('no vuelve a pausar al alargar o reanudar el mismo descanso', () => {
    expect(timerTransition(restDone, rest)).toBeNull()
    expect(timerTransition(restPaused, rest)).toBeNull()
    expect(timerTransition(rest, restPaused)).toBeNull()
  })

  it('un descanso que ya ha terminado (sala sin contestar) no es un inicio de descanso', () => {
    expect(timerTransition(focusDone, restDone)).toBeNull()
  })

  it('detecta el inicio del bloque de concentración', () => {
    expect(timerTransition(restDone, focus)).toBe('focus-start')
    expect(timerTransition(idle, focus)).toBe('focus-start')
    expect(timerTransition(focusDone, focus)).toBe('focus-start')
    expect(timerTransition(rest, focus)).toBe('focus-start')
  })

  it('no hace nada si no cambia nada o al pausar/parar', () => {
    expect(timerTransition(focus, focus)).toBeNull()
    expect(timerTransition(rest, rest)).toBeNull()
    expect(timerTransition(focus, focusPaused)).toBeNull()
    expect(timerTransition(focus, focusDone)).toBeNull()
    expect(timerTransition(rest, idle)).toBeNull()
    expect(timerTransition(focus, idle)).toBeNull()
  })
})

describe('memoria de lo que pausa LockIn', () => {
  it('solo recuerda lo que estaba sonando', () => {
    expect(holdOnBreak(true)).toBe('pending')
    expect(holdOnBreak(false)).toBe('none')
  })

  it('pausa → descanso → vuelve a estudiar: se reanuda', () => {
    let hold: Hold = holdOnBreak(true)
    hold = nextHold(hold, true) // el reproductor aún no ha confirmado la pausa
    expect(hold).toBe('pending')
    hold = nextHold(hold, false)
    expect(hold).toBe('held')
    expect(shouldResume(hold)).toBe(true)
  })

  it('si el estudiante la vuelve a poner en el descanso, ya no se toca', () => {
    let hold: Hold = nextHold(holdOnBreak(true), false)
    hold = nextHold(hold, true)
    expect(hold).toBe('none')
    // Y si luego la pausa él, tampoco se reanuda.
    hold = nextHold(hold, false)
    expect(shouldResume(hold)).toBe(false)
  })

  it('lo que el estudiante pausó antes del descanso no se reanuda', () => {
    expect(shouldResume(holdOnBreak(false))).toBe(false)
  })
})

describe('pauseMessage', () => {
  it('explica qué se ha pausado', () => {
    expect(pauseMessage(true, true)).toMatch(/^Música en pausa/)
    expect(pauseMessage(false, true)).toMatch(/^Sonido ambiente en pausa/)
    expect(pauseMessage(false, false)).toBeNull()
  })
})
