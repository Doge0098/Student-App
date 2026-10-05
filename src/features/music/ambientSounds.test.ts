import { describe, expect, it } from 'vitest'
import {
  AMBIENT_IDS,
  AMBIENT_MAX_PEAK,
  AMBIENT_SOUNDS,
  addImpact,
  ambientSampleRate,
  clampVolume,
  DEFAULT_AMBIENT,
  generateAmbient,
  isAmbientId,
  sanitizeAmbient,
  volumeToGain,
  waveEnvelope,
} from './ambientSounds'
import { mean, peak, rms, seededRandom } from './dsp'

// Frecuencia baja para que los tests vayan rápido; las recetas valen para cualquiera.
const SR = 12000

const maxStep = (x: Float32Array) => {
  let max = 0
  for (let i = 1; i < x.length; i++) max = Math.max(max, Math.abs(x[i] - x[i - 1]))
  return max
}

const minOf = (x: Float32Array) => x.reduce((m, v) => Math.min(m, v), Infinity)
const maxOf = (x: Float32Array) => x.reduce((m, v) => Math.max(m, v), -Infinity)

const correlation = (a: Float32Array, b: Float32Array) => {
  let ab = 0
  let aa = 0
  let bb = 0
  for (let i = 0; i < a.length; i++) {
    ab += a[i] * b[i]
    aa += a[i] * a[i]
    bb += b[i] * b[i]
  }
  return ab / Math.sqrt(aa * bb)
}

describe.each(AMBIENT_IDS)('sonido %s', (id) => {
  const channels = generateAmbient(id, SR, seededRandom(42))

  it('son dos canales de la duración del bucle', () => {
    expect(channels).toHaveLength(2)
    for (const c of channels) expect(c).toHaveLength(Math.round(AMBIENT_SOUNDS[id].seconds * SR))
  })

  it('no tiene valores raros y nunca pasa del pico permitido', () => {
    for (const c of channels) {
      expect(c.every((v) => Number.isFinite(v))).toBe(true)
      expect(peak(c)).toBeLessThanOrEqual(AMBIENT_MAX_PEAK)
    }
  })

  it('se oye (no está en silencio) y está centrado en cero', () => {
    for (const c of channels) {
      expect(rms(c)).toBeGreaterThan(0.03)
      expect(Math.abs(mean(c))).toBeLessThan(0.03)
    }
  })

  it('suena abierto: los dos oídos no reciben lo mismo', () => {
    expect(Math.abs(correlation(channels[0], channels[1]))).toBeLessThan(0.5)
  })

  it('el bucle se repite sin chasquido en el empalme', () => {
    for (const c of channels) {
      expect(Math.abs(c[0] - c[c.length - 1])).toBeLessThanOrEqual(maxStep(c))
    }
  })

  it('con la misma semilla da exactamente lo mismo', () => {
    const again = generateAmbient(id, SR, seededRandom(42))
    expect(again[0].subarray(0, 500)).toEqual(channels[0].subarray(0, 500))
  })
})

describe('olas', () => {
  it('suben y bajan despacio (cada segundo suena distinto)', () => {
    const [left] = generateAmbient('olas', SR, seededRandom(3))
    const windows: number[] = []
    for (let s = 0; s + SR <= left.length; s += SR) windows.push(rms(left.subarray(s, s + SR)))
    expect(Math.max(...windows) / Math.min(...windows)).toBeGreaterThan(2.5)
  })

  it('la forma de las olas va del nivel de fondo a 1 y se repite sin saltos', () => {
    const env = waveEnvelope(SR * 30, seededRandom(4), 4, 0.15)
    expect(minOf(env)).toBeGreaterThanOrEqual(0.15 - 1e-6)
    expect(maxOf(env)).toBeLessThanOrEqual(1 + 1e-6)
    expect(maxOf(env)).toBeGreaterThan(0.6)
    expect(Math.abs(env[0] - env[env.length - 1])).toBeLessThan(0.01)
  })
})

describe('addImpact', () => {
  it('se apaga solo y lo que pasa del final sigue por el principio', () => {
    const channels = [new Float32Array(1000), new Float32Array(1000)]
    addImpact(channels, SR, seededRandom(5), 990, { amp: [1, 1], decayMs: [2, 2], cutoffHz: [3000, 3000] })
    expect(peak(channels[0].subarray(0, 50)) + peak(channels[1].subarray(0, 50))).toBeGreaterThan(0)
    expect(channels[0].subarray(400, 980).every((v) => v === 0)).toBe(true)
    expect(channels.every((c) => c.every((v) => Number.isFinite(v)))).toBe(true)
  })
})

describe('ajustes guardados', () => {
  it('reconoce los sonidos', () => {
    expect(isAmbientId('lluvia')).toBe(true)
    expect(isAmbientId('marron')).toBe(true)
    expect(isAmbientId('toString')).toBe(false)
    expect(isAmbientId(3)).toBe(false)
  })

  it('sanea datos rotos o de otras versiones', () => {
    expect(sanitizeAmbient(null)).toEqual(DEFAULT_AMBIENT)
    expect(sanitizeAmbient('lluvia')).toEqual(DEFAULT_AMBIENT)
    expect(sanitizeAmbient({ sound: 'jazz', volume: 'alto' })).toEqual(DEFAULT_AMBIENT)
    expect(sanitizeAmbient({ sound: 'olas', volume: 140 })).toEqual({ sound: 'olas', volume: 100 })
    expect(sanitizeAmbient({ sound: 'chimenea', volume: -3 })).toEqual({ sound: 'chimenea', volume: 0 })
    expect(sanitizeAmbient({ sound: 'rosa', volume: 33.4 })).toEqual({ sound: 'rosa', volume: 33 })
  })

  it('clampVolume usa el valor por defecto si no es un número', () => {
    expect(clampVolume(Number.NaN)).toBe(DEFAULT_AMBIENT.volume)
    expect(clampVolume(undefined, 7)).toBe(7)
  })
})

describe('volumeToGain', () => {
  it('va de 0 a 1, sube siempre y la mitad suena a «la mitad»', () => {
    expect(volumeToGain(0)).toBe(0)
    expect(volumeToGain(100)).toBe(1)
    expect(volumeToGain(50)).toBeCloseTo(0.25)
    expect(volumeToGain(200)).toBe(1)
    expect(volumeToGain(Number.NaN)).toBe(0)
    let last = -1
    for (let v = 0; v <= 100; v += 5) {
      expect(volumeToGain(v)).toBeGreaterThan(last)
      last = volumeToGain(v)
    }
  })
})

describe('ambientSampleRate', () => {
  it('no pasa de lo que necesita cada sonido ni de lo que da el dispositivo', () => {
    expect(ambientSampleRate('blanco', 48000)).toBe(48000)
    expect(ambientSampleRate('olas', 48000)).toBe(AMBIENT_SOUNDS.olas.maxSampleRate)
    expect(ambientSampleRate('lluvia', 16000)).toBe(16000)
    expect(ambientSampleRate('lluvia', Number.NaN)).toBeGreaterThanOrEqual(8000)
    expect(ambientSampleRate('lluvia', 1000)).toBe(8000)
  })
})
