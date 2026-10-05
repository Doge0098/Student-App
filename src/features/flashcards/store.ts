import { createStore, useStore } from '../../hooks/store'
import type { SubjectId } from '../../lib/subjects'
import { uid } from '../../lib/text'
import { cleanList, cleanSubject, finiteOr, isRecord, sameFields, withClean } from '../tasks/cleanStore'
import { START_EASE, findDeckByName, schedule, type Grade } from './srs'

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

function cleanDeck(item: unknown): Deck | null {
  if (!isRecord(item) || typeof item.id !== 'string' || typeof item.name !== 'string') return null
  const fixed = { subject: cleanSubject(item.subject), createdAt: finiteOr(item.createdAt, 0) }
  return sameFields(item, fixed) ? (item as unknown as Deck) : ({ ...item, ...fixed } as Deck)
}

function cleanCard(item: unknown): Card | null {
  if (!isRecord(item)) return null
  const { id, deckId, front, back } = item
  if (typeof id !== 'string' || typeof deckId !== 'string' || typeof front !== 'string' || typeof back !== 'string') return null
  // Sin fecha de repaso válida: toca ya.
  const fixed = {
    due: finiteOr(item.due, 0),
    interval: Math.max(0, finiteOr(item.interval, 0)),
    ease: finiteOr(item.ease, START_EASE),
    reps: Math.max(0, finiteOr(item.reps, 0)),
  }
  return sameFields(item, fixed) ? (item as unknown as Card) : ({ ...item, ...fixed } as Card)
}

/** Mazos y tarjetas guardados, limpios. Datos editados a mano o de otra versión nunca rompen la vista. */
export function cleanFlashcards(value: unknown): FlashcardsData {
  const data = isRecord(value) ? value : {}
  const decks = cleanList(data.decks, cleanDeck)
  const cards = cleanList(data.cards, cleanCard)
  return decks === data.decks && cards === data.cards ? (data as unknown as FlashcardsData) : { ...data, decks, cards }
}

export const flashcardsStore = withClean(createStore<FlashcardsData>('flashcards', { decks: [], cards: [] }), cleanFlashcards)

export function newCard(deckId: string, front: string, back: string): Card {
  return { id: uid(), deckId, front: front.trim(), back: back.trim(), due: Date.now(), interval: 0, ease: START_EASE, reps: 0 }
}

export function useFlashcards() {
  const [data, setData] = useStore(flashcardsStore)
  const change = (fn: (prev: FlashcardsData) => FlashcardsData) => setData(fn)

  return {
    decks: data.decks,
    cards: data.cards,
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
      const existing = findDeckByName(flashcardsStore.get().decks, name)
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
