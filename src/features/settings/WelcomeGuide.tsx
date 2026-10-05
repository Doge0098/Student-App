import { Compass, Headphones, ListTodo, Timer } from 'lucide-react'
import type { ReactNode } from 'react'
import { Modal } from '../../components/Modal'
import { CourseSelector } from '../profile/CourseSelector'
import { useProfile } from '../profile/profile'

const STEPS: { icon: ReactNode; title: string; text: string }[] = [
  {
    icon: <Timer size={18} />,
    title: 'Concentración',
    text: 'Elige cuánto tiempo (mínimo 30 min) y pulsa Empezar. Al acabar te pregunto si quieres descansar o seguir.',
  },
  { icon: <ListTodo size={18} />, title: 'Tareas', text: 'Apunta tareas y exámenes, y táchalos al terminar.' },
  {
    icon: <Compass size={18} />,
    title: 'Estudio',
    text: 'Busca, abre tus apps, toma notas, repasa con tarjetas o pregunta a la IA, sin salir de aquí.',
  },
  { icon: <Headphones size={18} />, title: 'Música', text: 'YouTube, Spotify o sonidos para concentrarte.' },
]

export function WelcomeGuide({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { level, setLevel } = useProfile()
  return (
    <Modal open={open} title="Bienvenido a LockIn" onClose={onClose} wide>
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
      <div className="setting">
        <span className="setting-label">¿Qué estudias?</span>
        <CourseSelector value={level} onChange={setLevel} label="Tu curso" />
      </div>
      <p className="hint">El curso, el modo de estudio, los colores y tus cuentas se cambian en Ajustes ⚙.</p>
      <button type="button" className="btn btn-primary btn-block" data-autofocus onClick={onClose}>
        ¡A estudiar!
      </button>
    </Modal>
  )
}
