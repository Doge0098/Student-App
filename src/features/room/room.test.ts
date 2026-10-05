import { describe, expect, it } from 'vitest'
import {
  ROOM_MAX_MS,
  ackRoomState,
  createRoom,
  decodeRoom,
  encodeRoom,
  joinRoomState,
  readRoomHash,
  roomCycles,
  roomEndsAt,
  roomHash,
  roomLink,
  roomPhaseAt,
  roomView,
  sameRoom,
  sanitizeActiveRoom,
  settleRoomState,
  studiedOnLeave,
  validateRoom,
  type RoomPayload,
} from './room'

const MIN = 60_000
const START = Date.UTC(2026, 9, 5, 16, 0)
const ROOM: RoomPayload = { v: 1, s: START, f: 30, b: 5 }

/** Base64url de un JSON cualquiera, para probar enlaces manipulados. */
const code = (value: unknown) => btoa(JSON.stringify(value)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

describe('enlace de la sala', () => {
  it('se codifica y decodifica sin perder nada', () => {
    const encoded = encodeRoom(ROOM)
    expect(encoded).toMatch(/^[A-Za-z0-9_-]+$/)
    expect(decodeRoom(encoded)).toEqual(ROOM)
  })

  it('crea el enlace a partir de la dirección de la app', () => {
    const link = roomLink(ROOM, 'https://ejemplo.github.io/lockin/?x=1#viejo')
    expect(link).toBe(`https://ejemplo.github.io/lockin/?x=1${roomHash(ROOM)}`)
    expect(readRoomHash(new URL(link).hash)).toEqual(ROOM)
  })

  it('rechaza enlaces rotos o manipulados', () => {
    expect(decodeRoom('')).toBeNull()
    expect(decodeRoom('no es base64!')).toBeNull()
    expect(decodeRoom(code('hola'))).toBeNull()
    expect(decodeRoom('x'.repeat(500))).toBeNull()
    expect(decodeRoom(code({ ...ROOM, v: 2 }))).toBeNull() // otra versión
    expect(decodeRoom(code({ ...ROOM, f: 10 }))).toBeNull() // menos de 30 min
    expect(decodeRoom(code({ ...ROOM, f: 30.5 }))).toBeNull()
    expect(decodeRoom(code({ ...ROOM, b: 0 }))).toBeNull()
    expect(decodeRoom(code({ ...ROOM, b: 600 }))).toBeNull()
    expect(decodeRoom(code({ ...ROOM, s: 12 }))).toBeNull() // fecha absurda
    expect(decodeRoom(code({ ...ROOM, s: '2026' }))).toBeNull()
  })

  it('distingue entre «no hay sala» y «enlace roto»', () => {
    expect(readRoomHash('')).toBeNull()
    expect(readRoomHash('#otra=cosa')).toBeNull()
    expect(readRoomHash('#sala=')).toBe('invalid')
    expect(readRoomHash('#sala=abc')).toBe('invalid')
    expect(readRoomHash(`#otra=1&sala=${encodeRoom(ROOM)}`)).toEqual(ROOM)
  })

  it('valida al crear y compara salas', () => {
    expect(createRoom(START, 20, 5)).toBeNull()
    expect(createRoom(START, 45, 10)).toEqual({ v: 1, s: START, f: 45, b: 10 })
    expect(validateRoom({ ...ROOM, extra: 'se ignora' })).toEqual(ROOM)
    expect(sameRoom(ROOM, { ...ROOM })).toBe(true)
    expect(sameRoom(ROOM, { ...ROOM, b: 10 })).toBe(false)
    expect(sameRoom(ROOM, null)).toBe(false)
  })
})

describe('horario compartido', () => {
  it('empieza estudiando', () => {
    expect(roomPhaseAt(ROOM, START)).toMatchObject({ phase: 'focus', index: 0, remainingMs: 30 * MIN, durationMs: 30 * MIN })
    expect(roomPhaseAt(ROOM, START + 12 * MIN)).toMatchObject({ phase: 'focus', index: 0, remainingMs: 18 * MIN })
  })

  it('pasa al descanso y vuelve a empezar el ciclo', () => {
    expect(roomPhaseAt(ROOM, START + 30 * MIN)).toMatchObject({ phase: 'break', index: 1, remainingMs: 5 * MIN })
    expect(roomPhaseAt(ROOM, START + 34 * MIN)).toMatchObject({ phase: 'break', index: 1, remainingMs: 1 * MIN })
    expect(roomPhaseAt(ROOM, START + 35 * MIN)).toMatchObject({ phase: 'focus', index: 2, remainingMs: 30 * MIN })
    expect(roomPhaseAt(ROOM, START + 3 * 35 * MIN + 31 * MIN)).toMatchObject({ phase: 'break', index: 7, remainingMs: 4 * MIN })
  })

  it('todos ven lo mismo en el mismo instante, aunque se unan en momentos distintos', () => {
    const t = START + 100 * MIN + 1234
    const a = roomPhaseAt(decodeRoom(encodeRoom(ROOM))!, t)
    const b = roomPhaseAt(ROOM, t)
    expect(a).toEqual(b)
    expect(a.endsAt - t).toBe(a.remainingMs)
  })

  it('si el reloj va un poco atrasado, muestra el primer bloque entero', () => {
    expect(roomPhaseAt(ROOM, START - 3000)).toMatchObject({ phase: 'focus', index: 0, remainingMs: 30 * MIN })
  })

  it('termina tras el último descanso completo antes de 12 horas', () => {
    expect(roomCycles(ROOM)).toBe(20) // 20 × 35 min = 11 h 40 min
    expect(roomEndsAt(ROOM)).toBe(START + 20 * 35 * MIN)
    expect(roomPhaseAt(ROOM, roomEndsAt(ROOM) - 1).phase).toBe('break')
    expect(roomPhaseAt(ROOM, roomEndsAt(ROOM))).toMatchObject({ phase: 'ended', index: 40 })
    expect(roomPhaseAt(ROOM, START + ROOM_MAX_MS + 5 * MIN).phase).toBe('ended')
    expect(roomCycles({ ...ROOM, f: 240, b: 60 })).toBe(2)
  })
})

describe('estar en una sala', () => {
  it('al unirse a mitad, solo cuenta lo que estudia desde entonces', () => {
    const joined = joinRoomState(ROOM, START + 10 * MIN)!
    expect(joined).toMatchObject({ ackIndex: 0, handledIndex: -1 })
    expect(roomView(joined, START + 20 * MIN)).toEqual({ phase: 'focus', status: 'running', durationMs: 30 * MIN, remainingMs: 10 * MIN })

    const { next, ended, over } = settleRoomState(joined, START + 30 * MIN + 500)
    expect(over).toBe(false)
    expect(ended).toEqual({ phase: 'focus', endedAt: START + 30 * MIN, studiedMs: 20 * MIN, completed: true })
    // Ya avisado: no se vuelve a apuntar.
    expect(settleRoomState(next, START + 31 * MIN).ended).toBeNull()
  })

  it('unirse al final no cuenta como bloque completado', () => {
    const joined = joinRoomState(ROOM, START + 25 * MIN)!
    expect(settleRoomState(joined, START + 30 * MIN).ended).toMatchObject({ studiedMs: 5 * MIN, completed: false })
  })

  it('al acabar el bloque espera respuesta y luego sigue a la sala', () => {
    const joined = joinRoomState(ROOM, START)!
    const settled = settleRoomState(joined, START + 30 * MIN).next
    expect(roomView(settled, START + 31 * MIN)).toMatchObject({ phase: 'focus', status: 'finished', remainingMs: 0 })

    const resting = ackRoomState(settled, START + 31 * MIN)
    expect(roomView(resting, START + 31 * MIN)).toEqual({ phase: 'break', status: 'running', durationMs: 5 * MIN, remainingMs: 4 * MIN })

    // Fin del descanso: aviso de «se acabó el descanso».
    const afterBreak = settleRoomState(resting, START + 35 * MIN)
    expect(afterBreak.ended).toMatchObject({ phase: 'break', studiedMs: 0, completed: false })
    expect(roomView(afterBreak.next, START + 36 * MIN)).toMatchObject({ phase: 'break', status: 'finished' })

    // Responde tarde: el bloque le cuenta desde que vuelve.
    const back = ackRoomState(afterBreak.next, START + 37 * MIN)
    expect(back).toMatchObject({ ackIndex: 2, countFrom: START + 37 * MIN })
    expect(settleRoomState(back, START + 65 * MIN).ended).toMatchObject({ phase: 'focus', studiedMs: 28 * MIN, completed: true })
  })

  it('si no responde durante varias fases, no se le cuentan', () => {
    const joined = joinRoomState(ROOM, START)!
    const first = settleRoomState(joined, START + 30 * MIN)
    expect(first.ended?.studiedMs).toBe(30 * MIN)
    // Vuelve una hora y media después: nada más que apuntar, y el aviso habla de la fase recién acabada.
    const later = START + 90 * MIN
    expect(settleRoomState(first.next, later).ended).toBeNull()
    expect(roomView(first.next, later)).toMatchObject({ phase: 'break', status: 'finished' }) // la sala está estudiando (fase 4)
    expect(ackRoomState(first.next, later)).toMatchObject({ ackIndex: 4, handledIndex: 3 })
  })

  it('al salir a mitad de un bloque cuenta lo estudiado', () => {
    const joined = joinRoomState(ROOM, START + 5 * MIN)!
    expect(studiedOnLeave(joined, START + 17 * MIN)).toBe(12 * MIN)
    const resting = ackRoomState(settleRoomState(joined, START + 30 * MIN).next, START + 30 * MIN)
    expect(studiedOnLeave(resting, START + 32 * MIN)).toBe(0)
  })

  it('no se puede unir a una sala terminada y avisa cuando termina', () => {
    expect(joinRoomState(ROOM, roomEndsAt(ROOM) + 1)).toBeNull()
    const joined = joinRoomState(ROOM, roomEndsAt(ROOM) - 2 * MIN)!
    expect(settleRoomState(joined, roomEndsAt(ROOM)).over).toBe(true)
  })

  it('limpia lo guardado si está roto', () => {
    const joined = joinRoomState(ROOM, START)!
    expect(sanitizeActiveRoom(JSON.parse(JSON.stringify(joined)))).toEqual(joined)
    expect(sanitizeActiveRoom(null)).toBeNull()
    expect(sanitizeActiveRoom({ ...joined, room: { ...ROOM, f: 5 } })).toBeNull()
    expect(sanitizeActiveRoom({ ...joined, ackIndex: -4 })).toBeNull()
    expect(sanitizeActiveRoom({ ...joined, countFrom: 'ayer' })).toBeNull()
  })
})
