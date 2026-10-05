import { createStore, useStore } from '../../hooks/store'
import { detectSubject, type SubjectId } from '../../lib/subjects'
import { uid } from '../../lib/text'

export interface Task {
  id: string
  text: string
  done: boolean
  subject: SubjectId
  createdAt: number
  /** Fecha límite o del examen, "YYYY-MM-DD" (opcional). */
  due?: string
  /** Un examen se muestra con cuenta atrás. */
  kind?: 'tarea' | 'examen'
}

/** Misma clave que antes: las tareas guardadas se conservan. */
export const tasksStore = createStore<Task[]>('tasks', [])

export function useTasks() {
  const [tasks, setTasks] = useStore(tasksStore)
  return {
    tasks,
    pending: tasks.filter((t) => !t.done),
    add: (text: string, extra: Partial<Pick<Task, 'due' | 'kind' | 'subject'>> = {}) => {
      const value = text.trim()
      if (!value) return null
      // La asignatura se adivina sola a partir del texto; se puede cambiar después.
      const task: Task = { id: uid(), text: value, done: false, subject: detectSubject(value), createdAt: Date.now(), ...extra }
      setTasks((prev) => [task, ...prev])
      return task
    },
    update: (id: string, patch: Partial<Task>) => setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t))),
    remove: (id: string) => setTasks((prev) => prev.filter((t) => t.id !== id)),
    clearDone: () => setTasks((prev) => prev.filter((t) => !t.done)),
  }
}
