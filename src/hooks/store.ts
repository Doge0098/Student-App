import { useCallback, useSyncExternalStore } from 'react'

const PREFIX = 'student-app:'

type Updater<T> = T | ((prev: T) => T)

export interface Store<T> {
  key: string
  get: () => T
  set: (next: Updater<T>) => void
  subscribe: (listener: () => void) => () => void
}

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(PREFIX + key)
    return raw === null ? fallback : (JSON.parse(raw) as T)
  } catch {
    return fallback
  }
}

/**
 * Estado compartido que se guarda en el navegador.
 * Todos los componentes que usan el mismo store ven el mismo valor, y los cambios
 * hechos en otra pestaña de LockIn también llegan.
 */
export function createStore<T>(key: string, initial: T): Store<T> {
  let value = typeof localStorage === 'undefined' ? initial : read(key, initial)
  const listeners = new Set<() => void>()
  const notify = () => listeners.forEach((l) => l())

  if (typeof window !== 'undefined') {
    window.addEventListener('storage', (e) => {
      // key null = otra pestaña ha vaciado el almacenamiento entero.
      if (e.key !== null && e.key !== PREFIX + key) return
      value = read(key, initial)
      notify()
    })
  }

  return {
    key,
    get: () => value,
    set: (next) => {
      value = typeof next === 'function' ? (next as (prev: T) => T)(value) : next
      try {
        localStorage.setItem(PREFIX + key, JSON.stringify(value))
      } catch {
        /* almacenamiento lleno o bloqueado: la app sigue funcionando sin guardar */
      }
      notify()
    },
    subscribe: (listener) => {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
  }
}

export function useStore<T>(store: Store<T>): [T, (next: Updater<T>) => void] {
  const value = useSyncExternalStore(store.subscribe, store.get, store.get)
  const set = useCallback((next: Updater<T>) => store.set(next), [store])
  return [value, set]
}
