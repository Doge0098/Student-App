import { createStore, useStore } from '../../hooks/store'
import type { SubjectId } from '../../lib/subjects'
import { uid } from '../../lib/text'
import { cleanList, cleanSubject, finiteOr, isRecord, sameFields, withClean } from '../tasks/cleanStore'

/** Nota rápida de una asignatura (texto plano). */
export interface Note {
  id: string
  subject: SubjectId
  title: string
  body: string
  updatedAt: number
}

function cleanNote(item: unknown): Note | null {
  if (!isRecord(item) || typeof item.id !== 'string') return null
  const fixed = {
    subject: cleanSubject(item.subject),
    title: typeof item.title === 'string' ? item.title : '',
    body: typeof item.body === 'string' ? item.body : '',
    updatedAt: finiteOr(item.updatedAt, 0),
  }
  return sameFields(item, fixed) ? (item as unknown as Note) : ({ ...item, ...fixed } as Note)
}

/** Notas guardadas, limpias. Datos editados a mano o de otra versión nunca rompen la vista. */
export function cleanNotes(value: unknown): Note[] {
  return cleanList(value, cleanNote)
}

export const notesStore = withClean(createStore<Note[]>('notes', []), cleanNotes)

/** Cambia una nota (y su fecha de edición). Se puede usar fuera de React, p. ej. al autoguardar. */
export function updateNote(id: string, patch: Partial<Omit<Note, 'id'>>): void {
  notesStore.set((prev) => prev.map((n) => (n.id === id ? { ...n, ...patch, updatedAt: Date.now() } : n)))
}

export function useNotes() {
  const [notes, setNotes] = useStore(notesStore)
  return {
    notes,
    add: (subject: SubjectId, title = '', body = '') => {
      const note: Note = { id: uid(), subject, title, body, updatedAt: Date.now() }
      setNotes((prev) => [note, ...prev])
      return note
    },
    update: updateNote,
    remove: (id: string) => setNotes((prev) => prev.filter((n) => n.id !== id)),
  }
}
