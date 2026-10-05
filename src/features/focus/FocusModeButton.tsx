import { Focus } from 'lucide-react'
import { useFocusMode } from './focusMode'
import './focus.css'

/** Botón pequeño (cabecera del temporizador) para entrar y salir del modo foco. */
export function FocusModeButton() {
  const { on, toggle } = useFocusMode()
  return (
    <button
      type="button"
      className={`btn btn-small focus-mode-btn ${on ? 'is-on' : ''}`}
      aria-pressed={on}
      title={on ? 'Volver a ver todo' : 'Oculta todo menos el reloj y el navegador hasta que acabe el bloque'}
      onClick={toggle}
    >
      <Focus size={14} aria-hidden="true" /> Modo foco
    </button>
  )
}
