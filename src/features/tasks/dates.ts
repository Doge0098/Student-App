import type { Task } from './store'

/*
 * Fechas de entregas y exámenes.
 * Se guardan como fecha local "YYYY-MM-DD" (la que elige el estudiante en el calendario)
 * y se comparan contando días de calendario, sin horas: así no influyen la zona horaria
 * ni los cambios de hora de verano/invierno.
 */

const DAY_MS = 86_400_000
const DATE_KEY = /^(\d{4})-(\d{2})-(\d{2})$/

/** Días desde 1970 de una fecha "YYYY-MM-DD", o null si no es una fecha real (p. ej. "2026-02-30"). */
function dayNumber(key: string): number | null {
  const match = DATE_KEY.exec(key)
  if (!match) return null
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])]
  const date = new Date(Date.UTC(year, month - 1, day))
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null
  return Math.round(date.getTime() / DAY_MS)
}

export function isDateKey(value: unknown): value is string {
  return typeof value === 'string' && dayNumber(value) !== null
}

/** Días que faltan hasta `due` contando desde `today` (0 = hoy, 1 = mañana, -1 = ayer). */
export function daysUntil(due: string, today: string): number | null {
  const a = dayNumber(due)
  const b = dayNumber(today)
  return a === null || b === null ? null : a - b
}

/** Suma días a una fecha "YYYY-MM-DD". */
export function addDays(key: string, days: number): string {
  const n = dayNumber(key)
  if (n === null) return key
  return new Date((n + days) * DAY_MS).toISOString().slice(0, 10)
}

export type DueTone = 'danger' | 'soon' | 'normal'

export interface DueInfo {
  /** null si es un examen sin fecha. */
  days: number | null
  /** Texto corto de la etiqueta: «Hoy», «Mañana», «En 5 días», «Vencida», «Examen · faltan 5 días»… */
  label: string
  tone: DueTone
}

/** Etiqueta de fecha de una tarea. null si no tiene fecha ni es un examen. */
export function dueInfo(task: Pick<Task, 'due' | 'kind'>, today: string): DueInfo | null {
  const exam = task.kind === 'examen'
  const days = task.due ? daysUntil(task.due, today) : null
  if (days === null) return exam ? { days: null, label: 'Examen', tone: 'normal' } : null

  if (exam) {
    if (days < 0) return { days, label: 'Examen · ya pasó', tone: 'normal' }
    if (days === 0) return { days, label: 'Examen · hoy', tone: 'soon' }
    if (days === 1) return { days, label: 'Examen · mañana', tone: 'soon' }
    return { days, label: `Examen · faltan ${days} días`, tone: 'normal' }
  }
  if (days < 0) return { days, label: 'Vencida', tone: 'danger' }
  if (days === 0) return { days, label: 'Hoy', tone: 'soon' }
  if (days === 1) return { days, label: 'Mañana', tone: 'soon' }
  return { days, label: `En ${days} días`, tone: 'normal' }
}

/** Fecha larga para el título de la etiqueta: «lunes, 12 de octubre». */
export function formatDueDate(key: string): string {
  const match = DATE_KEY.exec(key)
  if (!match || !isDateKey(key)) return key
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
  return date.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })
}

/**
 * Orden de las pendientes: primero las que tienen fecha (la más cercana arriba, vencidas incluidas)
 * y después las que no tienen, en el orden en que estaban.
 */
export function sortPending<T extends Pick<Task, 'due'>>(tasks: T[]): T[] {
  const dated = tasks.filter((t) => isDateKey(t.due))
  const undated = tasks.filter((t) => !isDateKey(t.due))
  // sort es estable: con la misma fecha se mantiene el orden original.
  dated.sort((a, b) => (a.due! < b.due! ? -1 : a.due! > b.due! ? 1 : 0))
  return [...dated, ...undated]
}

/* ------------------------------------------------------------------ */
/* Recordatorios                                                       */
/* ------------------------------------------------------------------ */

/** Se avisa de lo que toca hoy, mañana y pasado mañana. */
export const REMIND_WITHIN_DAYS = 2

/** Avisos ya mostrados: solo cuentan los del día guardado (cada día empieza de cero). */
export interface ShownReminders {
  day: string
  ids: string[]
}

export interface Reminder {
  task: Task
  days: number
}

/** Tareas pendientes con fecha en los próximos días de las que aún no se ha avisado hoy. */
export function remindersToShow(tasks: Task[], today: string, shown: ShownReminders): Reminder[] {
  const already = shown.day === today ? new Set(shown.ids) : new Set<string>()
  const result: Reminder[] = []
  for (const task of tasks) {
    if (task.done || !task.due || already.has(task.id)) continue
    const days = daysUntil(task.due, today)
    if (days !== null && days >= 0 && days <= REMIND_WITHIN_DAYS) result.push({ task, days })
  }
  return result.sort((a, b) => a.days - b.days)
}

/** Apunta los avisos mostrados hoy (los de días anteriores se descartan). */
export function markShown(shown: ShownReminders, today: string, ids: string[]): ShownReminders {
  const previous = shown.day === today ? shown.ids : []
  return { day: today, ids: [...new Set([...previous, ...ids])] }
}

/** ¿Hay que avisar de esta tarea (tiene fecha cercana)? */
export function isDueSoon(task: Pick<Task, 'due'>, today: string): boolean {
  const days = task.due ? daysUntil(task.due, today) : null
  return days !== null && days >= 0 && days <= REMIND_WITHIN_DAYS
}

const WHEN = ['Hoy', 'Mañana', 'Pasado mañana']

export function reminderText({ task, days }: Reminder): string {
  const when = WHEN[days] ?? `En ${days} días`
  return task.kind === 'examen' ? `${when} tienes examen: ${task.text}` : `${when} se entrega: ${task.text}`
}

/** Mensaje para el aviso en pantalla (corto) y para la notificación del navegador (completo). */
export function reminderMessage(reminders: Reminder[]): { toast: string; title: string; body: string } {
  const [first] = reminders
  if (!first) return { toast: '', title: '', body: '' }
  const extra = reminders.length - 1
  return {
    toast: extra > 0 ? `${reminderText(first)} (y ${extra} más)` : reminderText(first),
    title: reminders.some((r) => r.task.kind === 'examen') ? 'Se acerca un examen' : 'Se acerca una entrega',
    body: reminders.map(reminderText).join('\n'),
  }
}
