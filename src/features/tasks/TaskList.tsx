import { CalendarDays, Check, ListTodo, Plus, Trash2, X } from 'lucide-react'
import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import { Panel } from '../../components/Panel'
import { SubjectPicker } from '../../components/SubjectPicker'
import { todayKey } from '../../lib/time'
import { useNow } from '../flashcards/useNow'
import { dueInfo, formatDueDate, isDateKey, sortPending } from './dates'
import { skipReminderToday, useDueReminders } from './reminders'
import { useTasks, type Task } from './store'
import './tasks.css'

export function TaskList() {
  const { tasks, pending, add: addTask, update, remove, clearDone } = useTasks()
  const [text, setText] = useState('')
  // Fecha y «es un examen» al apuntar: ocultos tras el botón del calendario para que la fila siga siendo simple.
  const [showExtra, setShowExtra] = useState(false)
  const [due, setDue] = useState('')
  const [isExam, setIsExam] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const dateInput = useRef<HTMLInputElement>(null)

  useDueReminders()

  // Se refresca cada minuto: si la app sigue abierta al cambiar el día, «Mañana» pasa a «Hoy».
  const now = useNow()
  const today = todayKey(new Date(now))
  const done = tasks.filter((t) => t.done)
  const sorted = sortPending(pending)

  useEffect(() => {
    if (showExtra) dateInput.current?.focus()
  }, [showExtra])

  const add = (e: FormEvent) => {
    e.preventDefault()
    const extra: Partial<Pick<Task, 'due' | 'kind'>> = {}
    if (showExtra && isDateKey(due)) extra.due = due
    if (showExtra && isExam) extra.kind = 'examen'
    const task = addTask(text, extra)
    if (!task) return
    skipReminderToday(task)
    setText('')
    setDue('')
    setIsExam(false)
    setShowExtra(false)
  }

  /** Al cerrar el editor de fecha, el foco vuelve a la tarea (que puede haber cambiado de sitio). */
  const closeEditor = (id: string) => {
    setEditingId(null)
    requestAnimationFrame(() => document.getElementById(`task-${id}`)?.focus())
  }

  const saveDue = (task: Task, patch: Pick<Task, 'due' | 'kind'>) => {
    update(task.id, patch)
    skipReminderToday({ id: task.id, due: patch.due })
    closeEditor(task.id)
  }

  const renderTask = (task: Task) => {
    const info = task.done ? null : dueInfo(task, today)
    const editing = editingId === task.id && !task.done
    return (
      <li key={task.id} className={`task ${task.done ? 'is-done' : ''}`}>
        <input
          id={`task-${task.id}`}
          type="checkbox"
          checked={task.done}
          onChange={() => update(task.id, { done: !task.done })}
        />
        <div className="task-body">
          <label htmlFor={`task-${task.id}`} className="task-text">
            {task.text}
          </label>
          {!task.done && (
            <div className="task-tags">
              <SubjectPicker value={task.subject} onChange={(subject) => update(task.id, { subject })} />
              {info && (
                <button
                  type="button"
                  className="task-due"
                  data-tone={info.tone}
                  aria-expanded={editing}
                  title={task.due ? `${formatDueDate(task.due)} · Cambiar fecha` : 'Poner fecha'}
                  onClick={() => setEditingId(editing ? null : task.id)}
                >
                  {info.label}
                </button>
              )}
            </div>
          )}
          {editing && (
            <DueEditor key={task.id} task={task} onSave={(patch) => saveDue(task, patch)} onCancel={() => closeEditor(task.id)} />
          )}
        </div>
        <div className="task-actions">
          {!task.done && !info && (
            <button
              type="button"
              className="icon-btn"
              aria-label={`Poner fecha a "${task.text}"`}
              aria-expanded={editing}
              title="Poner fecha"
              onClick={() => setEditingId(editing ? null : task.id)}
            >
              <CalendarDays size={15} />
            </button>
          )}
          <button type="button" className="icon-btn" aria-label={`Borrar "${task.text}"`} title="Borrar" onClick={() => remove(task.id)}>
            <X size={16} />
          </button>
        </div>
      </li>
    )
  }

  return (
    <Panel
      title="Tareas"
      panel="tasks"
      icon={<ListTodo size={18} />}
      className="tasks-panel"
      actions={pending.length > 0 && <span className="badge">{pending.length}</span>}
    >
      <form className="task-add" onSubmit={add}>
        <div className="input-row">
          <input
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={showExtra && isExam ? '¿De qué es el examen?' : 'Añadir tarea…'}
            aria-label="Nueva tarea"
            maxLength={200}
          />
          <button
            type="button"
            className={`icon-btn task-date-toggle ${showExtra ? 'is-on' : ''}`}
            aria-label="Fecha o examen"
            title="Fecha o examen"
            aria-expanded={showExtra}
            aria-controls="task-add-extra"
            onClick={() => setShowExtra((v) => !v)}
          >
            <CalendarDays size={18} />
          </button>
          <button type="submit" className="btn btn-primary btn-icon" aria-label="Añadir tarea" disabled={!text.trim()}>
            <Plus size={18} />
          </button>
        </div>
        {showExtra && (
          <div className="task-extra" id="task-add-extra">
            <input
              ref={dateInput}
              type="date"
              className="task-date-input"
              value={due}
              onChange={(e) => setDue(e.target.value)}
              aria-label="Fecha de entrega o del examen"
            />
            <label className="task-exam-toggle">
              <input type="checkbox" checked={isExam} onChange={(e) => setIsExam(e.target.checked)} />
              Es un examen
            </label>
          </div>
        )}
      </form>

      {tasks.length === 0 && <p className="empty">Apunta lo que tienes que hacer y táchalo al terminar.</p>}
      {tasks.length > 0 && pending.length === 0 && <p className="empty">¡Todo hecho! 🎉</p>}
      {sorted.length > 0 && <ul className="task-list">{sorted.map(renderTask)}</ul>}

      {done.length > 0 && (
        <details className="done-tasks">
          <summary>Hechas ({done.length})</summary>
          <ul className="task-list">{done.map(renderTask)}</ul>
          <button type="button" className="btn btn-link" onClick={clearDone}>
            <Trash2 size={14} /> Borrar las hechas
          </button>
        </details>
      )}
    </Panel>
  )
}

interface DueEditorProps {
  task: Task
  onSave: (patch: Pick<Task, 'due' | 'kind'>) => void
  onCancel: () => void
}

/** Cambiar la fecha de una tarea ya apuntada: fecha, «examen» y quitar fecha. */
function DueEditor({ task, onSave, onCancel }: DueEditorProps) {
  const [due, setDue] = useState(task.due ?? '')
  const [exam, setExam] = useState(task.kind === 'examen')
  const input = useRef<HTMLInputElement>(null)

  useEffect(() => {
    input.current?.focus()
  }, [])

  const save = () => onSave({ due: isDateKey(due) ? due : undefined, kind: exam ? 'examen' : undefined })

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.stopPropagation()
      onCancel()
    } else if (e.key === 'Enter' && e.target instanceof HTMLInputElement) {
      e.preventDefault()
      save()
    }
  }

  return (
    <div className="task-extra task-extra-edit" role="group" aria-label="Fecha de la tarea" onKeyDown={onKeyDown}>
      <input
        ref={input}
        type="date"
        className="task-date-input"
        value={due}
        onChange={(e) => setDue(e.target.value)}
        aria-label="Fecha de entrega o del examen"
      />
      <label className="task-exam-toggle">
        <input type="checkbox" checked={exam} onChange={(e) => setExam(e.target.checked)} />
        Examen
      </label>
      {task.due && (
        <button type="button" className="task-extra-link" onClick={() => onSave({ due: undefined, kind: task.kind })}>
          Quitar fecha
        </button>
      )}
      <button type="button" className="task-extra-save" aria-label="Guardar fecha" title="Guardar" onClick={save}>
        <Check size={15} />
      </button>
    </div>
  )
}
