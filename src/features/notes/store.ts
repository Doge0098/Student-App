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

/** Cambia una nota (y su fecha de edición). Se puede usar fuera de React, p. ej. al autoguardar. */
export function updateNote(id: string, patch: Partial<Omit<Note, 'id'>>): void {
  notesStore.set((prev) => prev.map((n) => (n.id === id ? { ...n, ...patch, updatedAt: Date.now() } : n)))
}

export function useNotes() {
  const [stored, setNotes] = useStore(notesStore)
  // Datos editados a mano o de otra versión: nunca rompen la vista.
  const notes = Array.isArray(stored) ? stored : []
  return {
    notes,
    add: (subject: SubjectId, title = '', body = '') => {
      const note: Note = { id: uid(), subject, title, body, updatedAt: Date.now() }
      setNotes((prev) => [note, ...(Array.isArray(prev) ? prev : [])])
      return note
    },
    update: updateNote,
    remove: (id: string) => setNotes((prev) => prev.filter((n) => n.id !== id)),
  }
}
