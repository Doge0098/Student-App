import { ArrowLeft, Check, ClipboardPaste, Pencil, Plus, Trash2, X } from 'lucide-react'
import { useRef, useState, type FormEvent } from 'react'
import { Modal } from '../../components/Modal'
import { SubjectPicker } from '../../components/SubjectPicker'
import { useToast } from '../../components/Toast'
import { dueCards, findDeckByName, parseBulk, plural } from './srs'
import { useFlashcards, type Card, type Deck } from './store'
import { useNow } from './useNow'

interface DeckEditorProps {
  deck: Deck
  /** Tarjetas de este mazo. */
  cards: Card[]
  onBack: () => void
  /** all = repasar todas, no solo las de hoy (p. ej. antes de un examen). */
  onStudy: (all: boolean) => void
}

/** Un mazo: nombre, asignatura, añadir/editar/borrar tarjetas y pegar varias a la vez. */
export function DeckEditor({ deck, cards, onBack, onStudy }: DeckEditorProps) {
  const flashcards = useFlashcards()
  const toast = useToast()
  const [name, setName] = useState(deck.name)
  const [front, setFront] = useState('')
  const [back, setBack] = useState('')
  const [bulkOpen, setBulkOpen] = useState(false)
  const [bulk, setBulk] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const frontInput = useRef<HTMLInputElement>(null)
  const backInput = useRef<HTMLInputElement>(null)
  /** Escape deja el nombre como estaba: el blur que viene detrás no debe guardarlo. */
  const cancelRename = useRef(false)

  const now = useNow()
  const due = dueCards(cards, now).length
  const parsed = parseBulk(bulk)

  const rename = () => {
    if (cancelRename.current) {
      cancelRename.current = false
      setName(deck.name)
      return
    }
    const value = name.trim()
    if (!value || value === deck.name) {
      setName(deck.name)
      return
    }
    const other = findDeckByName(flashcards.decks, value)
    if (other && other.id !== deck.id) {
      toast(`Ya tienes un mazo llamado «${other.name}».`)
      setName(deck.name)
      return
    }
    flashcards.updateDeck(deck.id, { name: value })
  }

  const addOne = (e: FormEvent) => {
    e.preventDefault()
    if (!front.trim()) {
      frontInput.current?.focus()
      return
    }
    if (!back.trim()) {
      backInput.current?.focus()
      return
    }
    flashcards.addCard(deck.id, front, back)
    setFront('')
    setBack('')
    frontInput.current?.focus()
  }

  const addBulk = () => {
    if (parsed.cards.length === 0) return
    flashcards.addCardsToDeck(deck.id, parsed.cards)
    toast(`${plural(parsed.cards.length, 'tarjeta añadida', 'tarjetas añadidas')}.`)
    setBulk('')
    setBulkOpen(false)
  }

  return (
    <>
      <div className="flash-head">
        <button type="button" className="btn btn-link flash-back" onClick={onBack}>
          <ArrowLeft size={15} aria-hidden="true" /> Mazos
        </button>
        <span className="flash-spacer" />
        {due > 0 ? (
          <button type="button" className="btn btn-primary btn-small" onClick={() => onStudy(false)}>
            Repasar {due}
          </button>
        ) : (
          cards.length > 0 && (
            <button type="button" className="btn btn-small" onClick={() => onStudy(true)} title="Hoy no te toca ninguna, pero puedes repasarlas igualmente">
              Repasar todas
            </button>
          )
        )}
        <button type="button" className="icon-btn" aria-label="Borrar mazo" title="Borrar mazo" onClick={() => setConfirmDelete(true)}>
          <Trash2 size={16} />
        </button>
      </div>

      <div className="flash-deck-header">
        <input
          type="text"
          className="flash-deck-title"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onFocus={() => {
            cancelRename.current = false
          }}
          onBlur={rename}
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.currentTarget.blur()
            if (e.key === 'Escape') {
              cancelRename.current = true
              setName(deck.name)
              e.currentTarget.blur()
            }
          }}
          aria-label="Nombre del mazo"
          maxLength={80}
        />
        <div className="flash-deck-meta">
          <SubjectPicker value={deck.subject} onChange={(subject) => flashcards.updateDeck(deck.id, { subject })} />
          <span>
            {plural(cards.length, 'tarjeta', 'tarjetas')}
            {cards.length > 0 && (due > 0 ? ` · ${due} para hoy` : ' · al día')}
          </span>
        </div>
      </div>

      <form className="flash-add" onSubmit={addOne}>
        <input
          ref={frontInput}
          type="text"
          value={front}
          onChange={(e) => setFront(e.target.value)}
          onKeyDown={(e) => {
            // Intro en la pregunta pasa a la respuesta.
            if (e.key === 'Enter' && front.trim() && !back.trim()) {
              e.preventDefault()
              backInput.current?.focus()
            }
          }}
          placeholder="Pregunta"
          aria-label="Pregunta (delante)"
          maxLength={500}
        />
        <input
          ref={backInput}
          type="text"
          value={back}
          onChange={(e) => setBack(e.target.value)}
          placeholder="Respuesta"
          aria-label="Respuesta (detrás)"
          maxLength={1000}
        />
        <button type="submit" className="btn btn-primary btn-icon" aria-label="Añadir tarjeta" disabled={!front.trim() || !back.trim()}>
          <Plus size={18} />
        </button>
      </form>

      <button
        type="button"
        className="btn btn-link flash-bulk-toggle"
        aria-expanded={bulkOpen}
        aria-controls="flash-bulk"
        onClick={() => setBulkOpen((v) => !v)}
      >
        <ClipboardPaste size={14} aria-hidden="true" /> Pegar varias a la vez
      </button>

      {bulkOpen && (
        <div className="flash-bulk" id="flash-bulk">
          <textarea
            value={bulk}
            onChange={(e) => setBulk(e.target.value)}
            placeholder={'Una por línea, pregunta ; respuesta\nCapital de Francia ; París\nH2O ; Agua'}
            aria-label="Tarjetas, una por línea: pregunta ; respuesta"
            rows={5}
            autoFocus
          />
          <div className="flash-bulk-foot">
            <span className="hint">
              {parsed.cards.length > 0 || parsed.skipped > 0
                ? `${plural(parsed.cards.length, 'tarjeta', 'tarjetas')}${parsed.skipped > 0 ? ` · ${plural(parsed.skipped, 'línea', 'líneas')} sin «;»` : ''}`
                : 'También vale copiar dos columnas de una hoja de cálculo.'}
            </span>
            <button type="button" className="btn btn-primary btn-small" disabled={parsed.cards.length === 0} onClick={addBulk}>
              Añadir {parsed.cards.length > 0 ? parsed.cards.length : ''}
            </button>
          </div>
        </div>
      )}

      {cards.length === 0 ? (
        <p className="empty">Aún no hay tarjetas. Escribe la primera arriba.</p>
      ) : (
        <ul className="flash-cards" aria-label="Tarjetas">
          {cards.map((card) =>
            editingId === card.id ? (
              <CardEditRow
                key={card.id}
                card={card}
                onSave={(patch) => {
                  flashcards.updateCard(card.id, patch)
                  setEditingId(null)
                }}
                onCancel={() => setEditingId(null)}
              />
            ) : (
              <li key={card.id} className="flash-card-row">
                <div className="flash-card-text">
                  <span className="flash-card-front">{card.front}</span>
                  <span className="flash-card-back">{card.back}</span>
                </div>
                <div className="flash-card-actions">
                  <button type="button" className="icon-btn" aria-label={`Editar "${card.front}"`} title="Editar" onClick={() => setEditingId(card.id)}>
                    <Pencil size={14} />
                  </button>
                  <button type="button" className="icon-btn" aria-label={`Borrar "${card.front}"`} title="Borrar" onClick={() => flashcards.removeCard(card.id)}>
                    <X size={15} />
                  </button>
                </div>
              </li>
            ),
          )}
        </ul>
      )}

      <Modal open={confirmDelete} title={`¿Borrar «${deck.name}»?`} icon={<Trash2 size={26} />} onClose={() => setConfirmDelete(false)}>
        <p className="modal-text">
          {cards.length > 0
            ? `Se borrará con sus ${plural(cards.length, 'tarjeta', 'tarjetas')}. No se puede deshacer.`
            : 'El mazo está vacío.'}
        </p>
        <div className="modal-actions">
          <button
            type="button"
            className="btn flash-danger-btn"
            onClick={() => {
              setConfirmDelete(false)
              flashcards.removeDeck(deck.id)
              onBack()
            }}
          >
            Borrar mazo
          </button>
          <button type="button" className="btn btn-ghost" data-autofocus onClick={() => setConfirmDelete(false)}>
            Cancelar
          </button>
        </div>
      </Modal>
    </>
  )
}

interface CardEditRowProps {
  card: Card
  onSave: (patch: Pick<Card, 'front' | 'back'>) => void
  onCancel: () => void
}

function CardEditRow({ card, onSave, onCancel }: CardEditRowProps) {
  const [front, setFront] = useState(card.front)
  const [back, setBack] = useState(card.back)
  const valid = front.trim() && back.trim()

  const save = (e: FormEvent) => {
    e.preventDefault()
    if (valid) onSave({ front: front.trim(), back: back.trim() })
  }

  return (
    <li className="flash-card-row is-editing">
      <form
        className="flash-card-edit"
        onSubmit={save}
        onKeyDown={(e) => {
          if (e.key === 'Escape') onCancel()
        }}
      >
        <CardField value={front} onChange={setFront} label="Pregunta" maxLength={500} autoFocus />
        <CardField value={back} onChange={setBack} label="Respuesta" maxLength={1000} />
        <div className="flash-card-actions">
          <button type="submit" className="icon-btn" aria-label="Guardar" title="Guardar" disabled={!valid}>
            <Check size={15} />
          </button>
          <button type="button" className="icon-btn" aria-label="Cancelar" title="Cancelar" onClick={onCancel}>
            <X size={15} />
          </button>
        </div>
      </form>
    </li>
  )
}

interface CardFieldProps {
  value: string
  onChange: (value: string) => void
  label: string
  maxLength: number
  autoFocus?: boolean
}

/** Una línea, o varias si la tarjeta ya las tenía (p. ej. pegada de una hoja de cálculo): un campo de una línea las juntaría. */
function CardField({ value, onChange, label, maxLength, autoFocus }: CardFieldProps) {
  const [multiline] = useState(() => value.includes('\n'))
  if (!multiline) {
    return <input type="text" value={value} onChange={(e) => onChange(e.target.value)} aria-label={label} maxLength={maxLength} autoFocus={autoFocus} />
  }
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      aria-label={label}
      maxLength={maxLength}
      autoFocus={autoFocus}
      rows={Math.min(5, value.split('\n').length)}
    />
  )
}
