import { SUBJECT_IDS, SUBJECTS, type SubjectId } from '../../lib/subjects'
import { todayKey } from '../../lib/time'

/*
 * «Tu progreso»: minutos estudiados por día y por asignatura.
 * Se guarda en el navegador con la misma clave que el antiguo resumen del día
 * (`timer-stats`), que solo tenía { date, blocks, minutes }: ese formato se convierte
 * al nuevo al leerlo, así que los minutos de hoy no se pierden.
 */

export interface DayProgress {
  /** Minutos estudiados ese día (bloques completos y también los terminados antes de tiempo). */
  minutes: number
  /** Bloques de concentración completados. */
  blocks: number
  /** Minutos por asignatura (la de la tarea elegida para el bloque, o «General»). */
  subjects: Partial<Record<SubjectId, number>>
}

export interface ProgressData {
  v: 2
  /** Clave "YYYY-MM-DD" (fecha local). */
  days: Record<string, DayProgress>
}

export const EMPTY_PROGRESS: ProgressData = { v: 2, days: {} }

/** Más de un año de historial; lo anterior se borra para no llenar el navegador. */
export const KEEP_DAYS = 400

const DATE_KEY = /^(\d{4})-(\d{2})-(\d{2})$/

function amount(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? Math.round(value) : 0
}

function isSubject(id: string): id is SubjectId {
  return Object.prototype.hasOwnProperty.call(SUBJECTS, id)
}

function cleanDay(raw: unknown): DayProgress | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  const minutes = amount(r.minutes)
  const blocks = amount(r.blocks)
  const subjects: Partial<Record<SubjectId, number>> = {}
  if (r.subjects && typeof r.subjects === 'object') {
    for (const [id, value] of Object.entries(r.subjects as Record<string, unknown>)) {
      const m = amount(value)
      if (isSubject(id) && m > 0) subjects[id] = m
    }
  }
  if (minutes === 0 && blocks === 0) return null
  return { minutes, blocks, subjects }
}

/** Lee lo guardado (cualquier versión, o datos rotos) y devuelve siempre datos válidos. */
export function normalizeProgress(raw: unknown): ProgressData {
  if (!raw || typeof raw !== 'object') return EMPTY_PROGRESS
  const r = raw as Record<string, unknown>

  // Formato antiguo: solo el resumen de un día, sin asignaturas.
  if (typeof r.date === 'string' && !('days' in r)) {
    if (!DATE_KEY.test(r.date)) return EMPTY_PROGRESS
    const minutes = amount(r.minutes)
    const blocks = amount(r.blocks)
    if (minutes === 0 && blocks === 0) return EMPTY_PROGRESS
    return { v: 2, days: { [r.date]: { minutes, blocks, subjects: minutes > 0 ? { general: minutes } : {} } } }
  }

  if (!r.days || typeof r.days !== 'object') return EMPTY_PROGRESS
  const days: Record<string, DayProgress> = {}
  for (const [date, value] of Object.entries(r.days as Record<string, unknown>)) {
    if (!DATE_KEY.test(date)) continue
    const day = cleanDay(value)
    if (day) days[date] = day
  }
  return { v: 2, days }
}

export interface StudyEntry {
  /** Día al que se apunta, "YYYY-MM-DD". */
  date: string
  minutes: number
  subject: SubjectId
  /** Bloques completados que se suman (0 si se paró antes de tiempo). */
  blocks: number
}

/** Suma minutos (y bloques) a un día y a su asignatura. No modifica `data`. */
export function addStudy(data: ProgressData, entry: StudyEntry): ProgressData {
  const minutes = amount(entry.minutes)
  const blocks = amount(entry.blocks)
  if ((minutes === 0 && blocks === 0) || !DATE_KEY.test(entry.date)) return data
  const subject: SubjectId = isSubject(entry.subject) ? entry.subject : 'general'
  const prev = data.days[entry.date] ?? { minutes: 0, blocks: 0, subjects: {} }
  const day: DayProgress = {
    minutes: prev.minutes + minutes,
    blocks: prev.blocks + blocks,
    subjects: minutes > 0 ? { ...prev.subjects, [subject]: (prev.subjects[subject] ?? 0) + minutes } : prev.subjects,
  }
  let days: Record<string, DayProgress> = { ...data.days, [entry.date]: day }
  const keys = Object.keys(days)
  if (keys.length > KEEP_DAYS) {
    const keep = new Set(keys.sort().slice(-KEEP_DAYS))
    days = Object.fromEntries(Object.entries(days).filter(([date]) => keep.has(date)))
  }
  return { v: 2, days }
}

/* ------------------------------------------------------------------ */
/* Fechas                                                              */
/* ------------------------------------------------------------------ */

function toDate(key: string): Date {
  const match = DATE_KEY.exec(key)
  if (!match) return new Date(Number.NaN)
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
}

/** Suma (o resta) días de calendario a una fecha "YYYY-MM-DD". */
export function shiftDay(key: string, delta: number): string {
  const date = toDate(key)
  date.setDate(date.getDate() + delta)
  return todayKey(date)
}

const WEEKDAY_SHORT = ['D', 'L', 'M', 'X', 'J', 'V', 'S']
const WEEKDAY_LONG = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']
const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sept', 'oct', 'nov', 'dic']

export interface DaySummary {
  date: string
  minutes: number
  blocks: number
  /** Letra del día de la semana: L M X J V S D. */
  short: string
  /** "lunes 5 oct" */
  long: string
  isToday: boolean
}

/** Los últimos `count` días, del más antiguo a hoy (los días sin estudio salen con 0). */
export function lastDays(data: ProgressData, today: string, count = 7): DaySummary[] {
  const result: DaySummary[] = []
  for (let i = count - 1; i >= 0; i--) {
    const date = shiftDay(today, -i)
    const d = toDate(date)
    const day = data.days[date]
    result.push({
      date,
      minutes: day?.minutes ?? 0,
      blocks: day?.blocks ?? 0,
      short: WEEKDAY_SHORT[d.getDay()],
      long: `${WEEKDAY_LONG[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`,
      isToday: i === 0,
    })
  }
  return result
}

/**
 * Racha: días seguidos con al menos un bloque completado.
 * Si hoy aún no hay ninguno, la racha de ayer sigue viva hasta que acabe el día.
 */
export function currentStreak(data: ProgressData, today: string): number {
  const done = (date: string) => (data.days[date]?.blocks ?? 0) > 0
  let day = done(today) ? today : shiftDay(today, -1)
  let streak = 0
  while (done(day) && streak <= KEEP_DAYS) {
    streak++
    day = shiftDay(day, -1)
  }
  return streak
}

export interface SubjectTotal {
  subject: SubjectId
  minutes: number
}

/** Minutos por asignatura en los últimos `count` días, de más a menos. */
export function subjectTotals(data: ProgressData, today: string, count = 7): SubjectTotal[] {
  const totals = new Map<SubjectId, number>()
  for (let i = 0; i < count; i++) {
    const day = data.days[shiftDay(today, -i)]
    if (!day) continue
    for (const [id, minutes] of Object.entries(day.subjects) as [SubjectId, number][]) {
      totals.set(id, (totals.get(id) ?? 0) + minutes)
    }
  }
  return SUBJECT_IDS.filter((id) => (totals.get(id) ?? 0) > 0)
    .map((subject) => ({ subject, minutes: totals.get(subject) ?? 0 }))
    .sort((a, b) => b.minutes - a.minutes)
}

/** 45 → "45 min"; 60 → "1 h"; 95 → "1 h 35 min" */
export function formatMinutes(minutes: number): string {
  const m = Math.max(0, Math.round(minutes))
  if (m < 60) return `${m} min`
  const h = Math.floor(m / 60)
  const rest = m % 60
  return rest ? `${h} h ${rest} min` : `${h} h`
}
