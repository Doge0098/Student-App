import { describe, expect, it } from 'vitest'
import {
  AGAIN_DELAY_MS,
  MAX_INTERVAL_DAYS,
  MIN_EASE,
  addLocalDays,
  answerSession,
  dueCards,
  endOfDay,
  findDeckByName,
  formatWait,
  parseBulk,
  plural,
  previewWaits,
  schedule,
  startSession,
  tallyGrades,
  type ReviewState,
} from './srs'

// 5 de octubre de 2026, 18:30 (hora local)
const now = new Date(2026, 9, 5, 18, 30).getTime()
const fresh: ReviewState = { due: now, interval: 0, ease: 2.5, reps: 0 }
const midnight = (y: number, m: number, d: number) => new Date(y, m, d).getTime()

describe('addLocalDays y endOfDay', () => {
  it('caen a medianoche del día que toca, aunque cambie la hora', () => {
    expect(addLocalDays(now, 1)).toBe(midnight(2026, 9, 6))
    expect(addLocalDays(now, 30)).toBe(midnight(2026, 10, 4))
    expect(endOfDay(now)).toBe(midnight(2026, 9, 6) - 1)
  })
})

describe('schedule', () => {
  it('«Otra vez» la vuelve a sacar en 10 minutos y baja la facilidad', () => {
    const next = schedule({ due: now, interval: 12, ease: 2.5, reps: 4 }, 'again', now)
    expect(next).toEqual({ due: now + AGAIN_DELAY_MS, interval: 0, ease: 2.3, reps: 0 })
  })

  it('tarjeta nueva: Difícil mañana, Bien en 2 días, Fácil en 4', () => {
    expect(schedule(fresh, 'hard', now)).toEqual({ due: midnight(2026, 9, 6), interval: 1, ease: 2.35, reps: 1 })
    expect(schedule(fresh, 'good', now)).toEqual({ due: midnight(2026, 9, 7), interval: 2, ease: 2.5, reps: 1 })
    expect(schedule(fresh, 'easy', now)).toEqual({ due: midnight(2026, 9, 9), interval: 4, ease: 2.65, reps: 1 })
  })

  it('ya aprendida: el intervalo crece multiplicando por la facilidad', () => {
    const card: ReviewState = { due: now, interval: 4, ease: 2.5, reps: 2 }
    expect(schedule(card, 'hard', now).interval).toBe(5)
    expect(schedule(card, 'good', now).interval).toBe(10)
    expect(schedule(card, 'easy', now).interval).toBe(13)
    expect(schedule(card, 'good', now).due).toBe(midnight(2026, 9, 15))
    expect(schedule(card, 'good', now).reps).toBe(3)
  })

  it('Difícil < Bien < Fácil incluso con intervalos cortos y facilidad mínima', () => {
    const card: ReviewState = { due: now, interval: 1, ease: MIN_EASE, reps: 1 }
    const [hard, good, easy] = (['hard', 'good', 'easy'] as const).map((g) => schedule(card, g, now).interval)
    expect(hard).toBeLessThan(good)
    expect(good).toBeLessThan(easy)
  })

  it('la facilidad nunca baja de 1,3', () => {
    let card: ReviewState = fresh
    for (let i = 0; i < 20; i++) card = schedule(card, i % 2 ? 'again' : 'hard', now)
    expect(card.ease).toBe(MIN_EASE)
  })

  it('no pasa de 10 años', () => {
    const card: ReviewState = { due: now, interval: 3000, ease: 3, reps: 10 }
    expect(schedule(card, 'easy', now).interval).toBe(MAX_INTERVAL_DAYS)
  })

  it('aguanta datos rotos', () => {
    const broken = { due: now, interval: Number.NaN, ease: Number.NaN, reps: Number.NaN } as ReviewState
    expect(schedule(broken, 'good', now)).toEqual({ due: midnight(2026, 9, 7), interval: 2, ease: 2.5, reps: 1 })
  })
})

describe('formatWait y previewWaits', () => {
  it('describe cuándo vuelve a salir', () => {
    expect(formatWait({ due: now + AGAIN_DELAY_MS, interval: 0, ease: 2.5, reps: 0 }, now)).toBe('10 min')
    expect(formatWait({ ...fresh, interval: 1 }, now)).toBe('1 día')
    expect(formatWait({ ...fresh, interval: 6 }, now)).toBe('6 días')
    expect(formatWait({ ...fresh, interval: 31 }, now)).toBe('1 mes')
    expect(formatWait({ ...fresh, interval: 100 }, now)).toBe('3 meses')
    expect(formatWait({ ...fresh, interval: 400 }, now)).toBe('1 año')
    expect(formatWait({ ...fresh, interval: 800 }, now)).toBe('2 años')
  })

  it('una por botón', () => {
    expect(previewWaits(fresh, now)).toEqual({ again: '10 min', hard: '1 día', good: '2 días', easy: '4 días' })
  })
})

describe('dueCards', () => {
  it('incluye todo lo de hoy (también lo de más tarde) y ordena por antigüedad', () => {
    const cards = [
      { id: 'tarde', due: now + 3 * 3_600_000 },
      { id: 'manana', due: midnight(2026, 9, 6) },
      { id: 'atrasada', due: now - 5 * 86_400_000 },
      { id: 'ahora', due: now },
    ]
    expect(dueCards(cards, now).map((c) => c.id)).toEqual(['atrasada', 'ahora', 'tarde'])
    expect(dueCards(cards, now, endOfDay(addLocalDays(now, 1))).map((c) => c.id)).toEqual([
      'atrasada',
      'ahora',
      'tarde',
      'manana',
    ])
  })
})

describe('findDeckByName', () => {
  it('no distingue mayúsculas ni espacios de los extremos', () => {
    const decks = [{ name: 'Verbos irregulares' }, { name: 'Capitales' }]
    expect(findDeckByName(decks, '  capitales ')).toBe(decks[1])
    expect(findDeckByName(decks, 'Química')).toBeUndefined()
  })
})

describe('parseBulk', () => {
  it('lee «pregunta ; respuesta» y líneas con tabulador', () => {
    const text = 'Capital de Francia ; París\r\n\nH2O;Agua\nto be\tser; estar\nsin separador\n ; sin pregunta\n'
    expect(parseBulk(text)).toEqual({
      cards: [
        { front: 'Capital de Francia', back: 'París' },
        { front: 'H2O', back: 'Agua' },
        { front: 'to be', back: 'ser; estar' },
      ],
      skipped: 2,
    })
  })

  it('corta en el primer «;»', () => {
    expect(parseBulk('a ; b ; c').cards).toEqual([{ front: 'a', back: 'b ; c' }])
  })

  it('texto vacío', () => {
    expect(parseBulk('  \n\n')).toEqual({ cards: [], skipped: 0 })
  })
})

describe('sesión de repaso', () => {
  const cards = [
    { id: 'b', due: now - 1000 },
    { id: 'a', due: now - 5000 },
    { id: 'futura', due: midnight(2026, 9, 20) },
  ]

  it('empieza con las que tocan hoy, o con todas', () => {
    expect(startSession(cards, now).queue).toEqual(['a', 'b'])
    expect(startSession(cards, now, true).queue).toEqual(['a', 'b', 'futura'])
  })

  it('«Otra vez» manda la tarjeta al final; el resto sale de la cola', () => {
    let s = startSession(cards, now)
    s = answerSession(s, 'a', 'again')
    expect(s.queue).toEqual(['b', 'a'])
    s = answerSession(s, 'b', 'good')
    expect(s.queue).toEqual(['a'])
    s = answerSession(s, 'a', 'hard')
    expect(s).toEqual({ queue: [], seen: ['a', 'b'], grades: ['again', 'good', 'hard'] })
  })

  it('cuenta las respuestas para el resumen', () => {
    expect(tallyGrades(['again', 'good', 'good', 'easy'])).toEqual({ again: 1, hard: 0, good: 2, easy: 1 })
    expect(plural(1, 'tarjeta', 'tarjetas')).toBe('1 tarjeta')
    expect(plural(3, 'tarjeta', 'tarjetas')).toBe('3 tarjetas')
  })
})
