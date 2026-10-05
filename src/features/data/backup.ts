/**
 * Copia de seguridad: los datos de LockIn viven solo en este navegador. Para pasarlos a otro
 * ordenador se descarga un archivo con todo y se carga en el otro.
 */

export const PREFIX = 'student-app:'

/**
 * No se copian: el temporizador en marcha (no tiene sentido en otro ordenador) ni las claves de IA
 * (son secretas: mejor volver a pegarlas a mano).
 */
export const EXCLUDED_KEYS = ['timer', 'ai-settings']

export interface Backup {
  app: 'LockIn'
  version: 1
  exportedAt: string
  data: Record<string, unknown>
}

type ReadableStorage = Pick<Storage, 'length' | 'key' | 'getItem'>
type WritableStorage = ReadableStorage & Pick<Storage, 'setItem' | 'removeItem'>

function lockinKeys(storage: ReadableStorage): string[] {
  const keys: string[] = []
  for (let i = 0; i < storage.length; i++) {
    const key = storage.key(i)
    if (key?.startsWith(PREFIX)) keys.push(key.slice(PREFIX.length))
  }
  return keys
}

export function createBackup(storage: ReadableStorage, now: Date): Backup {
  const data: Record<string, unknown> = {}
  for (const key of lockinKeys(storage)) {
    if (EXCLUDED_KEYS.includes(key)) continue
    const raw = storage.getItem(PREFIX + key)
    if (raw === null) continue
    try {
      data[key] = JSON.parse(raw)
    } catch {
      /* valor dañado: no se copia */
    }
  }
  return { app: 'LockIn', version: 1, exportedAt: now.toISOString(), data }
}

/** Lee un archivo de copia. Lanza un error con un mensaje claro si no es válido. */
export function parseBackup(text: string): Backup {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    throw new Error('El archivo no es una copia de LockIn (no se puede leer).')
  }
  const b = parsed as Partial<Backup> | null
  if (!b || typeof b !== 'object' || b.app !== 'LockIn' || typeof b.data !== 'object' || b.data === null || Array.isArray(b.data)) {
    throw new Error('El archivo no es una copia de LockIn.')
  }
  if (b.version !== 1) throw new Error('Esta copia es de una versión de LockIn que no se reconoce.')
  return { app: 'LockIn', version: 1, exportedAt: String(b.exportedAt ?? ''), data: b.data }
}

/** Sustituye los datos actuales por los de la copia. Devuelve cuántos apartados se han cargado. */
export function restoreBackup(storage: WritableStorage, backup: Backup): number {
  clearData(storage)
  let count = 0
  for (const [key, value] of Object.entries(backup.data)) {
    if (EXCLUDED_KEYS.includes(key) || !/^[\w-]+$/.test(key)) continue
    storage.setItem(PREFIX + key, JSON.stringify(value))
    count++
  }
  return count
}

/** Borra los datos de LockIn de este navegador (menos las claves de IA, que se borran desde la IA). */
export function clearData(storage: WritableStorage, { keepSecrets = true } = {}): void {
  for (const key of lockinKeys(storage)) {
    if (keepSecrets && key === 'ai-settings') continue
    storage.removeItem(PREFIX + key)
  }
}

export function backupFileName(now: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `lockin-copia-${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}.json`
}
