/*
 * Pide un sonido ambiente al worker. Si el navegador no deja usar workers (o el archivo no está,
 * p. ej. sin internet antes de haberlo usado nunca), se genera aquí mismo, justo después del clic.
 */
import type { AmbientResponse } from './ambient.worker'
import { generateAmbient, type AmbientId } from './ambientSounds'
import { seededRandom } from './dsp'

/** Si el worker tarda más que esto, se da por perdido y se genera aquí. */
const WORKER_TIMEOUT_MS = 15000

function inWorker(id: AmbientId, sampleRate: number, seed: number): Promise<Float32Array[]> {
  return new Promise((resolve, reject) => {
    let worker: Worker
    try {
      worker = new Worker(new URL('./ambient.worker.ts', import.meta.url), { type: 'module' })
    } catch (error) {
      reject(error)
      return
    }
    const finish = (result: Float32Array[] | Error) => {
      window.clearTimeout(timer)
      worker.terminate()
      if (result instanceof Error) reject(result)
      else resolve(result)
    }
    const timer = window.setTimeout(() => finish(new Error('El worker no responde')), WORKER_TIMEOUT_MS)
    worker.onmessage = (event: MessageEvent<AmbientResponse>) => {
      const { channels, error } = event.data
      finish(channels && channels.length > 0 ? channels : new Error(error ?? 'Sonido vacío'))
    }
    worker.onerror = (event) => {
      event.preventDefault()
      finish(new Error(event.message || 'Error en el worker'))
    }
    worker.onmessageerror = () => finish(new Error('Respuesta ilegible del worker'))
    worker.postMessage({ id, sampleRate, seed })
  })
}

function onMainThread(id: AmbientId, sampleRate: number, seed: number): Promise<Float32Array[]> {
  // Se deja pintar la página primero (el botón ya cambia) y luego se genera.
  return new Promise((resolve, reject) => {
    window.setTimeout(() => {
      try {
        resolve(generateAmbient(id, sampleRate, seededRandom(seed)))
      } catch (error) {
        reject(error)
      }
    }, 30)
  })
}

export function generateAmbientAsync(id: AmbientId, sampleRate: number): Promise<Float32Array[]> {
  // Cada vez sale un bucle distinto (otra semilla), así no suena siempre igual.
  const seed = Math.floor(Math.random() * 2 ** 32)
  return inWorker(id, sampleRate, seed).catch(() => onMainThread(id, sampleRate, seed))
}
