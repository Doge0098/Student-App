import { ArrowLeft, Plus, Trash2 } from 'lucide-react'
import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react'
import { Modal } from '../../components/Modal'
import { SubjectPicker } from '../../components/SubjectPicker'
import { SUBJECTS } from '../../lib/subjects'
import { useNow } from '../flashcards/useNow'
import { timeAgo } from '../../lib/time'
import { filterNotes, isEmptyNote, noteSnippet, noteTitle, subjectsWithNotes, type SubjectFilter } from './logic'
import { notesStore, updateNote, useNotes, type Note } from './store'
import './notes.css'

const subjectStyle = (id: keyof typeof SUBJECTS) => ({ '--subject': (SUBJECTS[id] ?? SUBJECTS.general).color }) as CSSProperties

/**
 * Notas rápidas por asignatura. Ocupa todo el alto que le den y hace scroll por dentro.
 * En pantallas anchas: lista a la izquierda y nota a la derecha; en estrechas, una cosa cada vez.
 */
export function NotesView() {
  const { notes, add, update, remove } = useNotes()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [filter, setFilter] = useState<SubjectFilter>('all')
  const [query, setQuery] = useState('')
  const [justCreated, setJustCreated] = useState<string | null>(null)
  const [confirming, setConfirming] = useState<Note | null>(null)
  const now = useNow()

  // Las notas que se crearon y se dejaron vacías no se guardan.
  useEffect(() => {
    if (notesStore.get().some(isEmptyNote)) notesStore.set((prev) => prev.filter((n) => !isEmptyNote(n)))
  }, [])

  const subjects = subjectsWithNotes(notes)
  const activeFilter: SubjectFilter = filter !== 'all' && subjects.includes(filter) ? filter : 'all'
  const visible = filterNotes(notes, activeFilter, query)
  const selected = notes.find((n) => n.id === selectedId) ?? null

  /** Al salir de una nota vacía, se borra (lee el estado guardado más reciente). */
  const leaveCurrent = () => {
    if (!selectedId) return
    const current = notesStore.get().find((n) => n.id === selectedId)
    if (current && isEmptyNote(current)) remove(current.id)
  }

  const select = (id: string | null) => {
    if (id === selectedId) return
    leaveCurrent()
    setSelectedId(id)
    setJustCreated(null)
  }

  const create = () => {
    leaveCurrent()
    const note = add(activeFilter === 'all' ? 'general' : activeFilter)
    setQuery('')
    setSelectedId(note.id)
    setJustCreated(note.id)
  }

  const askDelete = (note: Note) => {
    const latest = notesStore.get().find((n) => n.id === note.id) ?? note
    if (isEmptyNote(latest)) {
      remove(note.id)
      setSelectedId(null)
    } else {
      setConfirming(latest)
    }
  }

  const confirmDelete = () => {
    if (confirming) {
      remove(confirming.id)
      if (selectedId === confirming.id) setSelectedId(null)
    }
    setConfirming(null)
  }

  return (
    <div className="notes-view">
      <div className={`notes ${notes.length === 0 ? 'is-empty' : ''}`} data-view={selected ? 'editor' : 'list'}>
        <div className="notes-list-pane">
          <div className="notes-toolbar">
            {notes.length > 0 && (
              <input
                type="search"
                className="notes-search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar en tus notas"
                aria-label="Buscar en tus notas"
              />
            )}
            <button type="button" className="btn btn-primary notes-new" onClick={create}>
              <Plus size={16} aria-hidden="true" /> Nueva nota
            </button>
          </div>

          {subjects.length > 1 && (
            <div className="chip-row" role="group" aria-label="Asignaturas">
              <button
                type="button"
                className={`chip ${activeFilter === 'all' ? 'is-active' : ''}`}
                aria-pressed={activeFilter === 'all'}
                onClick={() => setFilter('all')}
              >
                Todas
              </button>
              {subjects.map((id) => (
                <button
                  key={id}
                  type="button"
                  className={`chip chip-subject ${activeFilter === id ? 'is-active' : ''}`}
                  style={subjectStyle(id)}
                  aria-pressed={activeFilter === id}
                  onClick={() => setFilter(id)}
                >
                  <span className="subject-dot" aria-hidden="true" />
                  {SUBJECTS[id].label}
                </button>
              ))}
            </div>
          )}

          {notes.length === 0 ? (
            <p className="empty">Apunta ideas, fórmulas o resúmenes de cada asignatura. Se guardan solas.</p>
          ) : visible.length === 0 ? (
            <p className="empty">Ninguna nota coincide con la búsqueda.</p>
          ) : (
            <ul className="notes-list" aria-label="Notas">
              {visible.map((note) => {
                const snippet = noteSnippet(note)
                const subject = SUBJECTS[note.subject] ?? SUBJECTS.general
                return (
                  <li key={note.id}>
                    <button
                      type="button"
                      className={`notes-item ${note.id === selectedId ? 'is-active' : ''}`}
                      aria-current={note.id === selectedId ? 'true' : undefined}
                      onClick={() => select(note.id)}
                    >
                      <span className={`notes-item-title ${isEmptyNote(note) ? 'is-placeholder' : ''}`}>
                        {noteTitle(note)}
                      </span>
                      {snippet && <span className="notes-item-snippet">{snippet}</span>}
                      <span className="notes-item-meta" style={subjectStyle(note.subject)}>
                        <span className="subject-dot" aria-hidden="true" />
                        {subject.label} · {timeAgo(note.updatedAt, now)}
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        <div className="notes-editor-pane">
          {selected ? (
            <NoteEditor
              key={selected.id}
              note={selected}
              autoFocus={justCreated === selected.id}
              onSubjectChange={(subject) => update(selected.id, { subject })}
              onDelete={() => askDelete(selected)}
              onBack={() => select(null)}
            />
          ) : (
            <p className="empty notes-placeholder">Elige una nota o crea una nueva.</p>
          )}
        </div>
      </div>

      <Modal open={confirming !== null} title="¿Borrar esta nota?" icon={<Trash2 size={26} />} onClose={() => setConfirming(null)}>
        <p className="modal-text">«{confirming ? noteTitle(confirming) : ''}» se borrará y no se podrá recuperar.</p>
        <div className="modal-actions">
          <button type="button" className="btn notes-danger-btn" onClick={confirmDelete}>
            Borrar nota
          </button>
          <button type="button" className="btn btn-ghost" data-autofocus onClick={() => setConfirming(null)}>
            Cancelar
          </button>
        </div>
      </Modal>
    </div>
  )
}

interface NoteEditorProps {
  note: Note
  autoFocus: boolean
  onSubjectChange: (subject: Note['subject']) => void
  onDelete: () => void
  onBack: () => void
}

const SAVE_DELAY_MS = 500

/** Título + texto. Se guarda solo un momento después de dejar de escribir, al salir del campo y al cerrar. */
function NoteEditor({ note, autoFocus, onSubjectChange, onDelete, onBack }: NoteEditorProps) {
  const [title, setTitle] = useState(note.title)
  const [body, setBody] = useState(note.body)
  const pending = useRef<Partial<Pick<Note, 'title' | 'body'>> | null>(null)
  const timer = useRef<number | undefined>(undefined)
  const titleInput = useRef<HTMLInputElement>(null)
  const bodyInput = useRef<HTMLTextAreaElement>(null)
  const noteId = note.id

  const flush = useCallback(() => {
    window.clearTimeout(timer.current)
    if (!pending.current) return
    updateNote(noteId, pending.current)
    pending.current = null
  }, [noteId])

  // Lo que quede por guardar se guarda al cerrar la nota.
  useEffect(() => flush, [flush])

  useEffect(() => {
    if (autoFocus) titleInput.current?.focus()
  }, [autoFocus])

  const change = (patch: Partial<Pick<Note, 'title' | 'body'>>) => {
    pending.current = { ...pending.current, ...patch }
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(flush, SAVE_DELAY_MS)
  }

  return (
    <>
      <div className="notes-editor-head">
        <button type="button" className="btn btn-link notes-back" onClick={onBack}>
          <ArrowLeft size={15} aria-hidden="true" /> Notas
        </button>
        <SubjectPicker value={note.subject} onChange={onSubjectChange} />
        <span className="notes-spacer" />
        <button type="button" className="icon-btn" aria-label="Borrar nota" title="Borrar nota" onClick={onDelete}>
          <Trash2 size={16} />
        </button>
      </div>
      <input
        ref={titleInput}
        type="text"
        className="notes-title-input"
        value={title}
        onChange={(e) => {
          setTitle(e.target.value)
          change({ title: e.target.value })
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            bodyInput.current?.focus()
          }
        }}
        onBlur={flush}
        placeholder="Título"
        aria-label="Título de la nota"
        maxLength={120}
      />
      <textarea
        ref={bodyInput}
        className="notes-body"
        value={body}
        onChange={(e) => {
          setBody(e.target.value)
          change({ body: e.target.value })
        }}
        onBlur={flush}
        placeholder="Escribe aquí… Se guarda solo."
        aria-label="Texto de la nota"
        spellCheck
      />
    </>
  )
}
