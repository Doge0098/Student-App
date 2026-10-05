import { ChartColumn, Flame, Minus, Pause, Play, Plus, Square, Target, Timer } from 'lucide-react'
import { useState } from 'react'
import { Panel } from '../../components/Panel'
import { MAX_FOCUS_MINUTES, MIN_FOCUS_MINUTES, clampFocusMinutes, formatClock } from '../../lib/time'
import { FocusModeButton } from '../focus/FocusModeButton'
import { ProgressDialog } from '../progress/ProgressDialog'
import { useProgress } from '../progress/store'
import { RoomBadge, RoomLeaveButton, RoomStartButton } from '../room/RoomControls'
import { useTasks } from '../tasks/store'
import { useRemainingMs, useTimer } from './TimerContext'
import './timer.css'

const STEP = 5

export function FocusTimer() {
  const timer = useTimer()
  const remainingMs = useRemainingMs()
  const { phase, status, settings, today, room } = timer
  const { tasks, pending } = useTasks()
  const progress = useProgress()
  const [showProgress, setShowProgress] = useState(false)

  const idle = phase === 'idle'
  const minutes = clampFocusMinutes(settings.focusMinutes)
  // El color del reloj indica el estado: concentración, descanso o pausa.
  const state = idle ? 'idle' : status === 'paused' ? 'paused' : phase
  const inFocusBlock = phase === 'focus' && status !== 'finished'
  const task = timer.taskId ? tasks.find((t) => t.id === timer.taskId) : undefined
  const chosen = task && !task.done ? task : undefined
  const hasHistory = Object.keys(progress.days).length > 0

  return (
    <Panel
      title="Concentración"
      icon={<Timer size={18} />}
      panel="timer"
      className="timer-panel"
      actions={inFocusBlock ? <FocusModeButton /> : undefined}
    >
      {room && <RoomBadge />}

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

      {inFocusBlock && chosen && (
        <p className="timer-task" title={chosen.text}>
          <Target size={14} aria-hidden="true" />
          <span className="timer-sr">Trabajando en: </span>
          <span className="timer-task-text">{chosen.text}</span>
        </p>
      )}

      {idle && pending.length > 0 && (
        <select
          className="timer-task-picker"
          aria-label="¿En qué vas a trabajar? (opcional)"
          value={chosen?.id ?? ''}
          onChange={(e) => timer.setTaskId(e.target.value || null)}
        >
          <option value="">¿En qué vas a trabajar? (opcional)</option>
          {pending.map((t) => (
            <option key={t.id} value={t.id}>
              {t.text}
            </option>
          ))}
        </select>
      )}

      {idle ? (
        <>
          <button type="button" className="btn btn-primary btn-block" onClick={() => timer.startFocus(minutes)}>
            <Play size={18} /> Empezar
          </button>
          <RoomStartButton focusMinutes={minutes} />
        </>
      ) : room ? (
        <RoomLeaveButton />
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

      {(today.minutes > 0 || hasHistory) && (
        <button
          type="button"
          className="timer-stats timer-stats-btn"
          aria-haspopup="dialog"
          title="Ver tu progreso"
          onClick={() => setShowProgress(true)}
        >
          {today.minutes > 0 ? (
            <>
              <Flame size={15} aria-hidden="true" />
              Hoy llevas <strong>{today.minutes} min</strong> de estudio
            </>
          ) : (
            <>
              <ChartColumn size={15} aria-hidden="true" className="timer-stats-chart" />
              Ver tu progreso
            </>
          )}
        </button>
      )}
      <ProgressDialog open={showProgress} onClose={() => setShowProgress(false)} />
    </Panel>
  )
}
