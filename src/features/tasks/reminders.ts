import { useEffect } from 'react'
import { useToast } from '../../components/Toast'
import { createStore } from '../../hooks/store'
import { notify } from '../../lib/alerts'
import { todayKey } from '../../lib/time'
import { isDueSoon, markShown, reminderMessage, remindersToShow, type ShownReminders } from './dates'
import { tasksStore, type Task } from './store'

/** De qué tareas se ha avisado hoy, para no repetir el aviso el mismo día. */
export const remindersStore = createStore<ShownReminders>('task-reminders', { day: '', ids: [] })

function readShown(): ShownReminders {
  const value = remindersStore.get()
  return value && typeof value.day === 'string' && Array.isArray(value.ids) ? value : { day: '', ids: [] }
}

/**
 * Una tarea que el estudiante acaba de apuntar (o cuya fecha acaba de cambiar) no necesita aviso hoy:
 * ya sabe que es inminente.
 */
export function skipReminderToday(task: Pick<Task, 'id' | 'due'>): void {
  const today = todayKey()
  if (isDueSoon(task, today)) remindersStore.set(markShown(readShown(), today, [task.id]))
}

/** Avisa (una vez al día por tarea) de los exámenes y entregas de hoy, mañana y pasado mañana. */
export function checkDueReminders(toast: (message: string) => void): void {
  const today = todayKey()
  const shown = readShown()
  const tasks = tasksStore.get()
  const reminders = remindersToShow(Array.isArray(tasks) ? tasks : [], today, shown)
  if (reminders.length === 0) return
  remindersStore.set(markShown(shown, today, reminders.map((r) => r.task.id)))
  const message = reminderMessage(reminders)
  toast(`📅 ${message.toast}`)
  // Solo si ya se dio permiso (p. ej. para el temporizador): aquí no se pide.
  notify(message.title, message.body, 'lockin-reminder')
}

/**
 * Comprueba los recordatorios al abrir la app y, si se queda abierta, cuando vuelve a estar
 * a la vista o cada media hora (por si cambia el día).
 */
export function useDueReminders(): void {
  const toast = useToast()
  useEffect(() => {
    const check = () => checkDueReminders(toast)
    // Un momento de margen para que la app termine de pintarse antes del aviso.
    const first = window.setTimeout(check, 1500)
    const every = window.setInterval(check, 30 * 60_000)
    const onVisible = () => {
      if (document.visibilityState === 'visible') check()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      window.clearTimeout(first)
      window.clearInterval(every)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [toast])
}
