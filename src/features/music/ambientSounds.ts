/*
 * Sonidos ambiente generados en el momento: sin archivos de audio, sin anuncios y funcionan sin internet.
 * Cada receta devuelve dos canales (estéreo) que se repiten en bucle sin que se note el empalme.
 */
import {
  brownNoise,
  highpass,
  lowpass,
  normalizeLoudness,
  onePoleCoefficient,
  pinkNoise,
  scaleToRms,
  seamlessLoop,
  slowWobble,
  whiteNoise,
  type Rand,
} from './dsp'

export type AmbientId = 'lluvia' | 'olas' | 'chimenea' | 'blanco' | 'rosa' | 'marron'

interface AmbientSound {
  label: string
  /** Duración del bucle: cuanto más largo, menos se nota que se repite. */
  seconds: number
  /** Frecuencia de muestreo máxima al generarlo: los sonidos apagados no necesitan más y se generan antes. */
  maxSampleRate: number
}

export const AMBIENT_SOUNDS: Record<AmbientId, AmbientSound> = {
  lluvia: { label: 'Lluvia', seconds: 14, maxSampleRate: 32000 },
  olas: { label: 'Olas', seconds: 34, maxSampleRate: 22050 },
  chimenea: { label: 'Chimenea', seconds: 18, maxSampleRate: 32000 },
  blanco: { label: 'Ruido blanco', seconds: 10, maxSampleRate: 48000 },
  rosa: { label: 'Ruido rosa', seconds: 10, maxSampleRate: 48000 },
  marron: { label: 'Ruido marrón', seconds: 10, maxSampleRate: 48000 },
}

export const AMBIENT_IDS = Object.keys(AMBIENT_SOUNDS) as AmbientId[]

export function isAmbientId(value: unknown): value is AmbientId {
  return typeof value === 'string' && Object.hasOwn(AMBIENT_SOUNDS, value)
}

/* ------------------------------------------------------------------ */
/* Ajustes guardados y volumen                                         */
/* ------------------------------------------------------------------ */

export interface AmbientSettings {
  sound: AmbientId
  /** 0 a 100. */
  volume: number
}

export const DEFAULT_AMBIENT: AmbientSettings = { sound: 'lluvia', volume: 50 }

export function clampVolume(value: unknown, fallback = DEFAULT_AMBIENT.volume): number {
  const n = typeof value === 'number' ? value : Number.NaN
  return Number.isFinite(n) ? Math.round(Math.min(100, Math.max(0, n))) : fallback
}

/** Datos guardados de versiones anteriores o editados a mano: se sanean. */
export function sanitizeAmbient(raw: unknown): AmbientSettings {
  const value = raw && typeof raw === 'object' ? (raw as Partial<Record<keyof AmbientSettings, unknown>>) : {}
  return {
    sound: isAmbientId(value.sound) ? value.sound : DEFAULT_AMBIENT.sound,
    volume: clampVolume(value.volume),
  }
}

/** Del deslizador (0-100) a ganancia: curva cuadrática, que el oído nota como un cambio uniforme. */
export function volumeToGain(volume: number): number {
  const v = clampVolume(volume, 0) / 100
  return v * v
}

/** Frecuencia a la que se genera un sonido en un dispositivo concreto. */
export function ambientSampleRate(id: AmbientId, deviceRate: number): number {
  const rate = Number.isFinite(deviceRate) && deviceRate > 0 ? deviceRate : 44100
  return Math.round(Math.max(8000, Math.min(rate, AMBIENT_SOUNDS[id].maxSampleRate)))
}

/* ------------------------------------------------------------------ */
/* Recetas                                                             */
/* ------------------------------------------------------------------ */

/** Sonoridad final de todos los sonidos (parecida entre ellos) y pico máximo permitido. */
export const AMBIENT_LOUDNESS = 0.2
export const AMBIENT_MAX_PEAK = 0.9
/** Cuánto pueden pasarse los picos sueltos antes del limitador suave (ver normalizeLoudness). */
const PEAK_OVERSHOOT = 1.5
/** Segundos que se funden en el empalme del bucle. */
const LOOP_FADE_SECONDS = 0.5

type Recipe = (length: number, sampleRate: number, rand: Rand) => Float32Array[]

function stereo(make: () => Float32Array): Float32Array[] {
  return [make(), make()]
}

/** Ruido de la duración del bucle (más el trozo del fundido), con forma opcional, ya empalmado. */
function loopedNoise(
  make: (length: number, rand: Rand) => Float32Array,
  length: number,
  sampleRate: number,
  rand: Rand,
  shape?: (signal: Float32Array) => void,
): Float32Array {
  const extra = Math.max(1, Math.round(LOOP_FADE_SECONDS * sampleRate))
  const signal = make(length + extra, rand)
  shape?.(signal)
  return seamlessLoop(signal, length)
}

const lerp = ([from, to]: readonly [number, number], t: number) => from + (to - from) * t

interface Impact {
  /** Amplitud mínima y máxima. */
  amp: readonly [number, number]
  /** Cuánto tarda en apagarse (milisegundos). */
  decayMs: readonly [number, number]
  /** Brillo del golpe: frecuencia de corte del filtro (Hz). */
  cutoffHz: readonly [number, number]
  /** Mayor = más golpes flojos y pocos fuertes. */
  skew?: number
}

/**
 * Añade un golpecito corto (una gota, un chasquido): ruido filtrado que se apaga muy rápido.
 * Se coloca «en círculo» (lo que pasa del final sigue por el principio), así el bucle no tiene saltos.
 */
export function addImpact(channels: Float32Array[], sampleRate: number, rand: Rand, start: number, impact: Impact): void {
  const length = channels[0]?.length ?? 0
  if (length === 0) return
  const amp = lerp(impact.amp, rand() ** (impact.skew ?? 2))
  const tau = Math.max(1, (lerp(impact.decayMs, rand()) * sampleRate) / 1000)
  const a = onePoleCoefficient(lerp(impact.cutoffHz, rand()), sampleRate)
  const pan = rand() * (Math.PI / 2)
  const [left, right] = channels
  const stereoImpact = channels.length === 2
  const gainLeft = stereoImpact ? Math.cos(pan) : 1
  const gainRight = Math.sin(pan)
  const decay = Math.exp(-1 / tau)
  const size = Math.min(length, Math.ceil(tau * 7))
  let index = ((Math.floor(start) % length) + length) % length
  let env = amp
  let y = 0
  for (let k = 0; k < size; k++) {
    y += a * (rand() * 2 - 1 - y)
    const value = env * y
    env *= decay
    left[index] += value * gainLeft
    if (stereoImpact) right[index] += value * gainRight
    else for (let c = 1; c < channels.length; c++) channels[c][index] += value
    if (++index === length) index = 0
  }
}

function addImpacts(channels: Float32Array[], sampleRate: number, rand: Rand, count: number, impact: Impact): void {
  const length = channels[0]?.length ?? 0
  for (let i = 0; i < count; i++) addImpact(channels, sampleRate, rand, Math.floor(rand() * length), impact)
}

/**
 * Forma de las olas: suben despacio, rompen y se retiran. Se repite exactamente con el bucle
 * (la última ola acaba donde empieza la primera). Valores entre floor y 1.
 */
export function waveEnvelope(length: number, rand: Rand, count: number, floor = 0.15): Float32Array {
  const env = new Float32Array(Math.max(0, length))
  const waves = Math.max(1, Math.round(count))
  const weights = Array.from({ length: waves }, () => 0.75 + rand() * 0.5)
  const total = weights.reduce((sum, w) => sum + w, 0)
  let start = 0
  let acc = 0
  weights.forEach((weight, j) => {
    acc += weight
    const end = j === waves - 1 ? env.length : Math.round((acc / total) * env.length)
    const size = end - start
    const height = (1 - floor) * (0.6 + rand() * 0.4)
    const attack = 0.3 + rand() * 0.15
    const rise = Math.round(size * attack)
    // Sube despacio hasta romper…
    for (let i = 0; i < rise; i++) {
      const s = (1 - Math.cos((Math.PI * i) / rise)) / 2
      env[start + i] = floor + height * s * Math.sqrt(s)
    }
    // …y se retira con calma hasta el nivel de fondo.
    for (let i = rise; i < size; i++) {
      const f = (1 + Math.cos((Math.PI * (i - rise)) / (size - rise))) / 2
      env[start + i] = floor + height * f * Math.sqrt(f)
    }
    start = end
  })
  return env
}

const rain: Recipe = (length, sampleRate, rand) => {
  const seconds = length / sampleRate
  // Fondo: un «shhh» continuo sin graves ni agudos extremos, que sube y baja muy poco.
  const channels = stereo(() => {
    const bed = loopedNoise(pinkNoise, length, sampleRate, rand, (x) => {
      highpass(x, 450, sampleRate)
      lowpass(x, 6500, sampleRate)
      lowpass(x, 9000, sampleRate)
    })
    scaleToRms(bed, 0.1)
    const wobble = slowWobble(length, rand, 0.12)
    for (let i = 0; i < length; i++) bed[i] *= wobble[i]
    return bed
  })
  // Gotas lejanas: muchas, flojas y apagadas.
  addImpacts(channels, sampleRate, rand, Math.round(seconds * 260), {
    amp: [0.03, 0.2],
    decayMs: [0.4, 1.4],
    cutoffHz: [1200, 3500],
  })
  // Gotas cercanas: pocas y más claras.
  addImpacts(channels, sampleRate, rand, Math.round(seconds * 22), {
    amp: [0.15, 0.7],
    decayMs: [0.8, 3.5],
    cutoffHz: [2500, 7000],
  })
  return channels
}

const waves: Recipe = (length, sampleRate, rand) => {
  const seconds = length / sampleRate
  const env = waveEnvelope(length, rand, seconds / 8.5)
  // La ola llega a un oído un poco después que al otro: se mueve de lado a lado.
  const delay = Math.round(0.35 * sampleRate) % length
  const extra = Math.min(length, Math.max(1, Math.round(LOOP_FADE_SECONDS * sampleRate)))
  return [0, 1].map((channel) => {
    // Envoltura de este oído, desplazada y con el trozo del fundido al final (sigue siendo periódica).
    const level = new Float32Array(length + extra)
    const offset = channel * delay
    for (let i = 0; i < level.length; i++) {
      const j = (i + offset) % length
      level[i] = env[j]
    }
    const surf = pinkNoise(length + extra, rand)
    // Más brillante cuando rompe la ola y más apagado cuando se retira (dos filtros seguidos).
    let a = 0
    let y1 = 0
    let y2 = 0
    for (let i = 0; i < surf.length; i++) {
      if ((i & 31) === 0) a = onePoleCoefficient(180 + 2600 * level[i] * level[i], sampleRate)
      y1 += a * (surf[i] - y1)
      y2 += a * (y1 - y2)
      surf[i] = y2
    }
    const out = scaleToRms(seamlessLoop(surf, length), 0.3)
    for (let i = 0; i < length; i++) out[i] *= level[i]
    // El mar de fondo: un rumor grave que nunca se calla del todo.
    const sea = loopedNoise(brownNoise, length, sampleRate, rand, (x) => {
      highpass(x, 30, sampleRate)
      lowpass(x, 350, sampleRate)
    })
    scaleToRms(sea, 0.05)
    for (let i = 0; i < length; i++) out[i] += sea[i]
    return out
  })
}

const fireplace: Recipe = (length, sampleRate, rand) => {
  const seconds = length / sampleRate
  const channels = stereo(() => {
    // Rumor de las llamas: grave y con un parpadeo lento.
    const roar = loopedNoise(brownNoise, length, sampleRate, rand, (x) => {
      highpass(x, 40, sampleRate)
      lowpass(x, 500, sampleRate)
    })
    scaleToRms(roar, 0.1)
    const flicker = slowWobble(length, rand, 0.35, [2, 3, 5, 7, 11])
    // Siseo suave de la madera.
    const hiss = loopedNoise(pinkNoise, length, sampleRate, rand, (x) => {
      highpass(x, 2500, sampleRate)
      lowpass(x, 8000, sampleRate)
    })
    scaleToRms(hiss, 0.01)
    for (let i = 0; i < length; i++) roar[i] = roar[i] * flicker[i] + hiss[i]
    return roar
  })
  // Chasquidos: llegan en rachas (uno suele traer otros detrás).
  const bursts = Math.round(seconds * 4)
  for (let b = 0; b < bursts; b++) {
    let at = Math.floor(rand() * length)
    const ticks = 1 + Math.floor(rand() ** 1.5 * 6)
    for (let t = 0; t < ticks; t++) {
      addImpact(channels, sampleRate, rand, at, { amp: [0.05, 0.9], decayMs: [0.15, 0.7], cutoffHz: [2500, 9000], skew: 2.5 })
      at += Math.round((0.003 + rand() * 0.04) * sampleRate)
    }
  }
  // Estallidos de la leña: de vez en cuando, más graves y algo más largos.
  addImpacts(channels, sampleRate, rand, Math.round(seconds * 0.35), {
    amp: [0.5, 1.2],
    decayMs: [2, 6],
    cutoffHz: [600, 1800],
    skew: 1,
  })
  return channels
}

const RECIPES: Record<AmbientId, Recipe> = {
  lluvia: rain,
  olas: waves,
  chimenea: fireplace,
  blanco: (length, sampleRate, rand) => stereo(() => loopedNoise(whiteNoise, length, sampleRate, rand)),
  rosa: (length, sampleRate, rand) => stereo(() => loopedNoise(pinkNoise, length, sampleRate, rand)),
  marron: (length, sampleRate, rand) =>
    stereo(() => loopedNoise(brownNoise, length, sampleRate, rand, (x) => highpass(x, 25, sampleRate))),
}

/**
 * Genera un sonido ambiente: dos canales de la duración del bucle, sin saltos al repetirse,
 * con una sonoridad parecida a los demás y sin picos por encima de AMBIENT_MAX_PEAK.
 */
export function generateAmbient(id: AmbientId, sampleRate: number, rand: Rand = Math.random): Float32Array[] {
  const length = Math.max(1, Math.round(AMBIENT_SOUNDS[id].seconds * sampleRate))
  const channels = RECIPES[id](length, sampleRate, rand)
  return normalizeLoudness(channels, sampleRate, AMBIENT_LOUDNESS, AMBIENT_MAX_PEAK, PEAK_OVERSHOOT)
}
