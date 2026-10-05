import { BookOpen, Coffee, LogOut, PartyPopper } from 'lucide-react'
import { useState } from 'react'
import { Modal } from '../../components/Modal'
import { BREAK_OPTIONS, clampFocusMinutes } from '../../lib/time'
import { useTimer } from './TimerContext'

/** Aparece al acabar cada bloque: "¿Quieres descansar o seguir?" */
export function TimerPrompt() {
  const timer = useTimer()
  const { phase, status, durationMs, settings } = timer
  const [breakMinutes, setBreakMinutes] = useState<number>(settings.breakMinutes)
  const focusMinutes = clampFocusMinutes(settings.focusMinutes)

  const open = status === 'finished' && phase !== 'idle'
  const afterFocus = phase === 'focus'

  return (
    <Modal
      open={open}
      title={afterFocus ? `¡${Math.round(durationMs / 60000)} minutos completados!` : 'Se acabó el descanso'}
      icon={afterFocus ? <PartyPopper size={28} /> : <BookOpen size={28} />}
    >
      {afterFocus ? (
        <>
          <p className="modal-text">Buen trabajo. ¿Quieres descansar o seguir?</p>
          <div className="chip-row chip-row-center" role="group" aria-label="Duración del descanso">
            {BREAK_OPTIONS.map((m) => (
              <button
                key={m}
                type="button"
                className={`chip ${breakMinutes === m ? 'is-active' : ''}`}
                aria-pressed={breakMinutes === m}
                onClick={() => {
                  setBreakMinutes(m)
                  timer.setBreakMinutes(m)
                }}
              >
                {m} min
              </button>
            ))}
          </div>
          <div className="modal-actions">
            <button type="button" className="btn btn-primary" data-autofocus onClick={() => timer.startBreak(breakMinutes)}>
              <Coffee size={18} /> Descansar {breakMinutes} min
            </button>
            <button type="button" className="btn" onClick={() => timer.startFocus()}>
              <BookOpen size={18} /> Seguir {focusMinutes} min más
            </button>
          </div>
        </>
      ) : (
        <>
          <p className="modal-text">Levántate, bebe agua y… ¿volvemos?</p>
          <div className="modal-actions">
            <button type="button" className="btn btn-primary" data-autofocus onClick={() => timer.startFocus()}>
              <BookOpen size={18} /> Seguir estudiando ({focusMinutes} min)
            </button>
            <button type="button" className="btn" onClick={() => timer.startBreak(5)}>
              <Coffee size={18} /> 5 min más de descanso
            </button>
          </div>
        </>
      )}
      <button type="button" className="btn btn-link" onClick={timer.stop}>
        <LogOut size={16} /> Terminar por hoy
      </button>
    </Modal>
  )
}
