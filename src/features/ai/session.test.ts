import { describe, expect, it } from 'vitest'
import { AiError } from './errors'
import { createTask } from './session'

const abortable = (signal: AbortSignal) =>
  new Promise<string>((_resolve, reject) => signal.addEventListener('abort', () => reject(new AiError('aborted', 'Cancelado.'))))

describe('createTask', () => {
  it('guarda el resultado', async () => {
    const task = createTask<number>()
    const running = task.run(async () => 42)
    expect(task.store.get().loading).toBe(true)
    await running
    expect(task.store.get()).toEqual({ loading: false, error: null, result: 42 })
    task.update((n) => n + 1)
    expect(task.store.get().result).toBe(43)
  })

  it('guarda el mensaje de error amable', async () => {
    const task = createTask<number>()
    await task.run(async () => {
      throw new AiError('rate', 'Espera un momento.')
    })
    expect(task.store.get()).toEqual({ loading: false, error: 'Espera un momento.', result: null })
  })

  it('cancelar no muestra error', async () => {
    const task = createTask<string>()
    const running = task.run(abortable)
    task.cancel()
    await running
    expect(task.store.get()).toEqual({ loading: false, error: null, result: null })
  })

  it('una petición nueva sustituye a la anterior', async () => {
    const task = createTask<string>()
    const first = task.run(abortable)
    const second = task.run(async () => 'segunda')
    await Promise.all([first, second])
    expect(task.store.get().result).toBe('segunda')
  })

  it('clear deja todo vacío aunque haya algo en marcha', async () => {
    const task = createTask<string>()
    const running = task.run(abortable)
    task.clear()
    await running
    expect(task.store.get()).toEqual({ loading: false, error: null, result: null })
  })
})
