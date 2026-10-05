import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { usePersistentState } from '../../hooks/usePersistentState'
import { notify, playChime, primeAudio, requestNotificationPermission } from '../../lib/alerts'
import { clampBreakMinutes, clampFocusMinutes, formatClock, todayKey } from '../../lib/time'

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
  remainingMs: number
  settings: TimerSettings
  today: DayStats
  setFocusMinutes: (minutes: number) => void
  setBreakMinutes: (minutes: number) => void
  startFocus: (minutes?: number) => void
  startBreak: (minutes?: number) => void
  pause: () => void
  resume: () => void
  stop: () => void
}

const IDLE: TimerState = { phase: 'idle', status: 'paused', durationMs: 0, endsAt: null, remainingMs: 0 }

const TimerContext = createContext<TimerContextValue | null>(null)

function addFocusMinutes(prev: DayStats, minutes: number, blocks: number): DayStats {
  const date = todayKey()
  const base = prev.date === date ? prev : { date, blocks: 0, minutes: 0 }
  return { date, blocks: base.blocks + blocks, minutes: base.minutes + minutes }
}

export function TimerProvider({ children }: { children: ReactNode }) {
  const [state, setState] = usePersistentState<TimerState>('timer', IDLE)
  const [settings, setSettings] = usePersistentState<TimerSettings>('timer-settings', {
    focusMinutes: 30,
    breakMinutes: 5,
  })
  const [stats, setStats] = usePersistentState<DayStats>('timer-stats', { date: todayKey(), blocks: 0, minutes: 0 })
  const [now, setNow] = useState(() => Date.now())

  const running = state.status === 'running' && state.endsAt !== null
  useEffect(() => {
    if (!running) return
    const id = window.setInterval(() => setNow(Date.now()), 250)
    return () => window.clearInterval(id)
  }, [running])

  const remainingMs = running ? Math.max(0, (state.endsAt ?? 0) - now) : state.remainingMs

  // Al llegar a cero: suena, avisa y queda esperando la respuesta "¿descansar o seguir?".
  const handledEnd = useRef<number | null>(null)
  useEffect(() => {
    if (!running || remainingMs > 0 || handledEnd.current === state.endsAt) return
    handledEnd.current = state.endsAt
    setState((s) => ({ ...s, status: 'finished', endsAt: null, remainingMs: 0 }))
    playChime()
    if (state.phase === 'focus') {
      setStats((prev) => addFocusMinutes(prev, Math.round(state.durationMs / 60000), 1))
      notify('¡Bloque completado!', '¿Quieres descansar o seguir?')
    } else {
      notify('Se acabó el descanso', '¿Volvemos al estudio?')
    }
  }, [running, remainingMs, state.endsAt, state.phase, state.durationMs, setState, setStats])

  // El tiempo restante también se ve en el título de la pestaña.
  useEffect(() => {
    if (state.phase === 'idle') document.title = 'Student App'
    else if (state.status === 'finished') document.title = '⏰ ¿Descansar o seguir? · Student App'
    else {
      const label = state.phase === 'focus' ? 'Estudiando' : 'Descanso'
      document.title = `${formatClock(remainingMs)} ${label} · Student App`
    }
  }, [state.phase, state.status, remainingMs])

  const begin = useCallback(
    (phase: Exclude<TimerPhase, 'idle'>, minutes: number) => {
      primeAudio()
      requestNotificationPermission()
      const t = Date.now()
      const durationMs = minutes * 60000
      setNow(t)
      setState({ phase, status: 'running', durationMs, endsAt: t + durationMs, remainingMs: durationMs })
    },
    [setState],
  )

  const startFocus = useCallback(
    (minutes?: number) => begin('focus', clampFocusMinutes(minutes ?? settings.focusMinutes)),
    [begin, settings.focusMinutes],
  )

  const startBreak = useCallback(
    (minutes?: number) => begin('break', clampBreakMinutes(minutes ?? settings.breakMinutes)),
    [begin, settings.breakMinutes],
  )

  const pause = useCallback(() => {
    setState((s) =>
      s.status === 'running' && s.endsAt !== null
        ? { ...s, status: 'paused', remainingMs: Math.max(0, s.endsAt - Date.now()), endsAt: null }
        : s,
    )
  }, [setState])

  const resume = useCallback(() => {
    const t = Date.now()
    setNow(t)
    setState((s) => (s.status === 'paused' && s.phase !== 'idle' ? { ...s, status: 'running', endsAt: t + s.remainingMs } : s))
  }, [setState])

  const stop = useCallback(() => {
    // Lo estudiado antes de parar también cuenta en el resumen del día.
    if (state.phase === 'focus' && state.status !== 'finished') {
      const left = state.endsAt !== null ? state.endsAt - Date.now() : state.remainingMs
      const studied = Math.floor((state.durationMs - Math.max(0, left)) / 60000)
      if (studied > 0) setStats((prev) => addFocusMinutes(prev, studied, 0))
    }
    setState(IDLE)
  }, [state, setState, setStats])

  const setFocusMinutes = useCallback(
    (minutes: number) => setSettings((s) => ({ ...s, focusMinutes: minutes })),
    [setSettings],
  )
  const setBreakMinutes = useCallback(
    (minutes: number) => setSettings((s) => ({ ...s, breakMinutes: clampBreakMinutes(minutes) })),
    [setSettings],
  )

  const dateKey = todayKey()
  const today = useMemo(
    () => (stats.date === dateKey ? stats : { date: dateKey, blocks: 0, minutes: 0 }),
    [stats, dateKey],
  )

  const value = useMemo<TimerContextValue>(
    () => ({
      phase: state.phase,
      status: state.status,
      durationMs: state.durationMs,
      remainingMs,
      settings,
      today,
      setFocusMinutes,
      setBreakMinutes,
      startFocus,
      startBreak,
      pause,
      resume,
      stop,
    }),
    [state.phase, state.status, state.durationMs, remainingMs, settings, today, setFocusMinutes, setBreakMinutes, startFocus, startBreak, pause, resume, stop],
  )

  return <TimerContext.Provider value={value}>{children}</TimerContext.Provider>
}

// oxlint-disable-next-line react/only-export-components
export function useTimer(): TimerContextValue {
  const ctx = useContext(TimerContext)
  if (!ctx) throw new Error('useTimer debe usarse dentro de <TimerProvider>')
  return ctx
}
