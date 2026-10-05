/*
 * Piezas de audio puras (sin Web Audio) para generar los sonidos ambiente.
 * Todo trabaja con Float32Array y un generador aleatorio que se le pasa, así se puede probar.
 */

/** Devuelve números en [0, 1), como Math.random. */
export type Rand = () => number

/** Generador pseudoaleatorio pequeño y rápido (mulberry32). Con la misma semilla da lo mismo. */
export function seededRandom(seed: number): Rand {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const noise = (rand: Rand) => rand() * 2 - 1

/** Ruido blanco: todas las frecuencias por igual (entre -1 y 1). */
export function whiteNoise(length: number, rand: Rand): Float32Array {
  const out = new Float32Array(Math.max(0, length))
  for (let i = 0; i < out.length; i++) out[i] = noise(rand)
  return out
}

/** Ruido rosa (filtro de Paul Kellet): la misma energía en cada octava, más suave que el blanco. */
export function pinkNoise(length: number, rand: Rand): Float32Array {
  const out = new Float32Array(Math.max(0, length))
  let b0 = 0
  let b1 = 0
  let b2 = 0
  let b3 = 0
  let b4 = 0
  let b5 = 0
  let b6 = 0
  // Se calienta el filtro antes de guardar nada, para que no empiece con un hueco.
  for (let i = -4096; i < out.length; i++) {
    const w = noise(rand)
    b0 = 0.99886 * b0 + w * 0.0555179
    b1 = 0.99332 * b1 + w * 0.0750759
    b2 = 0.969 * b2 + w * 0.153852
    b3 = 0.8665 * b3 + w * 0.3104856
    b4 = 0.55 * b4 + w * 0.5329522
    b5 = -0.7616 * b5 - w * 0.016898
    const pink = b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362
    b6 = w * 0.115926
    if (i >= 0) out[i] = pink * 0.11
  }
  return out
}

/** Ruido marrón (integrador con pérdidas): graves profundos, como un rumor lejano. */
export function brownNoise(length: number, rand: Rand): Float32Array {
  const out = new Float32Array(Math.max(0, length))
  let last = 0
  for (let i = -1024; i < out.length; i++) {
    last = (last + 0.02 * noise(rand)) / 1.02
    if (i >= 0) out[i] = last * 3.5
  }
  return out
}

/** Coeficiente de un filtro de un polo para una frecuencia de corte (siempre entre 0 y 1). */
export function onePoleCoefficient(cutoffHz: number, sampleRate: number): number {
  return 1 - Math.exp((-2 * Math.PI * Math.max(0, cutoffHz)) / sampleRate)
}

/** Paso bajo de un polo, en el sitio: quita agudos. */
export function lowpass(signal: Float32Array, cutoffHz: number, sampleRate: number): Float32Array {
  const a = onePoleCoefficient(cutoffHz, sampleRate)
  let y = 0
  for (let i = 0; i < signal.length; i++) {
    y += a * (signal[i] - y)
    signal[i] = y
  }
  return signal
}

/** Paso alto de un polo, en el sitio: quita graves (y cualquier desplazamiento de cero). */
export function highpass(signal: Float32Array, cutoffHz: number, sampleRate: number): Float32Array {
  const a = onePoleCoefficient(cutoffHz, sampleRate)
  let y = 0
  for (let i = 0; i < signal.length; i++) {
    y += a * (signal[i] - y)
    signal[i] -= y
  }
  return signal
}

/**
 * Convierte una señal en un bucle sin saltos. La señal trae de más el trozo que se funde:
 * el principio del bucle pasa poco a poco de «lo que venía después del final» a su propio comienzo,
 * con un fundido de igual potencia (el volumen no baja a mitad del fundido).
 */
export function seamlessLoop(signal: Float32Array, loopLength: number): Float32Array {
  const length = Math.max(0, Math.min(loopLength, signal.length))
  const out = signal.slice(0, length)
  const fade = Math.min(signal.length - length, length)
  for (let i = 0; i < fade; i++) {
    const angle = (i / fade) * (Math.PI / 2)
    out[i] = signal[length + i] * Math.cos(angle) + signal[i] * Math.sin(angle)
  }
  return out
}

/**
 * Subidas y bajadas lentas de volumen (1 ± depth) que se repiten exactamente con el bucle,
 * para que el sonido «respire» sin notarse dónde empieza.
 */
export function slowWobble(length: number, rand: Rand, depth: number, harmonics: number[] = [1, 2, 3, 5]): Float32Array {
  const out = new Float32Array(Math.max(0, length))
  if (out.length === 0) return out
  const parts = harmonics.map((harmonic) => ({ harmonic, phase: rand() * 2 * Math.PI, weight: 0.5 + rand() }))
  const total = parts.reduce((sum, p) => sum + p.weight, 0) || 1
  const at = (i: number) => {
    let v = 0
    for (const p of parts) v += p.weight * Math.sin((2 * Math.PI * p.harmonic * i) / out.length + p.phase)
    return 1 + (depth * v) / total
  }
  // Se calcula cada pocos puntos y se interpola: es lento y así va mucho más rápido.
  const step = 64
  for (let start = 0; start < out.length; start += step) {
    const from = at(start)
    const to = at(start + step)
    const end = Math.min(step, out.length - start)
    for (let k = 0; k < end; k++) out[start + k] = from + ((to - from) * k) / step
  }
  return out
}

export function rms(signal: Float32Array): number {
  if (signal.length === 0) return 0
  let sum = 0
  for (let i = 0; i < signal.length; i++) sum += signal[i] * signal[i]
  return Math.sqrt(sum / signal.length)
}

export function peak(signal: Float32Array): number {
  let max = 0
  for (let i = 0; i < signal.length; i++) {
    const v = Math.abs(signal[i])
    if (v > max) max = v
  }
  return max
}

export function mean(signal: Float32Array): number {
  if (signal.length === 0) return 0
  let sum = 0
  for (let i = 0; i < signal.length; i++) sum += signal[i]
  return sum / signal.length
}

/** Multiplica la señal (en el sitio). */
export function scale(signal: Float32Array, gain: number): Float32Array {
  for (let i = 0; i < signal.length; i++) signal[i] *= gain
  return signal
}

/** Ajusta la señal (en el sitio) a un volumen medio dado. Una señal muda se deja como está. */
export function scaleToRms(signal: Float32Array, target: number): Float32Array {
  const current = rms(signal)
  return current > 0 ? scale(signal, target / current) : signal
}

/**
 * Potencia media «como la oímos»: los graves profundos cuentan menos y los agudos algo más
 * (parecido a la ponderación K de la medida de sonoridad, simplificada). Una sola pasada, sin copias.
 */
function weightedPower(signal: Float32Array, sampleRate: number): number {
  if (signal.length === 0) return 0
  const low = onePoleCoefficient(100, sampleRate)
  const mid = onePoleCoefficient(1500, sampleRate)
  const shelf = 10 ** (4 / 20) - 1
  let lp1 = 0
  let lp2 = 0
  let lp3 = 0
  let sum = 0
  for (let i = 0; i < signal.length; i++) {
    // Dos pasos altos a 100 Hz…
    lp1 += low * (signal[i] - lp1)
    const hp1 = signal[i] - lp1
    lp2 += low * (hp1 - lp2)
    const hp2 = hp1 - lp2
    // …y +4 dB por encima de 1,5 kHz.
    lp3 += mid * (hp2 - lp3)
    const y = hp2 + shelf * (hp2 - lp3)
    sum += y * y
  }
  return sum / signal.length
}

/** Sonoridad aproximada de uno o varios canales. */
export function loudness(channels: Float32Array[], sampleRate: number): number {
  if (channels.length === 0) return 0
  let power = 0
  for (const channel of channels) power += weightedPower(channel, sampleRate)
  return Math.sqrt(power / channels.length)
}

/**
 * Limitador suave (en el sitio): por debajo de knee no toca nada y por encima redondea los picos
 * para que nunca pasen de ceiling, sin cortes bruscos.
 */
export function softLimit(signal: Float32Array, ceiling: number, knee = ceiling * 0.7): Float32Array {
  const room = ceiling - knee
  if (!(room > 0)) {
    for (let i = 0; i < signal.length; i++) signal[i] = Math.max(-ceiling, Math.min(ceiling, signal[i]))
    return signal
  }
  for (let i = 0; i < signal.length; i++) {
    const v = signal[i]
    const a = Math.abs(v)
    if (a > knee) signal[i] = Math.sign(v) * (knee + room * Math.tanh((a - knee) / room))
  }
  return signal
}

/**
 * Deja todos los sonidos con una sonoridad parecida (en el sitio), sin que ningún pico pase de maxPeak.
 * Así el ruido blanco no suena mucho más fuerte que el marrón con el mismo volumen.
 * Los picos sueltos (una ola que rompe, un chasquido) pueden subir hasta `overshoot` veces el máximo
 * antes de redondearse con el limitador suave, para que los sonidos con mucho contraste no queden flojos.
 */
export function normalizeLoudness(
  channels: Float32Array[],
  sampleRate: number,
  target: number,
  maxPeak: number,
  overshoot = 1,
): Float32Array[] {
  const current = loudness(channels, sampleRate)
  const top = Math.max(0, ...channels.map(peak))
  if (!(current > 0) || !(top > 0)) return channels
  const gain = Math.min(target / current, (maxPeak * Math.max(1, overshoot)) / top)
  for (const channel of channels) {
    scale(channel, gain)
    softLimit(channel, maxPeak)
  }
  return channels
}

/** Correlación entre muestras seguidas: cerca de 0 en el ruido blanco, cerca de 1 en sonidos graves. */
export function lagOneCorrelation(signal: Float32Array): number {
  const m = mean(signal)
  let num = 0
  let den = 0
  for (let i = 0; i < signal.length; i++) {
    const d = signal[i] - m
    den += d * d
    if (i > 0) num += d * (signal[i - 1] - m)
  }
  return den > 0 ? num / den : 0
}
