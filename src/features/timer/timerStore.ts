import { createStore, type Store } from '../../hooks/store'
import type { SubjectId } from '../../lib/subjects'

/*
 * Estado del temporizador por su cuenta (sin sala).
 * Es un store compartido: todas las pestañas de LockIn ven el mismo bloque. Lo que apunta minutos
 * (acabar, terminar, unirse a una sala) lee antes el valor guardado en ese instante, porque el aviso
 * entre pestañas llega con retraso: así dos pestañas no apuntan el mismo bloque.
 */

export type TimerPhase = 'idle' | 'focus' | 'break'
export type TimerStatus = 'running' | 'paused' | 'finished'

export interface TimerState {
  phase: TimerPhase
  status: TimerStatus
  durationMs: number
  /** Momento en que acaba el bloque (solo mientras corre). Así no se desajusta aunque la pestaña esté en segundo plano. */
  endsAt: number | null
  /** Tiempo restante guardado al pausar. */
  remainingMs: number
  /** Tarea elegida para el bloque («¿En qué vas a trabajar?»). Opcional. */
  taskId?: string | null
  /** Asignatura de esa tarea al elegirla, por si se borra la tarea a mitad del bloque. */
  taskSubject?: SubjectId | null
}

export interface TimerSettings {
  focusMinutes: number
  breakMinutes: number
}

export const IDLE: TimerState = { phase: 'idle', status: 'paused', durationMs: 0, endsAt: null, remainingMs: 0 }

const PHASES: readonly TimerPhase[] = ['idle', 'focus', 'break']
const STATUSES: readonly TimerStatus[] = ['running', 'paused', 'finished']
const isNum = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n)
const optionalText = (v: unknown): string | null => (typeof v === 'string' ? v : null)

/** Lo guardado, con la misma forma de siempre; si está roto (o lo han editado a mano), el reloj en reposo. */
export function normalizeTimer(raw: unknown): TimerState {
  if (!raw || typeof raw !== 'object') return IDLE
  const r = raw as Record<string, unknown>
  if (!PHASES.includes(r.phase as TimerPhase) || !STATUSES.includes(r.status as TimerStatus)) return IDLE
  return {
    phase: r.phase as TimerPhase,
    status: r.status as TimerStatus,
    durationMs: isNum(r.durationMs) ? Math.max(0, r.durationMs) : 0,
    endsAt: isNum(r.endsAt) ? r.endsAt : null,
    remainingMs: isNum(r.remainingMs) ? Math.max(0, r.remainingMs) : 0,
    taskId: optionalText(r.taskId),
    taskSubject: optionalText(r.taskSubject) as SubjectId | null,
  }
}

/** Misma clave que antes (`student-app:timer`): un bloque en marcha sigue al actualizar la app. */
export const timerStore = createStore<unknown>('timer', IDLE)
export const timerSettingsStore = createStore<TimerSettings>('timer-settings', { focusMinutes: 30, breakMinutes: 5 })

const storageKey = (store: Store<unknown>) => `student-app:${store.key}`

/** Stores cuyo último cambio no se pudo guardar (almacenamiento lleno o bloqueado): manda lo de esta pestaña. */
const unsaved = new WeakSet<Store<unknown>>()

function save(store: Store<unknown>, next: TimerState): void {
  store.set(next)
  try {
    if (localStorage.getItem(storageKey(store)) === JSON.stringify(next)) unsaved.delete(store)
    else unsaved.add(store)
  } catch {
    unsaved.add(store)
  }
}

/** Lo último guardado, aunque lo haya escrito otra pestaña hace un instante. */
export function readFreshTimer(store: Store<unknown> = timerStore): TimerState {
  if (unsaved.has(store)) return normalizeTimer(store.get())
  try {
    const raw = localStorage.getItem(storageKey(store))
    return normalizeTimer(raw === null ? IDLE : JSON.parse(raw))
  } catch {
    return normalizeTimer(store.get())
  }
}

/**
 * Cambia el reloj partiendo del valor guardado ahora mismo (no del de esta pestaña, que puede ir
 * con retraso) y lo guarda antes de nada. Devuelve el estado que había.
 */
export function updateFreshTimer(fn: (fresh: TimerState) => TimerState, store: Store<unknown> = timerStore): TimerState {
  const fresh = readFreshTimer(store)
  save(store, fn(fresh))
  return fresh
}

/**
 * El bloque que acababa en `endsAt` ha llegado a cero: lo marca como terminado y lo devuelve para
 * apuntarlo. Devuelve null si ya no es ese bloque en marcha (otra pestaña lo terminó, lo paró o
 * empezó otro): entonces no hay que apuntar nada.
 */
export function finishSoloBlock(endsAt: number | null, store: Store<unknown> = timerStore): TimerState | null {
  const fresh = readFreshTimer(store)
  if (endsAt === null || fresh.status !== 'running' || fresh.endsAt !== endsAt) {
    // Esta pestaña iba con retraso: se pone al día con lo guardado.
    if (JSON.stringify(normalizeTimer(store.get())) !== JSON.stringify(fresh)) save(store, fresh)
    return null
  }
  save(store, { ...fresh, status: 'finished', endsAt: null, remainingMs: 0 })
  return fresh
}

/** Minutos estudiados de un bloque por su cuenta que aún no ha terminado. */
export function soloStudiedMinutes(s: TimerState, now: number): number {
  if (s.phase !== 'focus' || s.status === 'finished') return 0
  const left = s.endsAt !== null ? s.endsAt - now : s.remainingMs
  return Math.max(0, Math.floor((s.durationMs - Math.max(0, left)) / 60000))
}
