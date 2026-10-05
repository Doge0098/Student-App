import { BookOpen, Coffee, LogOut, PartyPopper } from 'lucide-react'
import { useState } from 'react'
import { Modal } from '../../components/Modal'
import { BREAK_OPTIONS, clampFocusMinutes } from '../../lib/time'
import { useTasks, type Task } from '../tasks/store'
import { useTimer } from './TimerContext'
import './timer.css'

/** Aparece al acabar cada bloque: "¿Quieres descansar o seguir?" */
export function TimerPrompt() {
  const timer = useTimer()
  const { phase, status, durationMs, settings, room } = timer
  const { tasks, update } = useTasks()
  const [breakMinutes, setBreakMinutes] = useState<number>(settings.breakMinutes)
  const focusMinutes = clampFocusMinutes(settings.focusMinutes)

  const open = status === 'finished' && phase !== 'idle'
  const afterFocus = phase === 'focus'
  const task = afterFocus && timer.taskId ? tasks.find((t) => t.id === timer.taskId) : undefined

  return (
    <Modal
      open={open}
      title={afterFocus ? `¡${Math.round(durationMs / 60000)} minutos completados!` : 'Se acabó el descanso'}
      icon={afterFocus ? <PartyPopper size={28} /> : <BookOpen size={28} />}
    >
      {afterFocus ? (
        <>
          <p className="modal-text">Buen trabajo. ¿Quieres descansar o seguir?</p>
          {task && <TaskDoneCheck task={task} onChange={(done) => update(task.id, { done })} />}
          {room ? (
            // En una sala el descanso lo marca la sala: todos descansan a la vez.
            <div className="modal-actions">
              <button type="button" className="btn btn-primary" data-autofocus onClick={timer.followRoom}>
                <Coffee size={18} /> Descansar con la sala
              </button>
              <button type="button" className="btn" onClick={() => timer.startFocus()}>
                <BookOpen size={18} /> Seguir {focusMinutes} min por mi cuenta
              </button>
            </div>
          ) : (
            <>
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
          )}
        </>
      ) : room ? (
        <>
          <p className="modal-text">La sala vuelve a estudiar. ¿Seguimos?</p>
          <div className="modal-actions">
            <button type="button" className="btn btn-primary" data-autofocus onClick={timer.followRoom}>
              <BookOpen size={18} /> Seguir con la sala
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
        <LogOut size={16} /> {room ? 'Salir de la sala' : 'Terminar por hoy'}
      </button>
    </Modal>
  )
}

/** «¿Has terminado esta tarea?» con una casilla para tacharla al momento (y destacharla si fue sin querer). */
function TaskDoneCheck({ task, onChange }: { task: Task; onChange: (done: boolean) => void }) {
  return (
    <fieldset className="prompt-task">
      <legend className="prompt-task-question">¿Has terminado esta tarea?</legend>
      <label className="prompt-task-row">
        <input type="checkbox" checked={task.done} onChange={(e) => onChange(e.target.checked)} />
        <span className={`prompt-task-text ${task.done ? 'is-done' : ''}`}>{task.text}</span>
      </label>
    </fieldset>
  )
}
