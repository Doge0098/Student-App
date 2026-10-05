import { Flame, Minus, Pause, Play, Plus, Square, Timer } from 'lucide-react'
import { Panel } from '../../components/Panel'
import { MAX_FOCUS_MINUTES, MIN_FOCUS_MINUTES, clampFocusMinutes, formatClock } from '../../lib/time'
import { useRemainingMs, useTimer } from './TimerContext'

const STEP = 5
const RADIUS = 54
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

export function FocusTimer() {
  const timer = useTimer()
  const remainingMs = useRemainingMs()
  const { phase, status, durationMs, settings, today } = timer

  const idle = phase === 'idle'
  const minutes = clampFocusMinutes(settings.focusMinutes)
  const progress = idle || durationMs === 0 ? 0 : 1 - remainingMs / durationMs
  const label = idle ? 'minutos' : status === 'paused' ? 'En pausa' : phase === 'focus' ? 'Concentración' : 'Descanso'

  return (
    <Panel title="Concentración" icon={<Timer size={18} />} panel="timer" className={`timer-panel phase-${phase}`}>
      <div className="timer-ring" data-phase={phase}>
        <svg viewBox="0 0 120 120" aria-hidden="true">
          <circle className="ring-track" cx="60" cy="60" r={RADIUS} />
          <circle
            className="ring-progress"
            cx="60"
            cy="60"
            r={RADIUS}
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={CIRCUMFERENCE * (1 - progress)}
          />
        </svg>
        <div className="timer-readout">
          <span className="timer-time">{idle ? minutes : formatClock(remainingMs)}</span>
          <span className="timer-label">{label}</span>
        </div>
      </div>

      {idle ? (
        <>
          <div className="stepper" role="group" aria-label="Duración">
            <button
              type="button"
              className="icon-btn"
              aria-label={`${STEP} minutos menos`}
              disabled={minutes <= MIN_FOCUS_MINUTES}
              onClick={() => timer.setFocusMinutes(clampFocusMinutes(minutes - STEP))}
            >
              <Minus size={18} />
            </button>
            <span className="stepper-hint">mínimo {MIN_FOCUS_MINUTES} min</span>
            <button
              type="button"
              className="icon-btn"
              aria-label={`${STEP} minutos más`}
              disabled={minutes >= MAX_FOCUS_MINUTES}
              onClick={() => timer.setFocusMinutes(clampFocusMinutes(minutes + STEP))}
            >
              <Plus size={18} />
            </button>
          </div>
          <button type="button" className="btn btn-primary btn-block" onClick={() => timer.startFocus(minutes)}>
            <Play size={18} /> Empezar
          </button>
        </>
      ) : (
        <div className="button-row">
          {status === 'running' ? (
            <button type="button" className="btn" onClick={timer.pause}>
              <Pause size={18} /> Pausar
            </button>
          ) : (
            <button type="button" className="btn btn-primary" onClick={timer.resume}>
              <Play size={18} /> Continuar
            </button>
          )}
          <button type="button" className="btn btn-ghost" onClick={timer.stop}>
            <Square size={16} /> Terminar
          </button>
        </div>
      )}

      {today.minutes > 0 && (
        <p className="timer-stats">
          <Flame size={15} aria-hidden="true" />
          Hoy llevas <strong>{today.minutes} min</strong> de estudio
        </p>
      )}
    </Panel>
  )
}
