import { createStore, useStore } from '../../hooks/store'
import type { SubjectId } from '../../lib/subjects'
import { uid } from '../../lib/text'

export interface Deck {
  id: string
  name: string
  subject: SubjectId
  createdAt: number
}

/** Tarjeta de memoria. Los campos de repaso los gestiona el algoritmo de repetición espaciada. */
export interface Card {
  id: string
  deckId: string
  front: string
  back: string
  /** Momento (ms) a partir del cual toca repasarla. */
  due: number
  /** Días hasta el siguiente repaso. */
  interval: number
  /** Facilidad (estilo SM-2, empieza en 2.5). */
  ease: number
  reps: number
}

export interface FlashcardsData {
  decks: Deck[]
  cards: Card[]
}

export const flashcardsStore = createStore<FlashcardsData>('flashcards', { decks: [], cards: [] })

export function newCard(deckId: string, front: string, back: string): Card {
  return { id: uid(), deckId, front: front.trim(), back: back.trim(), due: Date.now(), interval: 0, ease: 2.5, reps: 0 }
}

export function useFlashcards() {
  const [data, setData] = useStore(flashcardsStore)
  return {
    ...data,
    setData,
    /**
     * Añade tarjetas a un mazo (lo crea si no existe un mazo con ese nombre).
     * Lo usa también el asistente de IA para guardar las tarjetas que genera.
     */
    addCards: (deckName: string, subject: SubjectId, cards: { front: string; back: string }[]) => {
      setData((prev) => {
        const existing = prev.decks.find((d) => d.name.toLowerCase() === deckName.trim().toLowerCase())
        const deck = existing ?? { id: uid(), name: deckName.trim() || 'Mis tarjetas', subject, createdAt: Date.now() }
        const fresh = cards.filter((c) => c.front.trim() && c.back.trim()).map((c) => newCard(deck.id, c.front, c.back))
        return { decks: existing ? prev.decks : [...prev.decks, deck], cards: [...prev.cards, ...fresh] }
      })
    },
  }
}
