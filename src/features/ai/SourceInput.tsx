import { X } from 'lucide-react'
import { useStore } from '../../hooks/store'
import { noteTitle } from '../notes/logic'
import { useNotes } from '../notes/store'
import { MAX_INPUT_CHARS } from './prompts'
import { sourceStore } from './session'

/**
 * Texto con el que trabaja la IA: se pega o se coge de una nota. Es el mismo en Resumir, Test y
 * Tarjetas, así se pega una vez y se usa para todo.
 */
export function SourceInput({ disabled = false }: { disabled?: boolean }) {
  const [source, setSource] = useStore(sourceStore)
  const { notes } = useNotes()
  const usable = notes.filter((n) => n.body.trim())
  const length = source.text.trim().length
  const over = length > MAX_INPUT_CHARS

  return (
    <div className="ai-source">
      {usable.length > 0 && (
        <select
          className="ai-source-note"
          aria-label="Usar una de mis notas"
          value={source.noteId && usable.some((n) => n.id === source.noteId) ? source.noteId : ''}
          disabled={disabled}
          onChange={(e) => {
            const note = usable.find((n) => n.id === e.target.value)
            setSource(note ? { text: note.body, noteId: note.id } : { text: '', noteId: null })
          }}
        >
          <option value="">Pegar un texto…</option>
          {usable.map((n) => (
            <option key={n.id} value={n.id}>
              Nota: {noteTitle(n)}
            </option>
          ))}
        </select>
      )}
      <div className="ai-source-box">
        <textarea
          className="ai-textarea"
          aria-label="Texto para estudiar"
          placeholder="Pega aquí tus apuntes o un tema del libro…"
          rows={7}
          value={source.text}
          disabled={disabled}
          onChange={(e) => setSource((s) => ({ ...s, text: e.target.value }))}
        />
        {source.text && !disabled && (
          <button type="button" className="icon-btn ai-source-clear" aria-label="Borrar el texto" title="Borrar el texto" onClick={() => setSource({ text: '', noteId: null })}>
            <X size={16} />
          </button>
        )}
      </div>
      <p className={`hint ai-count ${over ? 'is-over' : ''}`}>
        {length.toLocaleString('es-ES')} / {MAX_INPUT_CHARS.toLocaleString('es-ES')} caracteres
      </p>
    </div>
  )
}
