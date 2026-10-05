import { describe, expect, it } from 'vitest'
import {
  brownNoise,
  highpass,
  lagOneCorrelation,
  loudness,
  lowpass,
  mean,
  normalizeLoudness,
  peak,
  pinkNoise,
  rms,
  scaleToRms,
  seamlessLoop,
  seededRandom,
  slowWobble,
  softLimit,
  whiteNoise,
} from './dsp'

const SR = 16000
const allFinite = (x: Float32Array) => x.every((v) => Number.isFinite(v))
const maxStep = (x: Float32Array) => {
  let max = 0
  for (let i = 1; i < x.length; i++) max = Math.max(max, Math.abs(x[i] - x[i - 1]))
  return max
}
/** Salto típico entre muestras seguidas (raíz de la media de los cuadrados). */
const typicalStep = (x: Float32Array) => {
  let sum = 0
  for (let i = 1; i < x.length; i++) sum += (x[i] - x[i - 1]) ** 2
  return Math.sqrt(sum / (x.length - 1))
}

describe('seededRandom', () => {
  it('da siempre lo mismo con la misma semilla y se queda en [0, 1)', () => {
    const a = seededRandom(7)
    const b = seededRandom(7)
    for (let i = 0; i < 1000; i++) {
      const v = a()
      expect(v).toBe(b())
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThan(1)
    }
    expect(seededRandom(8)()).not.toBe(seededRandom(7)())
  })
})

describe('ruidos', () => {
  const n = 5 * SR

  it('el ruido blanco está centrado, acotado y tiene la energía esperada', () => {
    const x = whiteNoise(n, seededRandom(1))
    expect(allFinite(x)).toBe(true)
    expect(peak(x)).toBeLessThanOrEqual(1)
    expect(Math.abs(mean(x))).toBeLessThan(0.01)
    expect(rms(x)).toBeCloseTo(1 / Math.sqrt(3), 2)
  })

  it('rosa y marrón no tienen valores raros ni se desplazan del cero', () => {
    for (const make of [pinkNoise, brownNoise]) {
      const x = make(n, seededRandom(2))
      expect(allFinite(x)).toBe(true)
      expect(peak(x)).toBeLessThan(2)
      expect(rms(x)).toBeGreaterThan(0.01)
      expect(Math.abs(mean(x))).toBeLessThan(0.1)
    }
  })

  it('cuanto más «oscuro» el ruido, más se parecen las muestras seguidas (blanco < rosa < marrón)', () => {
    const white = lagOneCorrelation(whiteNoise(n, seededRandom(3)))
    const pink = lagOneCorrelation(pinkNoise(n, seededRandom(3)))
    const brown = lagOneCorrelation(brownNoise(n, seededRandom(3)))
    expect(Math.abs(white)).toBeLessThan(0.05)
    expect(pink).toBeGreaterThan(0.5)
    expect(brown).toBeGreaterThan(0.95)
    expect(white).toBeLessThan(pink)
    expect(pink).toBeLessThan(brown)
  })

  it('acepta longitudes vacías', () => {
    expect(whiteNoise(0, Math.random)).toHaveLength(0)
    expect(pinkNoise(-5, Math.random)).toHaveLength(0)
  })
})

describe('filtros', () => {
  it('el paso bajo suaviza (menos saltos entre muestras)', () => {
    const x = whiteNoise(SR, seededRandom(4))
    const before = typicalStep(x)
    lowpass(x, 500, SR)
    expect(typicalStep(x)).toBeLessThan(before / 4)
    expect(allFinite(x)).toBe(true)
  })

  it('el paso alto quita el desplazamiento de cero', () => {
    const x = new Float32Array(SR).fill(0.5)
    highpass(x, 50, SR)
    expect(Math.abs(x[x.length - 1])).toBeLessThan(1e-3)
  })
})

describe('seamlessLoop', () => {
  it('empalma el final con el principio sin salto, incluso en un ruido grave', () => {
    const loop = SR * 2
    const raw = brownNoise(loop + SR / 2, seededRandom(5))
    const out = seamlessLoop(raw, loop)
    expect(out).toHaveLength(loop)
    const seam = Math.abs(out[0] - out[loop - 1])
    expect(seam).toBeLessThanOrEqual(maxStep(out))
    // Cortar sin fundido deja un salto mucho mayor de lo normal en este ruido.
    const naive = Math.abs(raw[0] - raw[loop - 1])
    expect(naive).toBeGreaterThan(maxStep(raw.subarray(0, loop)))
  })

  it('el fundido mantiene el volumen (igual potencia)', () => {
    const loop = SR
    const raw = whiteNoise(loop * 2, seededRandom(6))
    const out = seamlessLoop(raw, loop)
    const fadeZone = rms(out.subarray(0, loop))
    expect(fadeZone / rms(raw)).toBeGreaterThan(0.93)
    expect(fadeZone / rms(raw)).toBeLessThan(1.07)
  })

  it('sin trozo de sobra solo recorta', () => {
    const raw = Float32Array.from([1, 2, 3])
    expect(Array.from(seamlessLoop(raw, 3))).toEqual([1, 2, 3])
    expect(Array.from(seamlessLoop(raw, 2))).toEqual([3, 2])
  })
})

describe('slowWobble', () => {
  it('se mueve alrededor de 1, dentro del margen y es periódico', () => {
    const n = SR * 4
    const w = slowWobble(n, seededRandom(7), 0.2)
    expect(allFinite(w)).toBe(true)
    expect(w.reduce((m, v) => Math.max(m, v), -Infinity)).toBeLessThanOrEqual(1.2 + 1e-6)
    expect(w.reduce((m, v) => Math.min(m, v), Infinity)).toBeGreaterThanOrEqual(0.8 - 1e-6)
    expect(Math.abs(mean(w) - 1)).toBeLessThan(0.05)
    expect(Math.abs(w[0] - w[n - 1])).toBeLessThan(0.001)
  })
})

describe('sonoridad', () => {
  it('a igual energía, el ruido blanco suena más fuerte que el marrón', () => {
    const white = scaleToRms(whiteNoise(SR * 2, seededRandom(8)), 0.2)
    const brown = scaleToRms(brownNoise(SR * 2, seededRandom(8)), 0.2)
    expect(loudness([white], SR)).toBeGreaterThan(loudness([brown], SR) * 2)
  })

  it('normalizeLoudness lleva a la sonoridad pedida sin pasarse del pico', () => {
    const channels = [whiteNoise(SR, seededRandom(9)), whiteNoise(SR, seededRandom(10))]
    normalizeLoudness(channels, SR, 0.1, 0.9)
    expect(loudness(channels, SR)).toBeCloseTo(0.1, 3)
    expect(Math.max(...channels.map(peak))).toBeLessThanOrEqual(0.9)
  })

  it('nunca pasa del pico aunque se pida mucha sonoridad', () => {
    const channels = [brownNoise(SR, seededRandom(11))]
    normalizeLoudness(channels, SR, 5, 0.9, 1.5)
    expect(peak(channels[0])).toBeLessThanOrEqual(0.9)
    expect(allFinite(channels[0])).toBe(true)
  })

  it('el silencio se queda en silencio (sin dividir entre cero)', () => {
    const channels = [new Float32Array(100)]
    normalizeLoudness(channels, SR, 0.2, 0.9)
    expect(channels[0].every((v) => v === 0)).toBe(true)
  })
})

describe('softLimit', () => {
  it('no toca lo pequeño y redondea los picos sin pasar del techo', () => {
    const x = Float32Array.from([0, 0.3, -0.5, 0.95, -3, 50])
    softLimit(x, 0.9, 0.6)
    expect(x[1]).toBeCloseTo(0.3, 6)
    expect(x[2]).toBeCloseTo(-0.5, 6)
    expect(x[3]).toBeGreaterThan(0.6)
    expect(x[3]).toBeLessThan(0.9)
    expect(x[4]).toBeGreaterThanOrEqual(-0.9)
    expect(x[4]).toBeLessThan(-0.6)
    expect(x[5]).toBeLessThanOrEqual(0.9)
  })
})
