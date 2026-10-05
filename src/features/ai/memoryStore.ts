import type { Store } from '../../hooks/store'

type Updater<T> = T | ((prev: T) => T)

/**
 * Como createStore pero sin guardar en el navegador: el estado dura mientras la página está abierta.
 * Sirve para que una conversación o un test no se pierdan al cambiar de pestaña dentro de LockIn.
 */
export function createMemoryStore<T>(initial: T): Store<T> & { reset: () => void } {
  let value = initial
  const listeners = new Set<() => void>()
  return {
    key: '',
    get: () => value,
    set: (next: Updater<T>) => {
      value = typeof next === 'function' ? (next as (prev: T) => T)(value) : next
      listeners.forEach((l) => l())
    },
    subscribe: (listener) => {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    reset: () => {
      value = initial
      listeners.forEach((l) => l())
    },
  }
}
