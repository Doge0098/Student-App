import { describe, expect, it } from 'vitest'
import {
  EMPTY_PROGRESS,
  KEEP_DAYS,
  addStudy,
  currentStreak,
  formatMinutes,
  lastDays,
  normalizeProgress,
  shiftDay,
  subjectTotals,
  type ProgressData,
} from './progress'

const TODAY = '2026-10-05' // lunes

function withDays(days: Record<string, { minutes: number; blocks: number; subjects?: Record<string, number> }>): ProgressData {
  return normalizeProgress({ v: 2, days })
}

describe('normalizeProgress', () => {
  it('convierte el formato antiguo sin perder los minutos de hoy', () => {
    const data = normalizeProgress({ date: TODAY, blocks: 2, minutes: 75 })
    expect(data.days[TODAY]).toEqual({ minutes: 75, blocks: 2, subjects: { general: 75 } })
  })

  it('ignora datos vacíos o rotos', () => {
    expect(normalizeProgress(null)).toEqual(EMPTY_PROGRESS)
    expect(normalizeProgress('hola')).toEqual(EMPTY_PROGRESS)
    expect(normalizeProgress({ date: TODAY, blocks: 0, minutes: 0 })).toEqual(EMPTY_PROGRESS)
    expect(normalizeProgress({ date: 'ayer', blocks: 1, minutes: 30 })).toEqual(EMPTY_PROGRESS)
  })

  it('limpia días y asignaturas no válidos', () => {
    const data = normalizeProgress({
      v: 2,
      days: {
        [TODAY]: { minutes: 40, blocks: 1, subjects: { historia: 30, inventada: 10, general: -3 } },
        'no-es-fecha': { minutes: 10, blocks: 1, subjects: {} },
        '2026-10-04': { minutes: 'mucho', blocks: null },
      },
    })
    expect(data.days).toEqual({ [TODAY]: { minutes: 40, blocks: 1, subjects: { historia: 30 } } })
  })
})

describe('addStudy', () => {
  it('suma minutos al día y a la asignatura, y cuenta los bloques', () => {
    let data = addStudy(EMPTY_PROGRESS, { date: TODAY, minutes: 30, subject: 'matematicas', blocks: 1 })
    data = addStudy(data, { date: TODAY, minutes: 12, subject: 'matematicas', blocks: 0 })
    data = addStudy(data, { date: TODAY, minutes: 45, subject: 'historia', blocks: 1 })
    expect(data.days[TODAY]).toEqual({ minutes: 87, blocks: 2, subjects: { matematicas: 42, historia: 45 } })
    expect(EMPTY_PROGRESS.days).toEqual({})
  })

  it('no apunta nada si no hay minutos ni bloques', () => {
    expect(addStudy(EMPTY_PROGRESS, { date: TODAY, minutes: 0, subject: 'general', blocks: 0 })).toBe(EMPTY_PROGRESS)
  })

  it('borra el historial más antiguo cuando pasa del límite', () => {
    let data: ProgressData = EMPTY_PROGRESS
    for (let i = KEEP_DAYS + 5; i >= 0; i--) {
      data = addStudy(data, { date: shiftDay(TODAY, -i), minutes: 30, subject: 'general', blocks: 1 })
    }
    expect(Object.keys(data.days)).toHaveLength(KEEP_DAYS)
    expect(data.days[TODAY]).toBeDefined()
    expect(data.days[shiftDay(TODAY, -(KEEP_DAYS + 5))]).toBeUndefined()
  })
})

describe('fechas', () => {
  it('cambia de mes y de año correctamente', () => {
    expect(shiftDay('2026-03-01', -1)).toBe('2026-02-28')
    expect(shiftDay('2025-12-31', 1)).toBe('2026-01-01')
    expect(shiftDay('2026-10-25', 1)).toBe('2026-10-26') // cambio de hora
  })

  it('devuelve los últimos 7 días con su letra, del más antiguo a hoy', () => {
    const data = withDays({ [TODAY]: { minutes: 30, blocks: 1 }, '2026-10-01': { minutes: 50, blocks: 1 } })
    const days = lastDays(data, TODAY)
    expect(days.map((d) => d.short).join('')).toBe('MXJVSDL')
    expect(days.map((d) => d.minutes)).toEqual([0, 0, 50, 0, 0, 0, 30])
    expect(days[6]).toMatchObject({ date: TODAY, isToday: true, long: 'lunes 5 oct' })
    expect(days[0].date).toBe('2026-09-29')
  })
})

describe('currentStreak', () => {
  it('cuenta los días seguidos con algún bloque completado', () => {
    const data = withDays({
      [TODAY]: { minutes: 30, blocks: 1 },
      '2026-10-04': { minutes: 30, blocks: 1 },
      '2026-10-03': { minutes: 60, blocks: 2 },
      '2026-10-01': { minutes: 30, blocks: 1 },
    })
    expect(currentStreak(data, TODAY)).toBe(3)
  })

  it('si hoy aún no has completado ninguno, la racha de ayer sigue viva', () => {
    const data = withDays({ '2026-10-04': { minutes: 30, blocks: 1 }, '2026-10-03': { minutes: 30, blocks: 1 } })
    expect(currentStreak(data, TODAY)).toBe(2)
  })

  it('los minutos sueltos sin bloque completado no cuentan para la racha', () => {
    const data = withDays({ [TODAY]: { minutes: 10, blocks: 0 }, '2026-10-03': { minutes: 30, blocks: 1 } })
    expect(currentStreak(data, TODAY)).toBe(0)
    expect(currentStreak(EMPTY_PROGRESS, TODAY)).toBe(0)
  })
})

describe('subjectTotals', () => {
  it('suma cada asignatura en los últimos 7 días, de más a menos', () => {
    const data = withDays({
      [TODAY]: { minutes: 40, blocks: 1, subjects: { historia: 40 } },
      '2026-10-02': { minutes: 90, blocks: 2, subjects: { matematicas: 60, historia: 30 } },
      '2026-09-20': { minutes: 300, blocks: 5, subjects: { fisica: 300 } },
    })
    expect(subjectTotals(data, TODAY)).toEqual([
      { subject: 'historia', minutes: 70 },
      { subject: 'matematicas', minutes: 60 },
    ])
  })
})

describe('formatMinutes', () => {
  it('muestra horas y minutos', () => {
    expect(formatMinutes(0)).toBe('0 min')
    expect(formatMinutes(45)).toBe('45 min')
    expect(formatMinutes(60)).toBe('1 h')
    expect(formatMinutes(95)).toBe('1 h 35 min')
  })
})
