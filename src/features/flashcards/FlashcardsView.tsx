import { Plus } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { SubjectPicker } from '../../components/SubjectPicker'
import { useToast } from '../../components/Toast'
import { detectSubject } from '../../lib/subjects'
import { DeckEditor } from './DeckEditor'
import { deckCards, dueCards, findDeckByName, plural } from './srs'
import { StudySession } from './StudySession'
import { useFlashcards, type Card, type Deck } from './store'
import { useNow } from './useNow'
import './flashcards.css'

type View =
  | { kind: 'decks' }
  | { kind: 'deck'; deckId: string }
  | { kind: 'study'; deckId: string; all: boolean; from: 'decks' | 'deck' }

/**
 * Tarjetas de memoria con repaso espaciado (un Anki sencillo).
 * Ocupa todo el alto que le den y hace scroll por dentro.
 */
export function FlashcardsView() {
  const flashcards = useFlashcards()
  const [view, setView] = useState<View>({ kind: 'decks' })

  const deck = view.kind === 'decks' ? undefined : flashcards.decks.find((d) => d.id === view.deckId)
  // Si el mazo ya no existe (p. ej. se borró en otra pestaña), se vuelve a la lista.
  const current: View = view.kind !== 'decks' && !deck ? { kind: 'decks' } : view

  const study = (deckId: string, all: boolean, from: 'decks' | 'deck') => setView({ kind: 'study', deckId, all, from })

  return (
    <div className="flash-view">
      <div className="flash">
        {current.kind === 'decks' && (
          <DeckList
            decks={flashcards.decks}
            cards={flashcards.cards}
            onCreate={flashcards.createDeck}
            onChangeSubject={(id, subject) => flashcards.updateDeck(id, { subject })}
            onOpen={(deckId) => setView({ kind: 'deck', deckId })}
            onStudy={(deckId) => study(deckId, false, 'decks')}
          />
        )}
        {current.kind === 'deck' && deck && (
          <DeckEditor
            key={deck.id}
            deck={deck}
            cards={deckCards(flashcards.cards, deck.id)}
            onBack={() => setView({ kind: 'decks' })}
            onStudy={(all) => study(deck.id, all, 'deck')}
          />
        )}
        {current.kind === 'study' && deck && (
          <StudySession
            key={`${deck.id}-${current.all}`}
            deck={deck}
            cards={deckCards(flashcards.cards, deck.id)}
            all={current.all}
            onGrade={flashcards.gradeCard}
            onExit={() => setView(current.from === 'deck' ? { kind: 'deck', deckId: deck.id } : { kind: 'decks' })}
          />
        )}
      </div>
    </div>
  )
}

interface DeckListProps {
  decks: Deck[]
  cards: Card[]
  onCreate: (name: string, subject: Deck['subject']) => Deck
  onChangeSubject: (id: string, subject: Deck['subject']) => void
  onOpen: (deckId: string) => void
  onStudy: (deckId: string) => void
}

function DeckList({ decks, cards, onCreate, onChangeSubject, onOpen, onStudy }: DeckListProps) {
  const toast = useToast()
  const [name, setName] = useState('')
  const now = useNow()

  const create = (e: FormEvent) => {
    e.preventDefault()
    const value = name.trim()
    if (!value) return
    const existing = findDeckByName(decks, value)
    if (existing) toast(`Ya tienes un mazo llamado «${existing.name}».`)
    // La asignatura se adivina por el nombre; se puede cambiar después.
    const deck = existing ?? onCreate(value, detectSubject(value))
    setName('')
    onOpen(deck.id)
  }

  return (
    <>
      <form className="input-row" onSubmit={create}>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Nuevo mazo… (p. ej. Verbos en inglés)"
          aria-label="Nombre del nuevo mazo"
          maxLength={80}
        />
        <button type="submit" className="btn btn-primary btn-icon" aria-label="Crear mazo" disabled={!name.trim()}>
          <Plus size={18} />
        </button>
      </form>

      {decks.length === 0 ? (
        <p className="empty">
          Crea un mazo y añade tarjetas: la pregunta por delante y la respuesta por detrás. Cada día te diré cuáles repasar.
        </p>
      ) : (
        <ul className="flash-decks" aria-label="Mazos">
          {decks.map((deck) => {
            const own = deckCards(cards, deck.id)
            const due = dueCards(own, now).length
            return (
              <li key={deck.id} className="flash-deck">
                <div className="flash-deck-info">
                  <button type="button" className="flash-deck-name" title="Ver y editar tarjetas" onClick={() => onOpen(deck.id)}>
                    {deck.name}
                  </button>
                  <div className="flash-deck-meta">
                    <SubjectPicker value={deck.subject} onChange={(subject) => onChangeSubject(deck.id, subject)} />
                    <span>
                      {plural(own.length, 'tarjeta', 'tarjetas')}
                      {own.length > 0 && (due > 0 ? ` · ${due} para hoy` : ' · al día')}
                    </span>
                  </div>
                </div>
                {own.length === 0 ? (
                  <button type="button" className="btn btn-small" onClick={() => onOpen(deck.id)}>
                    Añadir tarjetas
                  </button>
                ) : due > 0 ? (
                  <button type="button" className="btn btn-primary btn-small" onClick={() => onStudy(deck.id)}>
                    Repasar
                  </button>
                ) : null}
              </li>
            )
          })}
        </ul>
      )}
    </>
  )
}
