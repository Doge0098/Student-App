/**
 * Copia de seguridad: los datos de LockIn viven solo en este navegador. Para pasarlos a otro
 * ordenador se descarga un archivo con todo y se carga en el otro.
 */

export const PREFIX = 'student-app:'

/**
 * No se copian: lo que solo tiene sentido en este ordenador y en este momento (temporizador en marcha,
 * sala con amigos, modo foco, avisos ya mostrados hoy) ni las claves de IA (son secretas: mejor
 * volver a pegarlas a mano).
 */
export const EXCLUDED_KEYS = ['timer', 'room', 'focus-mode', 'task-reminders', 'ai-settings']

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
  const data = b.data as Record<string, unknown>
  for (const [key, value] of Object.entries(data)) {
    const shape = KEY_SHAPES[key]
    if (shape && !shape(value)) throw new Error(DAMAGED)
  }
  return { app: 'LockIn', version: 1, exportedAt: String(b.exportedAt ?? ''), data }
}

const DAMAGED = 'La copia está dañada; tus datos no se han tocado.'

const isList = (v: unknown) => Array.isArray(v)
const isObject = (v: unknown) => typeof v === 'object' && v !== null && !Array.isArray(v)

/** Forma que debe tener cada apartado conocido: si no la tiene, la copia no se carga. */
const KEY_SHAPES: Record<string, (v: unknown) => boolean> = {
  tasks: isList,
  notes: isList,
  'browser-history': isList,
  'browser-tabs': isList,
  'music-stations': isList,
  'my-apps': isList,
  flashcards: isObject,
  profile: isObject,
  appearance: isObject,
  'timer-stats': isObject,
  'timer-settings': isObject,
}

/**
 * Sustituye los datos actuales por los de la copia. Devuelve cuántos apartados se han cargado.
 * Si algo falla a mitad (p. ej. no cabe), se deja todo como estaba.
 */
export function restoreBackup(storage: WritableStorage, backup: Backup): number {
  const snapshot = new Map<string, string>()
  for (const key of lockinKeys(storage)) {
    const raw = storage.getItem(PREFIX + key)
    if (raw !== null) snapshot.set(key, raw)
  }
  clearData(storage)
  let count = 0
  try {
    for (const [key, value] of Object.entries(backup.data)) {
      if (EXCLUDED_KEYS.includes(key) || !/^[\w-]+$/.test(key)) continue
      storage.setItem(PREFIX + key, JSON.stringify(value))
      count++
    }
  } catch {
    clearData(storage)
    for (const [key, raw] of snapshot) {
      try {
        storage.setItem(PREFIX + key, raw)
      } catch {
        /* lo que no quepa ya no estaba antes */
      }
    }
    throw new Error('La copia es demasiado grande para este navegador; tus datos no se han tocado.')
  }
  return count
}

/** Borra los datos de LockIn de este navegador. Con keepSecrets (por defecto) se conservan las claves de IA. */
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
