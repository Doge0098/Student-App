/**
 * Electron no tiene bloqueador de ventanas emergentes: una web podría abrir decenas sin que
 * nadie pulse nada. Solo se dejan abrir justo después de una acción real del estudiante
 * (clic o tecla), y una sola por acción.
 */
export const GESTURE_WINDOW_MS = 1000

export interface GestureGate {
  /** Se llama con cada clic o tecla real dentro de la página. */
  noteInput(): void
  /** ¿Hubo una acción reciente? Si la hubo, se «gasta»: la siguiente apertura necesita otra. */
  consume(): boolean
}

export function createGestureGate(now: () => number = Date.now): GestureGate {
  let last = -Infinity
  return {
    noteInput() {
      last = now()
    },
    consume() {
      if (now() - last > GESTURE_WINDOW_MS) return false
      last = -Infinity
      return true
    },
  }
}
