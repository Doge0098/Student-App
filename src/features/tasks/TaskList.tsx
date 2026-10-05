import { ListTodo, Plus, Trash2, X } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Panel } from '../../components/Panel'
import { SubjectPicker } from '../../components/SubjectPicker'
import { useTasks, type Task } from './store'

export function TaskList() {
  const { tasks, pending, add: addTask, update, remove, clearDone } = useTasks()
  const [text, setText] = useState('')

  const done = tasks.filter((t) => t.done)

  const add = (e: FormEvent) => {
    e.preventDefault()
    if (addTask(text)) setText('')
  }

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
          <button type="button" className="btn btn-link" onClick={clearDone}>
            <Trash2 size={14} /> Borrar las hechas
          </button>
        </details>
      )}
    </Panel>
  )
}
