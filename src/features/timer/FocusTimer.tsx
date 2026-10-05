import { Coffee, Flame, Pause, Play, Square, Timer } from 'lucide-react'
import { useState } from 'react'
import { Panel } from '../../components/Panel'
import { BREAK_OPTIONS, MAX_FOCUS_MINUTES, MIN_FOCUS_MINUTES, clampFocusMinutes, formatClock } from '../../lib/time'
import { useRemainingMs, useTimer } from './TimerContext'

const FOCUS_PRESETS = [30, 45, 60, 90]
const RADIUS = 54
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

export function FocusTimer() {
  const timer = useTimer()
  const remainingMs = useRemainingMs()
  const { phase, status, durationMs, settings, today } = timer
  const [draft, setDraft] = useState(String(settings.focusMinutes))

  const idle = phase === 'idle'
  const shownMs = idle ? clampFocusMinutes(settings.focusMinutes) * 60000 : remainingMs
  const progress = idle || durationMs === 0 ? 0 : 1 - remainingMs / durationMs
  const label = idle ? 'Listo para empezar' : phase === 'focus' ? 'Concentración' : 'Descanso'

  const commitDraft = () => {
    const minutes = clampFocusMinutes(Number(draft))
    timer.setFocusMinutes(minutes)
    setDraft(String(minutes))
    return minutes
  }

  const choosePreset = (minutes: number) => {
    timer.setFocusMinutes(minutes)
    setDraft(String(minutes))
  }

  return (
    <Panel title="Temporizador" icon={<Timer size={18} />} panel="timer" className={`timer-panel phase-${phase}`}>
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
          <span className="timer-time" aria-live="off">
            {formatClock(shownMs)}
          </span>
          <span className="timer-label">
            {status === 'paused' && !idle ? 'En pausa' : label}
          </span>
        </div>
      </div>

      {idle && (
        <div className="timer-setup">
          <div className="field-label" id="focus-length-label">
            ¿Cuánto quieres concentrarte?
          </div>
          <div className="chip-row" role="group" aria-labelledby="focus-length-label">
            {FOCUS_PRESETS.map((m) => (
              <button
                key={m}
                type="button"
                className={`chip ${settings.focusMinutes === m ? 'is-active' : ''}`}
                aria-pressed={settings.focusMinutes === m}
                onClick={() => choosePreset(m)}
              >
                {m} min
              </button>
            ))}
            <label className="chip chip-input">
              <input
                type="number"
                inputMode="numeric"
                min={MIN_FOCUS_MINUTES}
                max={MAX_FOCUS_MINUTES}
                step={5}
                value={draft}
                aria-label="Minutos personalizados"
                onChange={(e) => setDraft(e.target.value)}
                onBlur={commitDraft}
                onKeyDown={(e) => e.key === 'Enter' && commitDraft()}
              />
              min
            </label>
          </div>
          <p className="hint">Mínimo {MIN_FOCUS_MINUTES} minutos. Al terminar te preguntaré si quieres descansar o seguir.</p>

          <label className="inline-field">
            <Coffee size={16} aria-hidden="true" />
            Descanso de
            <select
              value={settings.breakMinutes}
              onChange={(e) => timer.setBreakMinutes(Number(e.target.value))}
            >
              {BREAK_OPTIONS.map((m) => (
                <option key={m} value={m}>
                  {m} min
                </option>
              ))}
            </select>
          </label>
        </div>
      )}

      <div className="button-row">
        {idle && (
          <button
            type="button"
            className="btn btn-primary btn-wide"
            onClick={() => timer.startFocus(commitDraft())}
          >
            <Play size={18} /> Empezar a estudiar
          </button>
        )}
        {!idle && status === 'running' && (
          <button type="button" className="btn" onClick={timer.pause}>
            <Pause size={18} /> Pausar
          </button>
        )}
        {!idle && status === 'paused' && (
          <button type="button" className="btn btn-primary" onClick={timer.resume}>
            <Play size={18} /> Continuar
          </button>
        )}
        {!idle && (
          <button type="button" className="btn btn-ghost" onClick={timer.stop}>
            <Square size={16} /> Terminar
          </button>
        )}
      </div>

      <p className="timer-stats">
        <Flame size={16} aria-hidden="true" />
        Hoy: <strong>{today.blocks}</strong> {today.blocks === 1 ? 'bloque' : 'bloques'} ·{' '}
        <strong>{today.minutes}</strong> min de estudio
      </p>
    </Panel>
  )
}
