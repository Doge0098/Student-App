import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Store } from '../../hooks/store'
import { withClean } from './cleanStore'
import { cleanTasks, type Task } from './store'

const task = (extra: Partial<Task> = {}): Task => ({
  id: 'a',
  text: 'Ejercicios de mates',
  done: false,
  subject: 'matematicas',
  createdAt: 1,
  ...extra,
})

/** Un store en memoria con lo que haya guardado (aunque esté roto). */
function memoryStore<T>(initial: unknown): Store<T> & { raw: () => unknown } {
  let value = initial
  return {
    key: 'prueba',
    get: () => value as T,
    set: (next) => {
      value = typeof next === 'function' ? (next as (prev: T) => T)(value as T) : next
    },
    subscribe: () => () => {},
    raw: () => value,
  }
}

function fakeStorage(initial: Record<string, string> = {}) {
  const map = new Map(Object.entries(initial))
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
    map,
  }
}

describe('cleanTasks', () => {
  it('lo que no es una lista se queda en ninguna tarea', () => {
    for (const value of [null, undefined, {}, { items: [task()] }, 'tareas', 3]) expect(cleanTasks(value)).toEqual([])
  })

  it('quita lo que no es una tarea', () => {
    expect(cleanTasks([null, 1, 'x', [], { id: 1, text: 'x' }, { id: 'b' }, task()])).toEqual([task()])
  })

  it('arregla lo que se puede: asignatura desconocida → General, sin hecha → pendiente', () => {
    const [fixed] = cleanTasks([{ id: 'a', text: 'Repasar', createdAt: 5, subject: 'religion', extra: 1 }])
    expect(fixed).toEqual({ id: 'a', text: 'Repasar', done: false, subject: 'general', createdAt: 5, extra: 1 })
    expect(cleanTasks([{ id: 'b', text: 'x', done: 'sí', subject: 'constructor' }])[0]).toMatchObject({
      done: false,
      subject: 'general',
      createdAt: 0,
    })
  })

  it('quita la fecha o el tipo si no valen', () => {
    const [fixed] = cleanTasks([task({ due: 20261005 as unknown as string, kind: 'fiesta' as Task['kind'] })])
    expect(fixed.due).toBeUndefined()
    expect(fixed.kind).toBeUndefined()
    expect(cleanTasks([task({ due: '2026-10-07', kind: 'examen' })])[0]).toMatchObject({ due: '2026-10-07', kind: 'examen' })
  })

  it('si todo estaba bien devuelve lo mismo (no copia)', () => {
    const list = [task(), task({ id: 'b', done: true, due: '2026-10-07', kind: 'tarea' })]
    expect(cleanTasks(list)).toBe(list)
    expect(cleanTasks(list)[1]).toBe(list[1])
  })
})

describe('withClean', () => {
  it('lee limpio y siempre lo mismo mientras no cambie (como pide useSyncExternalStore)', () => {
    const store = withClean(memoryStore<Task[]>([null, task()]), cleanTasks)
    expect(store.get()).toEqual([task()])
    expect(store.get()).toBe(store.get())
  })

  it('los cambios parten de los datos limpios', () => {
    const raw = memoryStore<Task[]>({ items: [] })
    const store = withClean(raw, cleanTasks)
    store.set((prev) => [task(), ...prev])
    expect(raw.raw()).toEqual([task()])
    store.set((prev) => prev.map((t) => ({ ...t, done: true })))
    expect(store.get()).toEqual([task({ done: true })])
  })
})

describe('tasksStore con datos rotos en el navegador', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.resetModules()
  })

  async function loadWith(saved: string) {
    const storage = fakeStorage({ 'student-app:tasks': saved })
    vi.stubGlobal('localStorage', storage)
    vi.resetModules()
    const { tasksStore } = await import('./store')
    return { tasksStore, storage }
  }

  it.each(['{}', 'null', '[null]', '{"items":[]}', '"hola"'])('%s no rompe nada', async (saved) => {
    const { tasksStore } = await loadWith(saved)
    expect(tasksStore.get()).toEqual([])
  })

  it('una tarea sin asignatura se puede usar y al guardar queda arreglada', async () => {
    const { tasksStore, storage } = await loadWith('[{"id":"a","text":"x","done":false,"createdAt":1}]')
    expect(tasksStore.get()[0].subject).toBe('general')
    tasksStore.set((prev) => prev.map((t) => ({ ...t, done: true })))
    expect(JSON.parse(storage.map.get('student-app:tasks')!)).toEqual([
      { id: 'a', text: 'x', done: true, subject: 'general', createdAt: 1 },
    ])
  })
})
