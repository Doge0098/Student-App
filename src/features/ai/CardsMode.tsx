import { LoaderCircle, Plus, Trash2 } from 'lucide-react'
import { useId, useState } from 'react'
import { SubjectPicker } from '../../components/SubjectPicker'
import { useToast } from '../../components/Toast'
import { useStore } from '../../hooks/store'
import { detectSubject, type SubjectId } from '../../lib/subjects'
import { plural } from '../flashcards/srs'
import { useFlashcards } from '../flashcards/store'
import { noteTitle } from '../notes/logic'
import { useNotes } from '../notes/store'
import { useProfile } from '../profile/profile'
import { generateJson } from './client'
import { CARD_SIZES, cardsSystem, checkSource, sourceMessage } from './prompts'
import { CARDS_SCHEMA, parseCards, type DraftCard } from './schemas'
import { createTask, sourceStore } from './session'
import { SourceInput } from './SourceInput'
import type { AiConfig } from './types'

interface CardsDraft {
  cards: DraftCard[]
  deckName: string
  subject: SubjectId
}

const cardsTask = createTask<CardsDraft>()

/** Modo «Tarjetas»: crea tarjetas de memoria a partir de un texto; se revisan y se guardan en un mazo. */
export function CardsMode({ config }: { config: AiConfig }) {
  const [{ loading, error, result }] = useStore(cardsTask.store)
  const [source] = useStore(sourceStore)
  const { notes } = useNotes()
  const { level } = useProfile()
  const [count, setCount] = useState<number>(10)
  const [notice, setNotice] = useState<string | null>(null)

  const create = () => {
    const problem = checkSource(source.text)
    setNotice(problem)
    if (problem) return
    const note = notes.find((n) => n.id === source.noteId)
    const title = note ? noteTitle(note) : ''
    const subject = note?.subject ?? detectSubject(source.text)
    const request = { system: cardsSystem(level, count), messages: [sourceMessage(source.text, title)], schema: CARDS_SCHEMA, schemaName: 'tarjetas' }
    void cardsTask.run(async (signal) => ({
      cards: await generateJson(config, request, (text) => parseCards(text, count), { signal }),
      deckName: title || 'Tarjetas de la IA',
      subject,
    }))
  }

  if (result) return <CardsReview draft={result} />

  return (
    <div className="ai-mode">
      <SourceInput disabled={loading} />
      {notice && (
        <p className="error-text" role="alert">
          {notice}
        </p>
      )}
      <div className="ai-actions">
        {loading ? (
          <>
            <span className="hint ai-inline" role="status">
              <LoaderCircle size={15} className="ai-spin" aria-hidden="true" /> Creando tarjetas…
            </span>
            <button type="button" className="btn btn-ghost" onClick={cardsTask.cancel}>
              Cancelar
            </button>
          </>
        ) : (
          <>
            <button type="button" className="btn btn-primary" onClick={create}>
              Crear tarjetas
            </button>
            <select aria-label="Número de tarjetas" value={count} onChange={(e) => setCount(Number(e.target.value))}>
              {CARD_SIZES.map((n) => (
                <option key={n} value={n}>
                  Hasta {n} tarjetas
                </option>
              ))}
            </select>
          </>
        )}
      </div>
      {error && (
        <p className="error-text" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}

function CardsReview({ draft }: { draft: CardsDraft }) {
  const { addCards } = useFlashcards()
  const toast = useToast()
  const deckId = useId()
  const valid = draft.cards.filter((c) => c.front.trim() && c.back.trim())

  const editCard = (index: number, patch: Partial<DraftCard>) =>
    cardsTask.update((d) => ({ ...d, cards: d.cards.map((c, i) => (i === index ? { ...c, ...patch } : c)) }))

  const save = () => {
    if (valid.length === 0) return
    const name = draft.deckName.trim() || 'Tarjetas de la IA'
    addCards(name, draft.subject, valid)
    toast(`${plural(valid.length, 'tarjeta guardada', 'tarjetas guardadas')} en «${name}».`)
    cardsTask.clear()
  }

  return (
    <div className="ai-mode">
      <p className="hint">Revisa las tarjetas: puedes cambiarlas o quitar las que no quieras antes de guardarlas.</p>
      <ol className="ai-cards">
        {draft.cards.map((card, i) => (
          <li key={i} className="ai-card">
            <div className="ai-card-fields">
              <textarea
                className="ai-textarea"
                rows={2}
                aria-label={`Tarjeta ${i + 1}: pregunta`}
                placeholder="Pregunta"
                value={card.front}
                onChange={(e) => editCard(i, { front: e.target.value })}
              />
              <textarea
                className="ai-textarea"
                rows={2}
                aria-label={`Tarjeta ${i + 1}: respuesta`}
                placeholder="Respuesta"
                value={card.back}
                onChange={(e) => editCard(i, { back: e.target.value })}
              />
            </div>
            <button
              type="button"
              className="icon-btn"
              aria-label={`Quitar la tarjeta ${i + 1}`}
              title="Quitar"
              onClick={() => cardsTask.update((d) => ({ ...d, cards: d.cards.filter((_, j) => j !== i) }))}
            >
              <Trash2 size={16} />
            </button>
          </li>
        ))}
      </ol>
      <button type="button" className="btn-link ai-add-card" onClick={() => cardsTask.update((d) => ({ ...d, cards: [...d.cards, { front: '', back: '' }] }))}>
        <Plus size={14} aria-hidden="true" /> Añadir tarjeta
      </button>

      <div className="ai-deck">
        <label className="ai-label" htmlFor={deckId}>
          Mazo
        </label>
        <div className="ai-deck-row">
          <input id={deckId} type="text" value={draft.deckName} onChange={(e) => cardsTask.update((d) => ({ ...d, deckName: e.target.value }))} />
          <SubjectPicker value={draft.subject} onChange={(subject) => cardsTask.update((d) => ({ ...d, subject }))} />
        </div>
        <p className="hint">Si ya tienes un mazo con ese nombre, se añaden a él.</p>
      </div>

      <div className="ai-actions">
        <button type="button" className="btn btn-primary" onClick={save} disabled={valid.length === 0}>
          Guardar {plural(valid.length, 'tarjeta', 'tarjetas')}
        </button>
        <button type="button" className="btn btn-ghost" onClick={cardsTask.clear}>
          Descartar
        </button>
      </div>
    </div>
  )
}
