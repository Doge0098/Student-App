import { createStore, useStore } from '../../hooks/store'
import type { SubjectId } from '../../lib/subjects'
import { uid } from '../../lib/text'

/** Nota rápida de una asignatura (texto plano). */
export interface Note {
  id: string
  subject: SubjectId
  title: string
  body: string
  updatedAt: number
}

export const notesStore = createStore<Note[]>('notes', [])

export function useNotes() {
  const [notes, setNotes] = useStore(notesStore)
  return {
    notes,
    add: (subject: SubjectId, title = '', body = '') => {
      const note: Note = { id: uid(), subject, title, body, updatedAt: Date.now() }
      setNotes((prev) => [note, ...prev])
      return note
    },
    update: (id: string, patch: Partial<Omit<Note, 'id'>>) =>
      setNotes((prev) => prev.map((n) => (n.id === id ? { ...n, ...patch, updatedAt: Date.now() } : n))),
    remove: (id: string) => setNotes((prev) => prev.filter((n) => n.id !== id)),
  }
}
