import { Compass, Headphones, ListTodo, Timer } from 'lucide-react'
import type { ReactNode } from 'react'
import { Modal } from '../../components/Modal'

const STEPS: { icon: ReactNode; title: string; text: string }[] = [
  {
    icon: <Timer size={18} />,
    title: 'Concentración',
    text: 'Elige cuánto tiempo (mínimo 30 min) y pulsa Empezar. Al acabar te pregunto si quieres descansar o seguir.',
  },
  { icon: <ListTodo size={18} />, title: 'Tareas', text: 'Apunta lo que tienes que hacer y táchalo al terminar.' },
  {
    icon: <Compass size={18} />,
    title: 'Navegador y apps',
    text: 'Busca, abre tus apps (Google, IA, programación…) y vuelve a lo que estabas haciendo con un clic.',
  },
  { icon: <Headphones size={18} />, title: 'Música', text: 'Pon YouTube o Spotify sin salir de aquí.' },
]

export function WelcomeGuide({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Modal open={open} title="Todo para estudiar, en un solo sitio" onClose={onClose} wide>
      <ol className="welcome-steps">
        {STEPS.map((step) => (
          <li key={step.title}>
            <span className="welcome-icon" aria-hidden="true">
              {step.icon}
            </span>
            <span>
              <strong>{step.title}</strong>
              <span className="welcome-text">{step.text}</span>
            </span>
          </li>
        ))}
      </ol>
      <p className="hint">Puedes cambiar los colores y entrar en tus cuentas desde el botón de ajustes ⚙.</p>
      <button type="button" className="btn btn-primary btn-block" data-autofocus onClick={onClose}>
        ¡A estudiar!
      </button>
    </Modal>
  )
}
