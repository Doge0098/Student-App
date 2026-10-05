import { ListTodo, Plus, Trash2, X } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Panel } from '../../components/Panel'
import { SubjectPicker } from '../../components/SubjectPicker'
import { usePersistentState } from '../../hooks/usePersistentState'
import { detectSubject, type SubjectId } from '../../lib/subjects'
import { uid } from '../../lib/text'

interface Task {
  id: string
  text: string
  done: boolean
  subject: SubjectId
  createdAt: number
}

type Filter = 'pending' | 'done' | 'all'

const FILTERS: { id: Filter; label: string }[] = [
  { id: 'pending', label: 'Pendientes' },
  { id: 'done', label: 'Hechas' },
  { id: 'all', label: 'Todas' },
]

export function TaskList() {
  const [tasks, setTasks] = usePersistentState<Task[]>('tasks', [])
  const [filter, setFilter] = usePersistentState<Filter>('tasks-filter', 'pending')
  const [text, setText] = useState('')

  const pending = tasks.filter((t) => !t.done).length
  const doneCount = tasks.length - pending
  const visible = tasks.filter((t) => (filter === 'all' ? true : filter === 'done' ? t.done : !t.done))

  const add = (e: FormEvent) => {
    e.preventDefault()
    const value = text.trim()
    if (!value) return
    // La asignatura se adivina sola a partir del texto; se puede cambiar después.
    setTasks((prev) => [{ id: uid(), text: value, done: false, subject: detectSubject(value), createdAt: Date.now() }, ...prev])
    setText('')
  }

  const update = (id: string, patch: Partial<Task>) =>
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)))

  const remove = (id: string) => setTasks((prev) => prev.filter((t) => t.id !== id))

  return (
    <Panel
      title="Tareas"
      icon={<ListTodo size={18} />}
      className="tasks-panel"
      actions={<span className="badge">{pending} pendientes</span>}
    >
      <form className="input-row" onSubmit={add}>
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Ej.: Ejercicios de derivadas pág. 54"
          aria-label="Nueva tarea"
          maxLength={200}
        />
        <button type="submit" className="btn btn-primary btn-icon" aria-label="Añadir tarea" disabled={!text.trim()}>
          <Plus size={18} />
        </button>
      </form>

      <div className="segmented" role="tablist" aria-label="Filtrar tareas">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            role="tab"
            aria-selected={filter === f.id}
            className={filter === f.id ? 'is-active' : ''}
            onClick={() => setFilter(f.id)}
          >
            {f.label}
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <p className="empty">
          {tasks.length === 0
            ? 'Apunta lo que tienes que hacer hoy y táchalo al terminar.'
            : filter === 'pending'
              ? '¡Todo hecho! 🎉'
              : 'Aún no has tachado ninguna tarea.'}
        </p>
      ) : (
        <ul className="task-list">
          {visible.map((task) => (
            <li key={task.id} className={`task ${task.done ? 'is-done' : ''}`}>
              <label className="task-check">
                <input type="checkbox" checked={task.done} onChange={() => update(task.id, { done: !task.done })} />
                <span className="task-text">{task.text}</span>
              </label>
              <SubjectPicker value={task.subject} onChange={(subject) => update(task.id, { subject })} />
              <button
                type="button"
                className="icon-btn"
                aria-label={`Borrar "${task.text}"`}
                title="Borrar"
                onClick={() => remove(task.id)}
              >
                <X size={16} />
              </button>
            </li>
          ))}
        </ul>
      )}

      {doneCount > 0 && (
        <button type="button" className="btn btn-link" onClick={() => setTasks((prev) => prev.filter((t) => !t.done))}>
          <Trash2 size={14} /> Borrar las {doneCount} hechas
        </button>
      )}
    </Panel>
  )
}
