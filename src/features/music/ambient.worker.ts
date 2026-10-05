/* Genera los sonidos ambiente en segundo plano, para que la página no se quede parada al darle a «play». */
import { generateAmbient, isAmbientId } from './ambientSounds'
import { seededRandom } from './dsp'

export interface AmbientRequest {
  id: string
  sampleRate: number
  seed: number
}

export interface AmbientResponse {
  channels?: Float32Array[]
  error?: string
}

self.onmessage = (event: MessageEvent<AmbientRequest>) => {
  const { id, sampleRate, seed } = event.data
  let response: AmbientResponse
  let transfer: ArrayBuffer[] = []
  try {
    if (!isAmbientId(id)) throw new Error(`Sonido desconocido: ${id}`)
    const channels = generateAmbient(id, sampleRate, seededRandom(seed))
    response = { channels }
    transfer = channels.map((c) => c.buffer as ArrayBuffer)
  } catch (error) {
    response = { error: error instanceof Error ? error.message : String(error) }
  }
  self.postMessage(response, { transfer })
}
