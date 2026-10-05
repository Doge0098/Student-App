import { SUBJECT_IDS, type SubjectId } from '../../lib/subjects'
import { normalize } from '../../lib/text'
import type { Note } from './store'

export type SubjectFilter = SubjectId | 'all'

/** Una nota sin título ni texto (p. ej. «Nueva nota» y no se escribió nada). */
export function isEmptyNote(note: Pick<Note, 'title' | 'body'>): boolean {
  return !note.title.trim() && !note.body.trim()
}

/** Título que se muestra en la lista: el título, o la primera línea del texto. */
export function noteTitle(note: Pick<Note, 'title' | 'body'>): string {
  const title = note.title.trim()
  if (title) return title
  const firstLine = note.body.split('\n').find((line) => line.trim())
  return firstLine ? firstLine.trim().slice(0, 80) : 'Sin título'
}

/** Trocito del texto para la lista (sin la línea que ya se usa como título). */
export function noteSnippet(note: Pick<Note, 'title' | 'body'>, max = 90): string {
  const lines = note.body
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
  const rest = note.title.trim() ? lines : lines.slice(1)
  const text = rest.join(' ')
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text
}

/** Asignaturas que tienen alguna nota, en el orden habitual de asignaturas. */
export function subjectsWithNotes(notes: Pick<Note, 'subject'>[]): SubjectId[] {
  const used = new Set(notes.map((n) => n.subject))
  return SUBJECT_IDS.filter((id) => used.has(id))
}

/** Notas de la asignatura elegida que contienen todas las palabras buscadas (sin importar tildes), la más reciente arriba. */
export function filterNotes<T extends Note>(notes: T[], subject: SubjectFilter, query: string): T[] {
  const words = normalize(query).split(/\s+/).filter(Boolean)
  return notes
    .filter((n) => subject === 'all' || n.subject === subject)
    .filter((n) => {
      if (words.length === 0) return true
      const haystack = normalize(`${n.title}\n${n.body}`)
      return words.every((w) => haystack.includes(w))
    })
    .sort((a, b) => b.updatedAt - a.updatedAt)
}
