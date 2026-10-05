import type { CSSProperties } from 'react'
import { useProfile, subjectsForLevel } from '../features/profile/profile'
import { SUBJECTS, type SubjectId } from '../lib/subjects'

interface SubjectPickerProps {
  value: SubjectId
  onChange: (subject: SubjectId) => void
}

/** Etiqueta de asignatura con un desplegable para corregirla si se ha adivinado mal. */
export function SubjectPicker({ value, onChange }: SubjectPickerProps) {
  const subject = SUBJECTS[value] ?? SUBJECTS.general
  const { level } = useProfile()
  // Solo las asignaturas del curso elegido, y siempre la que ya tiene.
  const options = subjectsForLevel(level)
  const ids = options.includes(value) ? options : [value, ...options]
  return (
    <label className="subject-chip" style={{ '--subject': subject.color } as CSSProperties} title="Cambiar asignatura">
      <span className="subject-dot" aria-hidden="true" />
      <span className="subject-name">{subject.label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value as SubjectId)} aria-label="Asignatura">
        {ids.map((id) => (
          <option key={id} value={id}>
            {SUBJECTS[id].label}
          </option>
        ))}
      </select>
    </label>
  )
}
