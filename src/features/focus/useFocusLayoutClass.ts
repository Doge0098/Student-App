import { useTimer } from '../timer/TimerContext'
import { FOCUS_MODE_CLASS, focusLayoutClass, useFocusMode } from './focusMode'

/**
 * Clase para `.layout` (o null): el modo foco solo oculta cosas mientras ESTE reloj está en un bloque
 * de concentración. Así una pestaña con el reloj parado nunca se queda con Tareas y Música ocultas
 * y sin el botón para salir. Hay que usarlo dentro de <TimerProvider>.
 */
export function useFocusLayoutClass(): typeof FOCUS_MODE_CLASS | null {
  const { on } = useFocusMode()
  const { phase, status } = useTimer()
  return focusLayoutClass(on, phase, status)
}
