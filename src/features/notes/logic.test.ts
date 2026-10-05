import { describe, expect, it } from 'vitest'
import { filterNotes, isEmptyNote, noteSnippet, noteTitle, subjectsWithNotes } from './logic'
import type { Note } from './store'

const note = (id: string, extra: Partial<Note> = {}): Note => ({
  id,
  subject: 'general',
  title: '',
  body: '',
  updatedAt: 0,
  ...extra,
})

describe('isEmptyNote', () => {
  it('solo está vacía si no hay título ni texto', () => {
    expect(isEmptyNote(note('a', { title: '  ', body: '\n' }))).toBe(true)
    expect(isEmptyNote(note('a', { body: 'x' }))).toBe(false)
    expect(isEmptyNote(note('a', { title: 'x' }))).toBe(false)
  })
})

describe('noteTitle y noteSnippet', () => {
  it('usa el título si lo hay', () => {
    const n = note('a', { title: ' Tema 3 ', body: 'Las células\nson la unidad básica' })
    expect(noteTitle(n)).toBe('Tema 3')
    expect(noteSnippet(n)).toBe('Las células son la unidad básica')
  })

  it('sin título usa la primera línea con texto y no la repite en el resumen', () => {
    const n = note('a', { body: '\n  Fórmulas  \nv = d / t\na = v / t' })
    expect(noteTitle(n)).toBe('Fórmulas')
    expect(noteSnippet(n)).toBe('v = d / t a = v / t')
  })

  it('nota vacía', () => {
    expect(noteTitle(note('a'))).toBe('Sin título')
    expect(noteSnippet(note('a'))).toBe('')
  })

  it('recorta los textos largos', () => {
    const snippet = noteSnippet(note('a', { title: 't', body: 'palabra '.repeat(40) }), 20)
    expect(snippet.length).toBeLessThanOrEqual(20)
    expect(snippet.endsWith('…')).toBe(true)
  })
})

describe('subjectsWithNotes', () => {
  it('lista solo las asignaturas con notas, sin repetir y en orden', () => {
    const notes = [note('a', { subject: 'historia' }), note('b', { subject: 'matematicas' }), note('c', { subject: 'historia' })]
    expect(subjectsWithNotes(notes)).toEqual(['matematicas', 'historia'])
    expect(subjectsWithNotes([])).toEqual([])
  })
})

describe('filterNotes', () => {
  const notes = [
    note('a', { subject: 'historia', title: 'Revolución francesa', body: '1789, toma de la Bastilla', updatedAt: 1 }),
    note('b', { subject: 'matematicas', title: 'Derivadas', body: 'Regla de la cadena', updatedAt: 3 }),
    note('c', { subject: 'historia', title: 'Imperio romano', body: 'Augusto', updatedAt: 2 }),
  ]

  it('ordena de la más reciente a la más antigua', () => {
    expect(filterNotes(notes, 'all', '').map((n) => n.id)).toEqual(['b', 'c', 'a'])
  })

  it('filtra por asignatura', () => {
    expect(filterNotes(notes, 'historia', '').map((n) => n.id)).toEqual(['c', 'a'])
  })

  it('busca sin importar tildes ni mayúsculas, en título y texto', () => {
    expect(filterNotes(notes, 'all', 'revolucion').map((n) => n.id)).toEqual(['a'])
    expect(filterNotes(notes, 'all', 'BASTILLA').map((n) => n.id)).toEqual(['a'])
    expect(filterNotes(notes, 'all', 'regla cadena').map((n) => n.id)).toEqual(['b'])
    expect(filterNotes(notes, 'matematicas', 'augusto')).toEqual([])
  })

  it('no cambia la lista original', () => {
    filterNotes(notes, 'all', '')
    expect(notes.map((n) => n.id)).toEqual(['a', 'b', 'c'])
  })
})
