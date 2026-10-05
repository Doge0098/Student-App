import { MAX_FOCUS_MINUTES, MIN_FOCUS_MINUTES } from '../../lib/time'

/*
 * «Estudiar con amigos» sin servidor.
 * Una sala es solo un enlace: lleva la hora de inicio y los minutos de estudio y descanso.
 * Cada navegador calcula la fase con su propio reloj, así que todos ven el mismo 00:00 a la
 * vez sin hablar con nadie. Por lo mismo no hay forma de saber quién está dentro.
 */

export const ROOM_VERSION = 1
/** Parámetro del enlace: …/#sala=<código> */
export const ROOM_HASH_PARAM = 'sala'
/** Una sala dura como mucho 12 horas (acaba tras el último descanso completo). */
export const ROOM_MAX_MS = 12 * 3_600_000
export const ROOM_MIN_BREAK = 1
export const ROOM_MAX_BREAK = 60

const MIN_START = Date.UTC(2024, 0, 1)
const MAX_START = Date.UTC(2100, 0, 1)
const MAX_CODE_LENGTH = 200

export interface RoomPayload {
  /** Versión del formato. */
  v: typeof ROOM_VERSION
  /** Inicio (ms desde 1970). */
  s: number
  /** Minutos de concentración (30 o más). */
  f: number
  /** Minutos de descanso. */
  b: number
}

const isInt = (n: unknown, min: number, max: number): n is number =>
  typeof n === 'number' && Number.isInteger(n) && n >= min && n <= max

/** Devuelve la sala si los datos son válidos; si no, null. */
export function validateRoom(raw: unknown): RoomPayload | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  if (r.v !== ROOM_VERSION) return null
  if (!isInt(r.s, MIN_START, MAX_START)) return null
  if (!isInt(r.f, MIN_FOCUS_MINUTES, MAX_FOCUS_MINUTES)) return null
  if (!isInt(r.b, ROOM_MIN_BREAK, ROOM_MAX_BREAK)) return null
  return { v: ROOM_VERSION, s: r.s, f: r.f, b: r.b }
}

export function createRoom(start: number, focusMinutes: number, breakMinutes: number): RoomPayload | null {
  return validateRoom({ v: ROOM_VERSION, s: Math.round(start), f: focusMinutes, b: breakMinutes })
}

export function sameRoom(a: RoomPayload | null, b: RoomPayload | null): boolean {
  return Boolean(a && b && a.s === b.s && a.f === b.f && a.b === b.b)
}

/* ------------------------------------------------------------------ */
/* Enlace                                                              */
/* ------------------------------------------------------------------ */

/** JSON → base64url (sin + / =, para que el enlace no se rompa al copiarlo). */
export function encodeRoom(room: RoomPayload): string {
  const json = JSON.stringify({ v: room.v, s: room.s, f: room.f, b: room.b })
  return btoa(json).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export function decodeRoom(code: string): RoomPayload | null {
  if (!code || code.length > MAX_CODE_LENGTH || !/^[A-Za-z0-9_-]+$/.test(code)) return null
  try {
    const base64 = code.replace(/-/g, '+').replace(/_/g, '/')
    const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4)
    return validateRoom(JSON.parse(atob(padded)))
  } catch {
    return null
  }
}

export function roomHash(room: RoomPayload): string {
  return `#${ROOM_HASH_PARAM}=${encodeRoom(room)}`
}

/** Enlace completo para compartir; `base` es la dirección de la app (se le quita el # que tenga). */
export function roomLink(room: RoomPayload, base: string): string {
  return base.split('#')[0] + roomHash(room)
}

/**
 * Lee el # de la dirección. null = no hay sala en el enlace;
 * 'invalid' = hay una sala pero el enlace está roto o es de otra versión.
 */
export function readRoomHash(hash: string): RoomPayload | 'invalid' | null {
  const params = new URLSearchParams(hash.replace(/^#/, ''))
  if (!params.has(ROOM_HASH_PARAM)) return null
  return decodeRoom(params.get(ROOM_HASH_PARAM) ?? '') ?? 'invalid'
}

/* ------------------------------------------------------------------ */
/* Horario: estudio y descanso se repiten desde el inicio               */
/* ------------------------------------------------------------------ */

export type RoomPhaseName = 'focus' | 'break'

export interface RoomPhase {
  /** 'ended' cuando la sala ya terminó. */
  phase: RoomPhaseName | 'ended'
  /** Número de fase desde el inicio: 0 estudio, 1 descanso, 2 estudio… */
  index: number
  startedAt: number
  endsAt: number
  durationMs: number
  remainingMs: number
}

const focusMs = (room: RoomPayload) => room.f * 60_000
const breakMs = (room: RoomPayload) => room.b * 60_000
const cycleMs = (room: RoomPayload) => focusMs(room) + breakMs(room)

/** Ciclos (estudio + descanso) que caben en la duración máxima; al menos uno. */
export function roomCycles(room: RoomPayload): number {
  return Math.max(1, Math.floor(ROOM_MAX_MS / cycleMs(room)))
}

export function roomEndsAt(room: RoomPayload): number {
  return room.s + roomCycles(room) * cycleMs(room)
}

/** Inicio, fin y tipo de una fase por su número. */
export function phaseBounds(room: RoomPayload, index: number): { phase: RoomPhaseName; start: number; end: number } {
  const cycle = Math.floor(index / 2)
  const cycleStart = room.s + cycle * cycleMs(room)
  return index % 2 === 0
    ? { phase: 'focus', start: cycleStart, end: cycleStart + focusMs(room) }
    : { phase: 'break', start: cycleStart + focusMs(room), end: cycleStart + cycleMs(room) }
}

/** Fase de la sala en el instante `t`. */
export function roomPhaseAt(room: RoomPayload, t: number): RoomPhase {
  const total = roomCycles(room) * 2
  const elapsed = t - room.s
  if (elapsed >= roomEndsAt(room) - room.s) {
    const end = roomEndsAt(room)
    return { phase: 'ended', index: total, startedAt: end, endsAt: end, durationMs: 0, remainingMs: 0 }
  }
  // Si el reloj de este ordenador va un poco por detrás del de quien creó la sala,
  // se muestra el primer bloque entero en vez de un número raro.
  const cycle = elapsed < 0 ? 0 : Math.floor(elapsed / cycleMs(room))
  const pos = elapsed < 0 ? 0 : elapsed - cycle * cycleMs(room)
  const index = cycle * 2 + (pos < focusMs(room) ? 0 : 1)
  const { phase, start, end } = phaseBounds(room, index)
  const durationMs = end - start
  return { phase, index, startedAt: start, endsAt: end, durationMs, remainingMs: Math.min(durationMs, Math.max(0, end - t)) }
}

/* ------------------------------------------------------------------ */
/* Estar en una sala                                                   */
/* ------------------------------------------------------------------ */

/**
 * Lo que guarda cada estudiante de la sala en la que está.
 * Al acabar cada fase sale el aviso de siempre; mientras no lo responde se considera que no
 * está (no se le cuentan minutos de estudio), aunque el reloj de la sala sigue avanzando.
 */
export interface ActiveRoom {
  room: RoomPayload
  /** Fase en la que está el estudiante (la que aceptó al unirse o al responder el aviso). */
  ackIndex: number
  /** Desde cuándo le cuenta el estudio de esa fase (al unirse a mitad, o al responder tarde). */
  countFrom: number
  /** Última fase cuyo final ya se avisó y apuntó. */
  handledIndex: number
}

export function sanitizeActiveRoom(raw: unknown): ActiveRoom | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  const room = validateRoom(r.room)
  if (!room) return null
  const max = roomCycles(room) * 2
  if (!isInt(r.ackIndex, 0, max) || !isInt(r.handledIndex, -1, max) || typeof r.countFrom !== 'number' || !Number.isFinite(r.countFrom)) {
    return null
  }
  return { room, ackIndex: r.ackIndex, countFrom: r.countFrom, handledIndex: r.handledIndex }
}

/** Unirse (o crear) una sala en el instante `now`. null si ya terminó. */
export function joinRoomState(room: RoomPayload, now: number): ActiveRoom | null {
  const current = roomPhaseAt(room, now)
  if (current.phase === 'ended') return null
  return { room, ackIndex: current.index, countFrom: now, handledIndex: current.index - 1 }
}

/** El estudiante responde al aviso: pasa a la fase en la que está ahora la sala. */
export function ackRoomState(active: ActiveRoom, now: number): ActiveRoom {
  const current = roomPhaseAt(active.room, now)
  if (current.phase === 'ended' || current.index <= active.ackIndex) return active
  return {
    ...active,
    ackIndex: current.index,
    countFrom: now,
    handledIndex: Math.max(active.handledIndex, current.index - 1),
  }
}

export interface RoomPhaseEnd {
  phase: RoomPhaseName
  endedAt: number
  /** Tiempo estudiado en esa fase (solo si era de estudio). */
  studiedMs: number
  /** Cuenta como bloque completado si estuvo al menos la mitad. */
  completed: boolean
}

/**
 * ¿Ha terminado la fase en la que estaba el estudiante y aún no se ha avisado?
 * Devuelve el estado siguiente, lo que terminó (para sonar y apuntar minutos) y si la sala acabó.
 */
export function settleRoomState(active: ActiveRoom, now: number): { next: ActiveRoom; ended: RoomPhaseEnd | null; over: boolean } {
  const current = roomPhaseAt(active.room, now)
  const over = current.phase === 'ended'
  if (current.index <= active.ackIndex || active.handledIndex >= active.ackIndex) {
    return { next: active, ended: null, over }
  }
  const { phase, start, end } = phaseBounds(active.room, active.ackIndex)
  const studiedMs = phase === 'focus' ? Math.max(0, end - Math.max(start, active.countFrom)) : 0
  return {
    next: { ...active, handledIndex: active.ackIndex },
    ended: { phase, endedAt: end, studiedMs, completed: phase === 'focus' && studiedMs >= (end - start) / 2 },
    over,
  }
}

export interface RoomView {
  phase: RoomPhaseName
  /** 'finished' = acabó su fase y falta que responda el aviso. */
  status: 'running' | 'finished'
  durationMs: number
  remainingMs: number
}

/** Lo que muestra el temporizador estando en la sala. */
export function roomView(active: ActiveRoom, now: number): RoomView {
  const current = roomPhaseAt(active.room, now)
  if (current.phase !== 'ended' && current.index <= active.ackIndex) {
    return { phase: current.phase, status: 'running', durationMs: current.durationMs, remainingMs: current.remainingMs }
  }
  // Lo que acaba de terminar es la fase anterior a la actual: el aviso habla de esa.
  const justEnded: RoomPhaseName = current.phase === 'break' ? 'focus' : 'break'
  return {
    phase: justEnded,
    status: 'finished',
    durationMs: justEnded === 'focus' ? focusMs(active.room) : breakMs(active.room),
    remainingMs: 0,
  }
}

/** Tiempo estudiado en el bloque actual si sale de la sala ahora (0 si no estaba estudiando). */
export function studiedOnLeave(active: ActiveRoom, now: number): number {
  const current = roomPhaseAt(active.room, now)
  if (current.phase !== 'focus' || current.index !== active.ackIndex) return 0
  return Math.max(0, now - Math.max(current.startedAt, active.countFrom))
}
