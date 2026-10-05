import { useId } from 'react'
import { LEVELS, LEVEL_IDS, type LevelId } from './profile'
import './study.css'

interface CourseSelectorProps {
  /** null = aún no lo ha elegido. */
  value: LevelId | null
  onChange: (level: LevelId) => void
  /** Nombre accesible del grupo. */
  label?: string
}

/** Elegir curso: tarjetas pequeñas con botones de opción (también para la guía de bienvenida). */
export function CourseSelector({ value, onChange, label = 'Tu curso' }: CourseSelectorProps) {
  const name = useId()
  return (
    <div className="study-choices study-courses" role="radiogroup" aria-label={label}>
      {LEVEL_IDS.map((id) => (
        <label key={id} className={`study-choice ${value === id ? 'is-selected' : ''}`}>
          <input type="radio" name={name} value={id} checked={value === id} onChange={() => onChange(id)} />
          <span className="study-choice-text">
            <span className="study-choice-label">{LEVELS[id].label}</span>
            <span className="study-choice-hint">{LEVELS[id].hint}</span>
          </span>
        </label>
      ))}
    </div>
  )
}
