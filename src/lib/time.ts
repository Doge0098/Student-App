export const MIN_FOCUS_MINUTES = 30
export const MAX_FOCUS_MINUTES = 240
export const BREAK_OPTIONS = [5, 10, 15, 20] as const

const pad = (n: number) => String(n).padStart(2, '0')

/** Reloj digital, siempre minutos:segundos: 1500000 → "25:00"; 5400000 → "90:00" */
export function formatClock(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000))
  return `${pad(Math.floor(total / 60))}:${pad(total % 60)}`
}

export function clampFocusMinutes(minutes: number): number {
  if (!Number.isFinite(minutes)) return MIN_FOCUS_MINUTES
  return Math.min(MAX_FOCUS_MINUTES, Math.max(MIN_FOCUS_MINUTES, Math.round(minutes)))
}

export function clampBreakMinutes(minutes: number): number {
  if (!Number.isFinite(minutes)) return BREAK_OPTIONS[0]
  return Math.min(60, Math.max(1, Math.round(minutes)))
}

export function todayKey(date = new Date()): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

export function timeAgo(timestamp: number, now = Date.now()): string {
  const minutes = Math.floor(Math.max(0, now - timestamp) / 60000)
  if (minutes < 1) return 'ahora mismo'
  if (minutes < 60) return `hace ${minutes} min`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `hace ${hours} h`
  const days = Math.floor(hours / 24)
  if (days === 1) return 'ayer'
  if (days < 7) return `hace ${days} días`
  return new Date(timestamp).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })
}
