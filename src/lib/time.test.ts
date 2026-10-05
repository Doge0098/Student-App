import { describe, expect, it } from 'vitest'
import { clampFocusMinutes, formatClock, timeAgo, todayKey } from './time'

describe('formatClock', () => {
  it('formatea minutos y horas', () => {
    expect(formatClock(30 * 60_000)).toBe('30:00')
    expect(formatClock(59_001)).toBe('01:00')
    expect(formatClock(3_725_000)).toBe('1:02:05')
    expect(formatClock(-5)).toBe('00:00')
  })
})

describe('clampFocusMinutes', () => {
  it('obliga a un mínimo de 30 minutos', () => {
    expect(clampFocusMinutes(10)).toBe(30)
    expect(clampFocusMinutes(45)).toBe(45)
    expect(clampFocusMinutes(1000)).toBe(240)
    expect(clampFocusMinutes(Number.NaN)).toBe(30)
  })
})

describe('timeAgo', () => {
  const now = new Date(2026, 9, 5, 12, 0).getTime()
  it('describe hace cuánto fue', () => {
    expect(timeAgo(now - 10_000, now)).toBe('ahora mismo')
    expect(timeAgo(now - 5 * 60_000, now)).toBe('hace 5 min')
    expect(timeAgo(now - 3 * 3_600_000, now)).toBe('hace 3 h')
    expect(timeAgo(now - 26 * 3_600_000, now)).toBe('ayer')
    expect(timeAgo(now - 3 * 86_400_000, now)).toBe('hace 3 días')
  })
})

describe('todayKey', () => {
  it('usa la fecha local', () => {
    expect(todayKey(new Date(2026, 0, 7))).toBe('2026-01-07')
  })
})
