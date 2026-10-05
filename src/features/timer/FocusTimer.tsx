import { Flame, Minus, Pause, Play, Plus, Square, Timer } from 'lucide-react'
import { Panel } from '../../components/Panel'
import { MAX_FOCUS_MINUTES, MIN_FOCUS_MINUTES, clampFocusMinutes, formatClock } from '../../lib/time'
import { useRemainingMs, useTimer } from './TimerContext'

const STEP = 5

export function FocusTimer() {
  const timer = useTimer()
  const remainingMs = useRemainingMs()
  const { phase, status, settings, today } = timer

  const idle = phase === 'idle'
  const minutes = clampFocusMinutes(settings.focusMinutes)
  // El color del reloj indica el estado: concentración, descanso o pausa.
  const state = idle ? 'idle' : status === 'paused' ? 'paused' : phase

  return (
    <Panel title="Concentración" icon={<Timer size={18} />} panel="timer" className="timer-panel">
      <div className="timer-clock-row">
        {idle && (
          <button
            type="button"
            className="icon-btn stepper-btn"
            aria-label={`${STEP} minutos menos`}
            title={minutes <= MIN_FOCUS_MINUTES ? `Mínimo ${MIN_FOCUS_MINUTES} minutos` : undefined}
            disabled={minutes <= MIN_FOCUS_MINUTES}
            onClick={() => timer.setFocusMinutes(clampFocusMinutes(minutes - STEP))}
          >
            <Minus size={18} />
          </button>
        )}
        <span className="timer-clock" data-state={state} role="timer" aria-label={idle ? `${minutes} minutos` : undefined}>
          {formatClock(idle ? minutes * 60000 : remainingMs)}
        </span>
        {idle && (
          <button
            type="button"
            className="icon-btn stepper-btn"
            aria-label={`${STEP} minutos más`}
            disabled={minutes >= MAX_FOCUS_MINUTES}
            onClick={() => timer.setFocusMinutes(clampFocusMinutes(minutes + STEP))}
          >
            <Plus size={18} />
          </button>
        )}
      </div>

      {idle ? (
        <button type="button" className="btn btn-primary btn-block" onClick={() => timer.startFocus(minutes)}>
          <Play size={18} /> Empezar
        </button>
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
