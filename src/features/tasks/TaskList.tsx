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

export function TaskList() {
  const [tasks, setTasks] = usePersistentState<Task[]>('tasks', [])
  const [text, setText] = useState('')

  const pending = tasks.filter((t) => !t.done)
  const done = tasks.filter((t) => t.done)

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

  const renderTask = (task: Task) => (
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
        {!task.done && <SubjectPicker value={task.subject} onChange={(subject) => update(task.id, { subject })} />}
      </div>
      <button type="button" className="icon-btn" aria-label={`Borrar "${task.text}"`} title="Borrar" onClick={() => remove(task.id)}>
        <X size={16} />
      </button>
    </li>
  )

  return (
    <Panel
      title="Tareas"
      panel="tasks"
      icon={<ListTodo size={18} />}
      className="tasks-panel"
      actions={pending.length > 0 && <span className="badge">{pending.length}</span>}
    >
      <form className="input-row" onSubmit={add}>
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Añadir tarea…"
          aria-label="Nueva tarea"
          maxLength={200}
        />
        <button type="submit" className="btn btn-primary btn-icon" aria-label="Añadir tarea" disabled={!text.trim()}>
          <Plus size={18} />
        </button>
      </form>

      {tasks.length === 0 && <p className="empty">Apunta lo que tienes que hacer y táchalo al terminar.</p>}
      {tasks.length > 0 && pending.length === 0 && <p className="empty">¡Todo hecho! 🎉</p>}
      {pending.length > 0 && <ul className="task-list">{pending.map(renderTask)}</ul>}

      {done.length > 0 && (
        <details className="done-tasks">
          <summary>Hechas ({done.length})</summary>
          <ul className="task-list">{done.map(renderTask)}</ul>
          <button type="button" className="btn btn-link" onClick={() => setTasks((prev) => prev.filter((t) => !t.done))}>
            <Trash2 size={14} /> Borrar las hechas
          </button>
        </details>
      )}
    </Panel>
  )
}
