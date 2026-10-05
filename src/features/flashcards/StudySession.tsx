import { ArrowLeft } from 'lucide-react'
import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import {
  GRADES,
  addLocalDays,
  answerSession,
  dueCards,
  endOfDay,
  plural,
  previewWaits,
  startSession,
  tallyGrades,
  type Grade,
} from './srs'
import type { Card, Deck } from './store'
import { useNow } from './useNow'

interface StudySessionProps {
  deck: Deck
  /** Tarjetas del mazo (se leen en cada render: así se ve el estado guardado más reciente). */
  cards: Card[]
  /** true = todas las tarjetas, no solo las de hoy. */
  all: boolean
  onGrade: (cardId: string, grade: Grade) => void
  onExit: () => void
}

/** Repaso: se ve la pregunta, «Mostrar respuesta» y se elige qué tal se sabía (teclas 1 a 4). */
export function StudySession({ deck, cards, all, onGrade, onExit }: StudySessionProps) {
  const [session, setSession] = useState(() => startSession(cards, Date.now(), all))
  const [revealed, setRevealed] = useState(false)
  const now = useNow()
  const revealButton = useRef<HTMLButtonElement>(null)
  const goodButton = useRef<HTMLButtonElement>(null)
  const exitButton = useRef<HTMLButtonElement>(null)

  // Tarjetas borradas mientras tanto (p. ej. en otra pestaña) se saltan.
  const byId = new Map(cards.map((c) => [c.id, c]))
  const queue = session.queue.filter((id) => byId.has(id))
  const card = queue.length > 0 ? byId.get(queue[0]) : undefined
  const finished = !card

  useEffect(() => {
    if (finished) exitButton.current?.focus()
    else if (revealed) goodButton.current?.focus()
    else revealButton.current?.focus()
  }, [finished, revealed, card?.id])

  const grade = (g: Grade) => {
    if (!card) return
    onGrade(card.id, g)
    setSession((s) => answerSession(s, card.id, g))
    setRevealed(false)
  }

  const onKeyDown = (e: KeyboardEvent) => {
    if (!revealed || e.altKey || e.ctrlKey || e.metaKey) return
    const choice = GRADES.find((g) => g.key === e.key)
    if (choice) {
      e.preventDefault()
      grade(choice.id)
    }
  }

  const header = (
    <div className="flash-head">
      <button type="button" className="btn btn-link flash-back" onClick={onExit}>
        <ArrowLeft size={15} aria-hidden="true" /> Salir
      </button>
      <span className="flash-study-deck">{deck.name}</span>
      {!finished && <span className="flash-progress">Quedan {queue.length}</span>}
    </div>
  )

  if (finished) {
    const tally = tallyGrades(session.grades)
    const tomorrow = dueCards(cards, now, endOfDay(addLocalDays(now, 1))).length
    return (
      <div className="flash-study">
        {header}
        <div className="flash-summary" role="status">
          <h3 className="flash-summary-title">{session.seen.length > 0 ? '¡Repaso terminado!' : 'Nada que repasar'}</h3>
          {session.seen.length > 0 && (
            <>
              <p>{plural(session.seen.length, 'tarjeta repasada', 'tarjetas repasadas')}.</p>
              <p className="hint">
                {GRADES.filter((g) => tally[g.id] > 0)
                  .map((g) => `${g.label}: ${tally[g.id]}`)
                  .join(' · ')}
              </p>
            </>
          )}
          <p className="hint">{tomorrow > 0 ? `Mañana te ${tomorrow === 1 ? 'toca 1' : `tocan ${tomorrow}`}.` : 'Mañana no te toca ninguna de este mazo.'}</p>
          <button ref={exitButton} type="button" className="btn btn-primary" onClick={onExit}>
            Volver
          </button>
        </div>
      </div>
    )
  }

  const waits = previewWaits(card, now)

  return (
    <div className="flash-study" onKeyDown={onKeyDown}>
      {header}
      <div className="flash-card" aria-live="polite">
        <p className="flash-card-face">{card.front}</p>
        {revealed && (
          <>
            <hr className="flash-divider" />
            <p className="flash-card-face flash-card-answer">{card.back}</p>
          </>
        )}
      </div>

      {!revealed ? (
        <button ref={revealButton} type="button" className="btn btn-primary flash-reveal" onClick={() => setRevealed(true)}>
          Mostrar respuesta
        </button>
      ) : (
        <div className="flash-grades" role="group" aria-label="¿Qué tal la sabías?">
          {GRADES.map((g) => (
            <button
              key={g.id}
              ref={g.id === 'good' ? goodButton : undefined}
              type="button"
              className={`btn flash-grade ${g.id === 'good' ? 'btn-primary' : ''}`}
              data-grade={g.id}
              aria-keyshortcuts={g.key}
              title={`Tecla ${g.key}`}
              onClick={() => grade(g.id)}
            >
              <span>{g.label}</span>
              <span className="flash-grade-when">{waits[g.id]}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
