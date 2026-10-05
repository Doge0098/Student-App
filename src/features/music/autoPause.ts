/*
 * «Pausar en los descansos»: al empezar un descanso, LockIn pausa lo que suena (música y sonido
 * ambiente) y lo recuerda; al empezar el siguiente bloque de concentración, reanuda SOLO lo que
 * pausó él. Si el estudiante lo vuelve a poner (o cambia de música) entretanto, ya no es cosa de LockIn.
 */

export type TimerPhase = 'idle' | 'focus' | 'break'
export type TimerStatus = 'running' | 'paused' | 'finished'

export interface TimerPoint {
  phase: TimerPhase
  status: TimerStatus
}

export type TimerTransition = 'break-start' | 'focus-start' | null

const focusRunning = (t: TimerPoint) => t.phase === 'focus' && t.status === 'running'
const inBreak = (t: TimerPoint) => t.phase === 'break' && t.status !== 'finished'

/**
 * Qué ha pasado entre dos estados del temporizador.
 * - 'break-start': empieza un descanso (no cuenta alargarlo, ni un descanso que ya ha terminado).
 * - 'focus-start': empieza (o vuelve a correr) un bloque de concentración.
 */
export function timerTransition(prev: TimerPoint, next: TimerPoint): TimerTransition {
  if (inBreak(next) && prev.phase !== 'break') return 'break-start'
  if (focusRunning(next) && !focusRunning(prev)) return 'focus-start'
  return null
}

/**
 * Lo que LockIn recuerda de cada reproductor:
 * - 'none': nada que reanudar.
 * - 'pending': ha pedido la pausa y espera a que el reproductor la confirme.
 * - 'held': está en pausa por LockIn; se reanudará al volver a estudiar.
 */
export type Hold = 'none' | 'pending' | 'held'

/** Al empezar el descanso: solo se pausa (y se recuerda) lo que estaba sonando. */
export function holdOnBreak(isPlaying: boolean): Hold {
  return isPlaying ? 'pending' : 'none'
}

/**
 * Cuando el reproductor cambia de estado. Si vuelve a sonar estando en pausa por LockIn,
 * es que el estudiante lo ha puesto él: ya no hay nada que reanudar.
 */
export function nextHold(hold: Hold, isPlaying: boolean): Hold {
  if (hold === 'pending' && !isPlaying) return 'held'
  if (hold === 'held' && isPlaying) return 'none'
  return hold
}

/** ¿Hay que reanudarlo al empezar el bloque de concentración? */
export function shouldResume(hold: Hold): boolean {
  return hold !== 'none'
}

/** Aviso corto al pausar, para que no parezca que algo ha fallado. */
export function pauseMessage(music: boolean, ambient: boolean): string | null {
  if (music) return 'Música en pausa durante el descanso: volverá sola al seguir estudiando.'
  if (ambient) return 'Sonido ambiente en pausa durante el descanso: volverá solo al seguir estudiando.'
  return null
}
