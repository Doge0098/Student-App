import type { Card, Deck } from './store'

/*
 * Repetición espaciada sencilla (estilo SM-2, simplificado).
 * Cada tarjeta guarda cuándo toca repasarla (`due`), cada cuántos días (`interval`),
 * lo fácil que le resulta al estudiante (`ease`) y cuántas veces seguidas la ha sabido (`reps`).
 * Los repasos caen a principio del día (hora local): así «para hoy» es todo el día, no a la misma hora.
 */

export type Grade = 'again' | 'hard' | 'good' | 'easy'

export const GRADES: { id: Grade; label: string; key: string }[] = [
  { id: 'again', label: 'Otra vez', key: '1' },
  { id: 'hard', label: 'Difícil', key: '2' },
  { id: 'good', label: 'Bien', key: '3' },
  { id: 'easy', label: 'Fácil', key: '4' },
]

export type ReviewState = Pick<Card, 'due' | 'interval' | 'ease' | 'reps'>

export const START_EASE = 2.5
export const MIN_EASE = 1.3
/** «Otra vez»: vuelve a salir en 10 minutos (y al final del repaso en curso). */
export const AGAIN_DELAY_MS = 10 * 60_000
export const MAX_INTERVAL_DAYS = 3650

/** Medianoche (hora local) del día `days` después del de `ms`. Usa el calendario, no 24 h, por los cambios de hora. */
export function addLocalDays(ms: number, days: number): number {
  const date = new Date(ms)
  date.setHours(0, 0, 0, 0)
  date.setDate(date.getDate() + days)
  return date.getTime()
}

export function endOfDay(ms: number): number {
  return addLocalDays(ms, 1) - 1
}

const round2 = (n: number) => Math.round(n * 100) / 100

/** Calcula el siguiente repaso de una tarjeta según cómo la ha sabido el estudiante. */
export function schedule(card: ReviewState, grade: Grade, now: number): ReviewState {
  const ease = Number.isFinite(card.ease) ? Math.max(MIN_EASE, card.ease) : START_EASE
  const interval = Number.isFinite(card.interval) && card.interval > 0 ? card.interval : 0
  const reps = Number.isFinite(card.reps) && card.reps > 0 ? card.reps : 0

  if (grade === 'again') {
    return { due: now + AGAIN_DELAY_MS, interval: 0, ease: round2(Math.max(MIN_EASE, ease - 0.2)), reps: 0 }
  }

  // Nueva (o recién fallada): mañana, en 2 días o en 4. Ya aprendida: el intervalo crece con la facilidad.
  const learned = reps > 0 && interval >= 1
  const hard = learned ? Math.max(1, Math.round(interval * 1.2)) : 1
  const good = learned ? Math.max(hard + 1, Math.round(interval * ease)) : 2
  const easy = learned ? Math.max(good + 1, Math.round(interval * ease * 1.3)) : 4
  const days = Math.min(MAX_INTERVAL_DAYS, grade === 'hard' ? hard : grade === 'good' ? good : easy)
  const nextEase = grade === 'hard' ? Math.max(MIN_EASE, ease - 0.15) : grade === 'easy' ? ease + 0.15 : ease

  return { due: addLocalDays(now, days), interval: days, ease: round2(nextEase), reps: reps + 1 }
}

/** «10 min», «1 día», «3 días», «2 meses», «1 año»… */
export function formatWait(state: ReviewState, now: number): string {
  if (state.interval < 1) return `${Math.max(1, Math.round((state.due - now) / 60_000))} min`
  const days = state.interval
  if (days < 30) return days === 1 ? '1 día' : `${days} días`
  if (days < 365) {
    const months = Math.round(days / 30)
    return months === 1 ? '1 mes' : `${months} meses`
  }
  const years = Math.round(days / 365)
  return years === 1 ? '1 año' : `${years} años`
}

/** Qué pasaría con cada respuesta (se muestra debajo de cada botón). */
export function previewWaits(card: ReviewState, now: number): Record<Grade, string> {
  return Object.fromEntries(GRADES.map((g) => [g.id, formatWait(schedule(card, g.id, now), now)])) as Record<Grade, string>
}

/** Tarjetas que tocan hasta el momento `until` (por defecto, todo el día de hoy), la más atrasada primero. */
export function dueCards<T extends Pick<Card, 'due'>>(cards: T[], now: number, until = endOfDay(now)): T[] {
  return cards.filter((c) => !(c.due > until)).sort((a, b) => a.due - b.due)
}

export function deckCards<T extends Pick<Card, 'deckId'>>(cards: T[], deckId: string): T[] {
  return cards.filter((c) => c.deckId === deckId)
}

export function findDeckByName<T extends Pick<Deck, 'name'>>(decks: T[], name: string): T | undefined {
  const wanted = name.trim().toLowerCase()
  return decks.find((d) => d.name.trim().toLowerCase() === wanted)
}

/* ------------------------------------------------------------------ */
/* Pegar varias tarjetas                                               */
/* ------------------------------------------------------------------ */

/**
 * Convierte texto pegado en tarjetas: una por línea, «pregunta ; respuesta» o separadas por tabulador
 * (lo que sale al copiar dos columnas de una hoja de cálculo). Se corta en el primer separador.
 */
export function parseBulk(text: string): { cards: { front: string; back: string }[]; skipped: number } {
  const cards: { front: string; back: string }[] = []
  let skipped = 0
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim()
    if (!line) continue
    const sep = raw.includes('\t') ? '\t' : ';'
    const at = raw.indexOf(sep)
    const front = at >= 0 ? raw.slice(0, at).trim() : ''
    const back = at >= 0 ? raw.slice(at + 1).trim() : ''
    if (front && back) cards.push({ front, back })
    else skipped++
  }
  return { cards, skipped }
}

/* ------------------------------------------------------------------ */
/* Sesión de repaso                                                    */
/* ------------------------------------------------------------------ */

export interface StudySession {
  /** Ids por repasar; la primera es la que se ve ahora. */
  queue: string[]
  /** Tarjetas distintas que ya han salido. */
  seen: string[]
  grades: Grade[]
}

/** Empieza un repaso con las tarjetas que tocan hoy o, si `all`, con todas (para repasar antes de un examen). */
export function startSession(cards: Pick<Card, 'id' | 'due'>[], now: number, all = false): StudySession {
  const list = all ? [...cards].sort((a, b) => a.due - b.due) : dueCards(cards, now)
  return { queue: list.map((c) => c.id), seen: [], grades: [] }
}

/** Tras responder: la tarjeta sale de la cola, salvo con «Otra vez», que vuelve al final. */
export function answerSession(session: StudySession, cardId: string, grade: Grade): StudySession {
  const rest = session.queue.filter((id) => id !== cardId)
  return {
    queue: grade === 'again' ? [...rest, cardId] : rest,
    seen: session.seen.includes(cardId) ? session.seen : [...session.seen, cardId],
    grades: [...session.grades, grade],
  }
}

export function tallyGrades(grades: Grade[]): Record<Grade, number> {
  const tally: Record<Grade, number> = { again: 0, hard: 0, good: 0, easy: 0 }
  for (const g of grades) tally[g]++
  return tally
}

export function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`
}
