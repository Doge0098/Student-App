import { describe, expect, it } from 'vitest'
import { deckCards, dueCards, findDeckByName, startSession } from './srs'
import { cleanFlashcards, type Card, type Deck } from './store'

const deck = (extra: Partial<Deck> = {}): Deck => ({ id: 'd1', name: 'Inglés', subject: 'idiomas', createdAt: 1, ...extra })
const card = (extra: Partial<Card> = {}): Card => ({
  id: 'c1',
  deckId: 'd1',
  front: 'to be',
  back: 'ser',
  due: 5,
  interval: 0,
  ease: 2.5,
  reps: 0,
  ...extra,
})

describe('cleanFlashcards', () => {
  it('lo que no tiene forma de mazos y tarjetas se queda vacío', () => {
    for (const value of [null, undefined, [], 'x', {}, { decks: {}, cards: 3 }]) {
      expect(cleanFlashcards(value)).toEqual({ decks: [], cards: [] })
    }
  })

  it('quita los mazos y tarjetas que no se pueden usar', () => {
    const data = cleanFlashcards({
      decks: [null, { id: 'd0' }, { name: 'Sin id' }, deck()],
      cards: [null, { id: 'c0', deckId: 'd1', front: 'x' }, { id: 'c2', deckId: 'd1', front: 1, back: 'y' }, card()],
    })
    expect(data).toEqual({ decks: [deck()], cards: [card()] })
  })

  it('completa lo que falta: asignatura desconocida → General y, sin fecha, toca ya', () => {
    const data = cleanFlashcards({
      decks: [{ id: 'd1', name: 'Inglés', subject: 'religion' }],
      cards: [{ id: 'c1', deckId: 'd1', front: 'to be', back: 'ser', interval: -3, ease: null }],
    })
    expect(data.decks[0]).toEqual({ id: 'd1', name: 'Inglés', subject: 'general', createdAt: 0 })
    expect(data.cards[0]).toEqual({ id: 'c1', deckId: 'd1', front: 'to be', back: 'ser', due: 0, interval: 0, ease: 2.5, reps: 0 })
  })

  it('con los datos arreglados se puede buscar, listar y repasar', () => {
    const { decks, cards } = cleanFlashcards({ decks: [{ id: 'd1', name: 'Inglés' }, 5], cards: [null, card()] })
    expect(findDeckByName(decks, 'inglés')?.id).toBe('d1')
    expect(deckCards(cards, 'd1')).toHaveLength(1)
    expect(dueCards(cards, 10)).toHaveLength(1)
    expect(startSession(cards, 10).queue).toEqual(['c1'])
  })

  it('si todo estaba bien devuelve lo mismo (no copia)', () => {
    const data = { decks: [deck()], cards: [card(), card({ id: 'c2', interval: 3, reps: 2, due: 100 })] }
    expect(cleanFlashcards(data)).toBe(data)
  })
})
