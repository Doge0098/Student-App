import type { CSSProperties } from 'react'
import { useProfile, subjectsForLevel } from '../features/profile/profile'
import { SUBJECT_IDS, SUBJECTS, type SubjectId } from '../lib/subjects'

interface SubjectPickerProps {
  value: SubjectId
  onChange: (subject: SubjectId) => void
}

/** Etiqueta de asignatura con un desplegable para corregirla si se ha adivinado mal. */
export function SubjectPicker({ value, onChange }: SubjectPickerProps) {
  // Una asignatura desconocida (datos de otra versión o editados a mano) se muestra como «General».
  const current: SubjectId = SUBJECT_IDS.includes(value) ? value : 'general'
  const subject = SUBJECTS[current]
  const { level } = useProfile()
  // Solo las asignaturas del curso elegido, y siempre la que ya tiene.
  const forLevel = subjectsForLevel(level)
  const options = Array.isArray(forLevel) ? forLevel.filter((id) => SUBJECT_IDS.includes(id)) : SUBJECT_IDS
  const ids = options.includes(current) ? options : [current, ...options]
  return (
    <label className="subject-chip" style={{ '--subject': subject.color } as CSSProperties} title="Cambiar asignatura">
      <span className="subject-dot" aria-hidden="true" />
      <span className="subject-name">{subject.label}</span>
      <select value={current} onChange={(e) => onChange(e.target.value as SubjectId)} aria-label="Asignatura">
        {ids.map((id) => (
          <option key={id} value={id}>
            {SUBJECTS[id].label}
          </option>
        ))}
      </select>
    </label>
  )
}
