import { describe, expect, it } from 'vitest'
import {
  addDays,
  daysUntil,
  dueInfo,
  formatDueDate,
  isDateKey,
  isDueSoon,
  markShown,
  reminderMessage,
  remindersToShow,
  sortPending,
} from './dates'
import type { Task } from './store'

const task = (id: string, extra: Partial<Task> = {}): Task => ({
  id,
  text: `Tarea ${id}`,
  done: false,
  subject: 'general',
  createdAt: 0,
  ...extra,
})

describe('isDateKey', () => {
  it('acepta solo fechas reales YYYY-MM-DD', () => {
    expect(isDateKey('2026-10-05')).toBe(true)
    expect(isDateKey('2028-02-29')).toBe(true)
    expect(isDateKey('2026-02-30')).toBe(false)
    expect(isDateKey('2026-13-01')).toBe(false)
    expect(isDateKey('5/10/2026')).toBe(false)
    expect(isDateKey('')).toBe(false)
    expect(isDateKey(undefined)).toBe(false)
  })
})

describe('daysUntil', () => {
  it('cuenta días de calendario', () => {
    expect(daysUntil('2026-10-05', '2026-10-05')).toBe(0)
    expect(daysUntil('2026-10-06', '2026-10-05')).toBe(1)
    expect(daysUntil('2026-10-04', '2026-10-05')).toBe(-1)
    expect(daysUntil('2027-01-01', '2026-12-31')).toBe(1)
  })

  it('no se lía con los cambios de hora', () => {
    // En España la hora cambia el último domingo de octubre y de marzo.
    expect(daysUntil('2026-10-26', '2026-10-24')).toBe(2)
    expect(daysUntil('2027-03-29', '2027-03-27')).toBe(2)
  })

  it('devuelve null con fechas no válidas', () => {
    expect(daysUntil('mañana', '2026-10-05')).toBeNull()
  })
})

describe('addDays', () => {
  it('suma y resta días cambiando de mes y de año', () => {
    expect(addDays('2026-10-05', 2)).toBe('2026-10-07')
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28')
  })
})

describe('dueInfo', () => {
  const today = '2026-10-05'
  it('etiqueta las entregas', () => {
    expect(dueInfo({ due: '2026-10-05' }, today)).toEqual({ days: 0, label: 'Hoy', tone: 'soon' })
    expect(dueInfo({ due: '2026-10-06' }, today)).toEqual({ days: 1, label: 'Mañana', tone: 'soon' })
    expect(dueInfo({ due: '2026-10-10' }, today)).toEqual({ days: 5, label: 'En 5 días', tone: 'normal' })
    expect(dueInfo({ due: '2026-10-01' }, today)).toEqual({ days: -4, label: 'Vencida', tone: 'danger' })
  })

  it('muestra la cuenta atrás de los exámenes', () => {
    expect(dueInfo({ due: '2026-10-10', kind: 'examen' }, today)?.label).toBe('Examen · faltan 5 días')
    expect(dueInfo({ due: '2026-10-06', kind: 'examen' }, today)?.label).toBe('Examen · mañana')
    expect(dueInfo({ due: '2026-10-05', kind: 'examen' }, today)?.label).toBe('Examen · hoy')
    expect(dueInfo({ due: '2026-10-01', kind: 'examen' }, today)).toEqual({
      days: -4,
      label: 'Examen · ya pasó',
      tone: 'normal',
    })
  })

  it('sin fecha no hay etiqueta, salvo que sea un examen', () => {
    expect(dueInfo({}, today)).toBeNull()
    expect(dueInfo({ due: 'roto' }, today)).toBeNull()
    expect(dueInfo({ kind: 'examen' }, today)).toEqual({ days: null, label: 'Examen', tone: 'normal' })
  })
})

describe('formatDueDate', () => {
  it('escribe la fecha en español', () => {
    expect(formatDueDate('2026-10-12')).toContain('12')
    expect(formatDueDate('2026-10-12')).toContain('octubre')
    expect(formatDueDate('roto')).toBe('roto')
  })
})

describe('sortPending', () => {
  it('pone primero las que tienen fecha, de la más cercana a la más lejana', () => {
    const list = [
      task('a'),
      task('b', { due: '2026-10-20' }),
      task('c', { due: '2026-10-01' }),
      task('d'),
      task('e', { due: '2026-10-07' }),
      task('f', { due: '2026-10-07' }),
      task('g', { due: 'roto' }),
    ]
    expect(sortPending(list).map((t) => t.id)).toEqual(['c', 'e', 'f', 'b', 'a', 'd', 'g'])
  })

  it('no cambia la lista original', () => {
    const list = [task('a'), task('b', { due: '2026-10-01' })]
    sortPending(list)
    expect(list.map((t) => t.id)).toEqual(['a', 'b'])
  })
})

describe('recordatorios', () => {
  const today = '2026-10-05'
  const tasks = [
    task('lejos', { due: '2026-10-09' }),
    task('pasado', { due: '2026-10-07', kind: 'examen' }),
    task('hoy', { due: '2026-10-05' }),
    task('hecha', { due: '2026-10-05', done: true }),
    task('vencida', { due: '2026-10-01' }),
    task('sin-fecha'),
  ]

  it('avisa de lo que toca hoy, mañana y pasado mañana, lo más urgente primero', () => {
    const reminders = remindersToShow(tasks, today, { day: '', ids: [] })
    expect(reminders.map((r) => [r.task.id, r.days])).toEqual([
      ['hoy', 0],
      ['pasado', 2],
    ])
  })

  it('no repite un aviso el mismo día, pero sí al día siguiente', () => {
    const shown = markShown({ day: '', ids: [] }, today, ['hoy'])
    expect(remindersToShow(tasks, today, shown).map((r) => r.task.id)).toEqual(['pasado'])
    expect(remindersToShow(tasks, '2026-10-06', shown).map((r) => r.task.id)).toEqual(['pasado'])
  })

  it('markShown acumula los de hoy y olvida los de otros días', () => {
    expect(markShown({ day: today, ids: ['a'] }, today, ['b', 'a'])).toEqual({ day: today, ids: ['a', 'b'] })
    expect(markShown({ day: '2026-10-04', ids: ['a'] }, today, ['b'])).toEqual({ day: today, ids: ['b'] })
  })

  it('isDueSoon', () => {
    expect(isDueSoon({ due: '2026-10-07' }, today)).toBe(true)
    expect(isDueSoon({ due: '2026-10-08' }, today)).toBe(false)
    expect(isDueSoon({ due: '2026-10-04' }, today)).toBe(false)
    expect(isDueSoon({}, today)).toBe(false)
  })

  it('redacta el aviso', () => {
    const reminders = remindersToShow(tasks, today, { day: '', ids: [] })
    expect(reminderMessage(reminders)).toEqual({
      toast: 'Hoy se entrega: Tarea hoy (y 1 más)',
      title: 'Se acerca un examen',
      body: 'Hoy se entrega: Tarea hoy\nPasado mañana tienes examen: Tarea pasado',
    })
    expect(reminderMessage([{ task: task('x', { kind: 'examen' }), days: 1 }]).toast).toBe('Mañana tienes examen: Tarea x')
    expect(reminderMessage([]).toast).toBe('')
  })
})
