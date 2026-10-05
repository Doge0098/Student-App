import { createStore, useStore } from '../../hooks/store'
import { detectSubject, type SubjectId } from '../../lib/subjects'
import { uid } from '../../lib/text'
import { cleanList, cleanSubject, finiteOr, isRecord, sameFields, withClean } from './cleanStore'

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

function cleanTask(item: unknown): Task | null {
  if (!isRecord(item) || typeof item.id !== 'string' || typeof item.text !== 'string') return null
  const fixed = {
    done: item.done === true,
    subject: cleanSubject(item.subject),
    createdAt: finiteOr(item.createdAt, 0),
    due: typeof item.due === 'string' ? item.due : undefined,
    kind: item.kind === 'tarea' || item.kind === 'examen' ? item.kind : undefined,
  }
  return sameFields(item, fixed) ? (item as unknown as Task) : ({ ...item, ...fixed } as Task)
}

/**
 * Tareas guardadas, limpias: sin lo que no es una tarea y con la asignatura «General» si no se conoce.
 * Datos editados a mano o de otra versión nunca rompen la app.
 */
export function cleanTasks(value: unknown): Task[] {
  return cleanList(value, cleanTask)
}

/** Misma clave que antes: las tareas guardadas se conservan. */
export const tasksStore = withClean(createStore<Task[]>('tasks', []), cleanTasks)

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
