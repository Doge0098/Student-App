import { afterEach, describe, expect, it, vi } from 'vitest'
import { filterNotes, isEmptyNote, noteSnippet, noteTitle, subjectsWithNotes } from './logic'
import { cleanNotes, type Note } from './store'

const note = (extra: Partial<Note> = {}): Note => ({ id: 'n1', subject: 'historia', title: 'Tema 1', body: 'Texto', updatedAt: 1, ...extra })

describe('cleanNotes', () => {
  it('lo que no es una lista se queda en ninguna nota', () => {
    for (const value of [null, undefined, {}, { notes: [note()] }, 'notas']) expect(cleanNotes(value)).toEqual([])
  })

  it('quita lo que no es una nota y completa lo que falta', () => {
    const notes = cleanNotes([null, 2, { title: 'sin id' }, { id: 'n1', subject: 'general', title: 'Tema 1', updatedAt: 1 }, { id: 'n2', subject: 'religion', title: 7, body: ['x'], updatedAt: '' }])
    expect(notes).toEqual([
      { id: 'n1', subject: 'general', title: 'Tema 1', body: '', updatedAt: 1 },
      { id: 'n2', subject: 'general', title: '', body: '', updatedAt: 0 },
    ])
  })

  it('las funciones de la lista funcionan con las notas arregladas', () => {
    const notes = cleanNotes([{ id: 'n1', title: 'Tema 1' }, { id: 'n2', body: 'Primera línea\nsegunda' }])
    expect(notes.map((n) => noteTitle(n))).toEqual(['Tema 1', 'Primera línea'])
    expect(notes.map((n) => noteSnippet(n))).toEqual(['', 'segunda'])
    expect(notes.some(isEmptyNote)).toBe(false)
    expect(subjectsWithNotes(notes)).toEqual(['general'])
    expect(filterNotes(notes, 'all', 'segunda').map((n) => n.id)).toEqual(['n2'])
  })

  it('si todo estaba bien devuelve lo mismo (no copia)', () => {
    const list = [note(), note({ id: 'n2' })]
    expect(cleanNotes(list)).toBe(list)
  })
})

describe('notesStore con datos rotos en el navegador', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.resetModules()
  })

  async function loadWith(saved: string) {
    const map = new Map([['student-app:notes', saved]])
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => map.get(k) ?? null,
      setItem: (k: string, v: string) => void map.set(k, v),
      removeItem: (k: string) => void map.delete(k),
    })
    vi.resetModules()
    const store = await import('./store')
    return { ...store, map }
  }

  it('«{}» se lee como ninguna nota (la vista de Notas no se rompe)', async () => {
    const { notesStore } = await loadWith('{}')
    expect(notesStore.get()).toEqual([])
    expect(notesStore.get().some(isEmptyNote)).toBe(false)
  })

  it('updateNote funciona con notas guardadas a medias', async () => {
    const { notesStore, updateNote, map } = await loadWith('[null,{"id":"n1","title":"Tema"}]')
    updateNote('n1', { body: 'Las células' })
    const [saved] = JSON.parse(map.get('student-app:notes')!) as Note[]
    expect(saved).toMatchObject({ id: 'n1', title: 'Tema', body: 'Las células', subject: 'general' })
    expect(saved.updatedAt).toBeGreaterThan(0)
    expect(notesStore.get()).toHaveLength(1)
  })
})
