import { createStore, useStore } from '../../hooks/store'
import type { SubjectId } from '../../lib/subjects'
import { uid } from '../../lib/text'
import { findDeckByName, schedule, type Grade } from './srs'

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

/** Datos editados a mano o de otra versión: nunca rompen la vista. */
function clean(data: FlashcardsData | null | undefined): FlashcardsData {
  return {
    decks: Array.isArray(data?.decks) ? data.decks : [],
    cards: Array.isArray(data?.cards) ? data.cards : [],
  }
}

export function useFlashcards() {
  const [stored, setStored] = useStore(flashcardsStore)
  const data = clean(stored)
  const setData = setStored
  const change = (fn: (prev: FlashcardsData) => FlashcardsData) => setStored((prev) => fn(clean(prev)))

  return {
    ...data,
    setData,
    /**
     * Añade tarjetas a un mazo (lo crea si no existe un mazo con ese nombre).
     * Lo usa también el asistente de IA para guardar las tarjetas que genera.
     */
    addCards: (deckName: string, subject: SubjectId, cards: { front: string; back: string }[]) => {
      change((prev) => {
        const existing = findDeckByName(prev.decks, deckName)
        const deck = existing ?? { id: uid(), name: deckName.trim() || 'Mis tarjetas', subject, createdAt: Date.now() }
        const fresh = cards.filter((c) => c.front.trim() && c.back.trim()).map((c) => newCard(deck.id, c.front, c.back))
        return { decks: existing ? prev.decks : [...prev.decks, deck], cards: [...prev.cards, ...fresh] }
      })
    },
    /** Crea un mazo vacío; si ya hay uno con ese nombre, devuelve ese. */
    createDeck: (name: string, subject: SubjectId): Deck => {
      const existing = findDeckByName(clean(flashcardsStore.get()).decks, name)
      if (existing) return existing
      const deck: Deck = { id: uid(), name: name.trim() || 'Mis tarjetas', subject, createdAt: Date.now() }
      change((prev) => ({ ...prev, decks: [...prev.decks, deck] }))
      return deck
    },
    updateDeck: (id: string, patch: Partial<Pick<Deck, 'name' | 'subject'>>) =>
      change((prev) => ({ ...prev, decks: prev.decks.map((d) => (d.id === id ? { ...d, ...patch } : d)) })),
    /** Borra el mazo y sus tarjetas. */
    removeDeck: (id: string) =>
      change((prev) => ({ decks: prev.decks.filter((d) => d.id !== id), cards: prev.cards.filter((c) => c.deckId !== id) })),
    addCard: (deckId: string, front: string, back: string) => {
      if (!front.trim() || !back.trim()) return
      change((prev) => ({ ...prev, cards: [...prev.cards, newCard(deckId, front, back)] }))
    },
    /** Pegar varias a la vez en un mazo concreto. */
    addCardsToDeck: (deckId: string, cards: { front: string; back: string }[]) => {
      const fresh = cards.filter((c) => c.front.trim() && c.back.trim()).map((c) => newCard(deckId, c.front, c.back))
      if (fresh.length > 0) change((prev) => ({ ...prev, cards: [...prev.cards, ...fresh] }))
    },
    updateCard: (id: string, patch: Partial<Pick<Card, 'front' | 'back'>>) =>
      change((prev) => ({ ...prev, cards: prev.cards.map((c) => (c.id === id ? { ...c, ...patch } : c)) })),
    removeCard: (id: string) => change((prev) => ({ ...prev, cards: prev.cards.filter((c) => c.id !== id) })),
    /** Guarda la respuesta del repaso y programa el siguiente. */
    gradeCard: (id: string, grade: Grade, now = Date.now()) =>
      change((prev) => ({ ...prev, cards: prev.cards.map((c) => (c.id === id ? { ...c, ...schedule(c, grade, now) } : c)) })),
  }
}
