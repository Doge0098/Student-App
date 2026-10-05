import type { CSSProperties } from 'react'
import { SUBJECTS, SUBJECT_IDS, type SubjectId } from '../lib/subjects'

interface SubjectPickerProps {
  value: SubjectId
  onChange: (subject: SubjectId) => void
}

/** Etiqueta de asignatura con un desplegable para corregirla si se ha adivinado mal. */
export function SubjectPicker({ value, onChange }: SubjectPickerProps) {
  const subject = SUBJECTS[value] ?? SUBJECTS.general
  return (
    <label className="subject-chip" style={{ '--subject': subject.color } as CSSProperties} title="Cambiar asignatura">
      <span className="subject-dot" aria-hidden="true" />
      <span className="subject-name">{subject.label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value as SubjectId)} aria-label="Asignatura">
        {SUBJECT_IDS.map((id) => (
          <option key={id} value={id}>
            {SUBJECTS[id].label}
          </option>
        ))}
      </select>
    </label>
  )
}
