import { useMemo } from 'react'
import { createStore, useStore } from '../../hooks/store'
import type { SubjectId } from '../../lib/subjects'
import { todayKey } from '../../lib/time'
import { addStudy, normalizeProgress, type ProgressData } from './progress'

/**
 * Minutos estudiados por día y asignatura. Misma clave que el antiguo resumen del día:
 * lo que ya hubiera guardado se convierte al leerlo (ver normalizeProgress).
 */
export const progressStore = createStore<unknown>('timer-stats', null)

/** Apunta tiempo de estudio. `at` decide el día (por defecto, ahora). */
export function recordStudy(minutes: number, subject: SubjectId, blocks: number, at: number = Date.now()): void {
  const date = todayKey(new Date(at))
  progressStore.set((prev: unknown) => addStudy(normalizeProgress(prev), { date, minutes, subject, blocks }))
}

export function useProgress(): ProgressData {
  const [raw] = useStore(progressStore)
  return useMemo(() => normalizeProgress(raw), [raw])
}
