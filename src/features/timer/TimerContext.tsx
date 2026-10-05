import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useToast } from '../../components/Toast'
import { useStore } from '../../hooks/store'
import { usePersistentState } from '../../hooks/usePersistentState'
import { notify, playChime, primeAudio, requestNotificationPermission } from '../../lib/alerts'
import type { SubjectId } from '../../lib/subjects'
import { clampBreakMinutes, clampFocusMinutes, formatClock, todayKey } from '../../lib/time'
import { setFocusMode } from '../focus/focusMode'
import { recordStudy, useProgress } from '../progress/store'
import {
  ackRoomState,
  createRoom as makeRoom,
  joinRoomState,
  readRoomHash,
  roomView,
  sameRoom,
  sanitizeActiveRoom,
  settleRoomState,
  studiedOnLeave,
  type RoomPayload,
} from '../room/room'
import { clearRoomFromAddress, readFreshRoom, roomStore, showRoomInAddress } from '../room/roomStore'
import { tasksStore, type Task } from '../tasks/store'

export type TimerPhase = 'idle' | 'focus' | 'break'
export type TimerStatus = 'running' | 'paused' | 'finished'

interface TimerState {
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

interface TimerSettings {
  focusMinutes: number
  breakMinutes: number
}

interface DayStats {
  date: string
  blocks: number
  minutes: number
}

interface TimerContextValue {
  phase: TimerPhase
  status: TimerStatus
  durationMs: number
  settings: TimerSettings
  today: DayStats
  /** Tarea elegida para el bloque (null = ninguna en concreto). */
  taskId: string | null
  setTaskId: (id: string | null) => void
  /** Sala de «Estudiar con amigos» en la que está (null = estudia por su cuenta). */
  room: RoomPayload | null
  setFocusMinutes: (minutes: number) => void
  setBreakMinutes: (minutes: number) => void
  /** Bloque de concentración por su cuenta (si estaba en una sala, sale de ella). */
  startFocus: (minutes?: number) => void
  startBreak: (minutes?: number) => void
  pause: () => void
  resume: () => void
  /** Termina el bloque (y sale de la sala, si está en una). Lo estudiado hasta ahora cuenta. */
  stop: () => void
  /** Crea una sala que empieza ahora y se une a ella. */
  createRoom: (focusMinutes: number, breakMinutes: number) => RoomPayload | null
  /** Responde al aviso estando en una sala: pasa a lo que esté haciendo la sala (descanso o estudio). */
  followRoom: () => void
}

const IDLE: TimerState = { phase: 'idle', status: 'paused', durationMs: 0, endsAt: null, remainingMs: 0 }

const TimerContext = createContext<TimerContextValue | null>(null)
/** El tiempo restante va aparte: cambia 4 veces por segundo y así solo se repinta lo que lo muestra. */
const RemainingContext = createContext(0)

function findTask(taskId: string | null | undefined): Task | undefined {
  const tasks = tasksStore.get()
  return taskId && Array.isArray(tasks) ? tasks.find((t) => t.id === taskId) : undefined
}

/** Asignatura a la que se apuntan los minutos: la de la tarea elegida, o «General». */
function blockSubject(state: TimerState): SubjectId {
  return findTask(state.taskId)?.subject ?? state.taskSubject ?? 'general'
}

/** La tarea elegida solo pasa a un nuevo bloque de estudio si sigue pendiente (no tachada ni borrada). */
function pendingTask(s: TimerState): Pick<TimerState, 'taskId' | 'taskSubject'> {
  const task = findTask(s.taskId)
  return task && !task.done ? { taskId: task.id, taskSubject: s.taskSubject ?? task.subject } : { taskId: null, taskSubject: null }
}

/** Vuelve a reposo, pero recuerda la tarea elegida para el siguiente bloque. */
function idleKeepingTask(s: TimerState): TimerState {
  return { ...IDLE, taskId: s.taskId ?? null, taskSubject: s.taskSubject ?? null }
}

/** Minutos estudiados de un bloque por su cuenta que aún no ha terminado. */
function soloStudiedMinutes(s: TimerState, now: number): number {
  if (s.phase !== 'focus' || s.status === 'finished') return 0
  const left = s.endsAt !== null ? s.endsAt - now : s.remainingMs
  return Math.floor((s.durationMs - Math.max(0, left)) / 60000)
}

type JoinResult = 'joined' | 'same' | 'ended'

export function TimerProvider({ children }: { children: ReactNode }) {
  const toast = useToast()
  const [solo, setSolo] = usePersistentState<TimerState>('timer', IDLE)
  const [settings, setSettings] = usePersistentState<TimerSettings>('timer-settings', {
    focusMinutes: 30,
    breakMinutes: 5,
  })
  const [rawRoom] = useStore(roomStore)
  const active = useMemo(() => sanitizeActiveRoom(rawRoom), [rawRoom])
  const inRoom = active !== null
  const progress = useProgress()
  const [now, setNow] = useState(() => Date.now())

  // Datos de la sala rotos o editados a mano: se descartan.
  useEffect(() => {
    if (rawRoom !== null && !active) roomStore.set(null)
  }, [rawRoom, active])

  const soloRunning = solo.status === 'running' && solo.endsAt !== null
  const ticking = soloRunning || inRoom
  useEffect(() => {
    if (!ticking) return
    const id = window.setInterval(() => setNow(Date.now()), 250)
    return () => window.clearInterval(id)
  }, [ticking])

  const soloRemainingMs = soloRunning ? Math.max(0, (solo.endsAt ?? 0) - now) : solo.remainingMs
  // En una sala, el reloj sale del horario compartido; si no, del bloque propio.
  const view = active
    ? roomView(active, now)
    : { phase: solo.phase, status: solo.status, durationMs: solo.durationMs, remainingMs: soloRemainingMs }
  const remainingMs = view.remainingMs

  // Bloque propio que llega a cero: suena, avisa y queda esperando la respuesta "¿descansar o seguir?".
  const handledEnd = useRef<number | null>(null)
  useEffect(() => {
    if (inRoom || !soloRunning || soloRemainingMs > 0 || handledEnd.current === solo.endsAt) return
    handledEnd.current = solo.endsAt
    setSolo((s) => ({ ...s, status: 'finished', endsAt: null, remainingMs: 0 }))
    playChime()
    if (solo.phase === 'focus') {
      recordStudy(Math.round(solo.durationMs / 60000), blockSubject(solo), 1, solo.endsAt ?? Date.now())
      notify('¡Bloque completado!', '¿Quieres descansar o seguir?')
    } else {
      notify('Se acabó el descanso', '¿Volvemos al estudio?')
    }
  }, [inRoom, soloRunning, soloRemainingMs, solo, setSolo])

  /**
   * En una sala: si terminó la fase en la que estaba, suena, avisa y apunta lo estudiado.
   * Lee el valor guardado en el momento (no el de este render) para no apuntar dos veces.
   */
  const settleRoom = useCallback(() => {
    const current = sanitizeActiveRoom(readFreshRoom())
    if (!current) return
    const { next, ended, over } = settleRoomState(current, Date.now())
    if (ended) {
      roomStore.set(next)
      playChime()
      if (ended.phase === 'focus') {
        recordStudy(Math.round(ended.studiedMs / 60000), blockSubject(solo), ended.completed ? 1 : 0, ended.endedAt)
        notify('¡Bloque completado!', '¿Descansas con la sala o sigues?')
      } else {
        notify('Se acabó el descanso', 'La sala vuelve a estudiar.')
      }
    }
    if (over) {
      roomStore.set(null)
      clearRoomFromAddress()
      toast('La sala ha terminado. ¡Buen trabajo!')
    }
  }, [solo, toast])

  useEffect(() => {
    if (inRoom) settleRoom()
  }, [inRoom, now, settleRoom])

  /** Sale de la sala; lo estudiado en el bloque en curso cuenta. Devuelve false si no estaba en ninguna. */
  const leaveRoom = useCallback((): boolean => {
    if (!sanitizeActiveRoom(roomStore.get())) return false
    settleRoom()
    const current = sanitizeActiveRoom(roomStore.get())
    if (current) {
      const studied = Math.floor(studiedOnLeave(current, Date.now()) / 60000)
      if (studied > 0) recordStudy(studied, blockSubject(solo), 0)
    }
    roomStore.set(null)
    clearRoomFromAddress()
    return true
  }, [settleRoom, solo])

  const joinRoom = useCallback(
    (room: RoomPayload): JoinResult => {
      const current = sanitizeActiveRoom(roomStore.get())
      if (current && sameRoom(current.room, room)) return 'same'
      const t = Date.now()
      const next = joinRoomState(room, t)
      if (!next) return 'ended'
      if (current) leaveRoom()
      else {
        const studied = soloStudiedMinutes(solo, t)
        if (studied > 0) recordStudy(studied, blockSubject(solo), 0)
      }
      setSolo((s) => ({ ...IDLE, ...pendingTask(s) }))
      roomStore.set(next)
      showRoomInAddress(room)
      setNow(t)
      return 'joined'
    },
    [leaveRoom, solo, setSolo],
  )

  // Abrir un enlace de sala (al cargar o al pegarlo en la barra de direcciones) te une a ella.
  const joinRef = useRef(joinRoom)
  useEffect(() => {
    joinRef.current = joinRoom
  }, [joinRoom])
  useEffect(() => {
    const check = () => {
      const parsed = readRoomHash(window.location.hash)
      if (parsed === null) return
      if (parsed === 'invalid') {
        clearRoomFromAddress()
        toast('Ese enlace de sala no funciona. Pide que te lo vuelvan a enviar.')
        return
      }
      const result = joinRef.current(parsed)
      if (result === 'joined') toast('Te has unido a la sala: todos veis el mismo reloj.')
      else if (result === 'ended') {
        clearRoomFromAddress()
        toast('Esa sala ya ha terminado.')
      }
    }
    check()
    window.addEventListener('hashchange', check)
    return () => window.removeEventListener('hashchange', check)
  }, [toast])

  // Al entrar por enlace no ha habido clic: el sonido y el permiso de avisos se piden con el primer toque.
  useEffect(() => {
    if (!inRoom) return
    const prime = () => {
      primeAudio()
      requestNotificationPermission()
    }
    window.addEventListener('pointerdown', prime, { once: true })
    return () => window.removeEventListener('pointerdown', prime)
  }, [inRoom])

  // El modo foco solo dura lo que dura el bloque de concentración.
  const inFocusBlock = view.phase === 'focus' && view.status !== 'finished'
  useEffect(() => {
    if (!inFocusBlock) setFocusMode(false)
  }, [inFocusBlock])

  // El tiempo restante también se ve en el título de la pestaña.
  useEffect(() => {
    if (view.phase === 'idle') document.title = 'LockIn'
    else if (view.status === 'finished') document.title = '⏰ ¿Descansar o seguir? · LockIn'
    else {
      const label = view.phase === 'focus' ? 'Estudiando' : 'Descanso'
      document.title = `${formatClock(remainingMs)} ${label}${inRoom ? ' en sala' : ''} · LockIn`
    }
  }, [view.phase, view.status, remainingMs, inRoom])

  const begin = useCallback(
    (phase: Exclude<TimerPhase, 'idle'>, minutes: number) => {
      primeAudio()
      requestNotificationPermission()
      leaveRoom()
      const t = Date.now()
      const durationMs = minutes * 60000
      setNow(t)
      setSolo((s) => ({
        phase,
        status: 'running',
        durationMs,
        endsAt: t + durationMs,
        remainingMs: durationMs,
        // Una tarea ya tachada (o borrada) no pasa al siguiente bloque de estudio.
        ...(phase === 'focus' ? pendingTask(s) : { taskId: s.taskId ?? null, taskSubject: s.taskSubject ?? null }),
      }))
    },
    [leaveRoom, setSolo],
  )

  const startFocus = useCallback(
    (minutes?: number) => begin('focus', clampFocusMinutes(minutes ?? settings.focusMinutes)),
    [begin, settings.focusMinutes],
  )

  const startBreak = useCallback(
    (minutes?: number) => begin('break', clampBreakMinutes(minutes ?? settings.breakMinutes)),
    [begin, settings.breakMinutes],
  )

  // En una sala no se puede pausar: el reloj es el mismo para todos.
  const pause = useCallback(() => {
    if (roomStore.get()) return
    setSolo((s) =>
      s.status === 'running' && s.endsAt !== null
        ? { ...s, status: 'paused', remainingMs: Math.max(0, s.endsAt - Date.now()), endsAt: null }
        : s,
    )
  }, [setSolo])

  const resume = useCallback(() => {
    if (roomStore.get()) return
    const t = Date.now()
    setNow(t)
    setSolo((s) => (s.status === 'paused' && s.phase !== 'idle' ? { ...s, status: 'running', endsAt: t + s.remainingMs } : s))
  }, [setSolo])

  const stop = useCallback(() => {
    // Lo estudiado antes de parar también cuenta en el resumen del día.
    if (!leaveRoom()) {
      const studied = soloStudiedMinutes(solo, Date.now())
      if (studied > 0) recordStudy(studied, blockSubject(solo), 0)
    }
    setSolo(idleKeepingTask)
  }, [leaveRoom, solo, setSolo])

  const setTaskId = useCallback(
    (id: string | null) => {
      const task = findTask(id)
      setSolo((s) => ({ ...s, taskId: task ? task.id : null, taskSubject: task ? task.subject : null }))
    },
    [setSolo],
  )

  const createRoom = useCallback(
    (focusMinutes: number, breakMinutes: number) => {
      primeAudio()
      requestNotificationPermission()
      const room = makeRoom(Date.now(), clampFocusMinutes(focusMinutes), clampBreakMinutes(breakMinutes))
      if (room) joinRoom(room)
      return room
    },
    [joinRoom],
  )

  const followRoom = useCallback(() => {
    primeAudio()
    settleRoom()
    const current = sanitizeActiveRoom(roomStore.get())
    if (!current) return
    const t = Date.now()
    roomStore.set(ackRoomState(current, t))
    setNow(t)
  }, [settleRoom])

  const setFocusMinutes = useCallback(
    (minutes: number) => setSettings((s) => ({ ...s, focusMinutes: minutes })),
    [setSettings],
  )
  const setBreakMinutes = useCallback(
    (minutes: number) => setSettings((s) => ({ ...s, breakMinutes: clampBreakMinutes(minutes) })),
    [setSettings],
  )

  const dateKey = todayKey()
  const todayProgress = progress.days[dateKey]
  const today = useMemo<DayStats>(
    () => ({ date: dateKey, blocks: todayProgress?.blocks ?? 0, minutes: todayProgress?.minutes ?? 0 }),
    [dateKey, todayProgress],
  )

  const room = active?.room ?? null
  const taskId = solo.taskId ?? null
  const value = useMemo<TimerContextValue>(
    () => ({
      phase: view.phase,
      status: view.status,
      durationMs: view.durationMs,
      settings,
      today,
      taskId,
      setTaskId,
      room,
      setFocusMinutes,
      setBreakMinutes,
      startFocus,
      startBreak,
      pause,
      resume,
      stop,
      createRoom,
      followRoom,
    }),
    [
      view.phase,
      view.status,
      view.durationMs,
      settings,
      today,
      taskId,
      setTaskId,
      room,
      setFocusMinutes,
      setBreakMinutes,
      startFocus,
      startBreak,
      pause,
      resume,
      stop,
      createRoom,
      followRoom,
    ],
  )

  return (
    <TimerContext.Provider value={value}>
      <RemainingContext.Provider value={remainingMs}>{children}</RemainingContext.Provider>
    </TimerContext.Provider>
  )
}

// oxlint-disable-next-line react/only-export-components
export function useTimer(): TimerContextValue {
  const ctx = useContext(TimerContext)
  if (!ctx) throw new Error('useTimer debe usarse dentro de <TimerProvider>')
  return ctx
}

// oxlint-disable-next-line react/only-export-components
export function useRemainingMs(): number {
  return useContext(RemainingContext)
}
