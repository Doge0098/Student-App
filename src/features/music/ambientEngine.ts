/*
 * Reproductor de sonidos ambiente con la Web Audio API.
 * Cada sonido es un bucle (AudioBuffer) que se genera una vez y se guarda mientras la página está abierta.
 * Entra y sale con fundidos suaves (nunca hay chasquidos) y al cambiar de sonido se funden uno en otro.
 */
import { generateAmbientAsync } from './ambientGenerate'
import { ambientSampleRate, volumeToGain, type AmbientId } from './ambientSounds'

const FADE_IN_S = 1.6
const FADE_OUT_S = 1.2
/** Suavizado del volumen al mover el deslizador. */
const VOLUME_SMOOTHING_S = 0.04
/** Bucles generados que se guardan (cada uno ocupa unos megas). */
const MAX_CACHED = 2

export interface AmbientEngine {
  /** Lo que debería estar sonando ahora (aunque aún se esté generando). */
  readonly current: AmbientId | null
  /**
   * Empieza a sonar (o cambia a otro sonido con un fundido). La primera vez debe llamarse desde un clic:
   * el navegador solo deja sonar audio tras una interacción. Devuelve false si no hay Web Audio.
   */
  play: (id: AmbientId, volume: number) => boolean
  /** Para con un fundido. keepAwake deja el audio preparado para volver sin otro clic (descansos). */
  stop: (options?: { keepAwake?: boolean }) => void
  setVolume: (volume: number) => void
  dispose: () => void
}

interface Voice {
  id: AmbientId
  source: AudioBufferSourceNode
  gain: GainNode
}

type AudioContextConstructor = typeof AudioContext

function audioContextClass(): AudioContextConstructor | undefined {
  if (typeof window === 'undefined') return undefined
  return window.AudioContext ?? (window as Window & { webkitAudioContext?: AudioContextConstructor }).webkitAudioContext
}

/** Lleva un parámetro a un valor en línea recta, partiendo de donde esté ahora (sin saltos). */
function rampTo(param: AudioParam, value: number, now: number, seconds: number): void {
  if (typeof param.cancelAndHoldAtTime === 'function') {
    param.cancelAndHoldAtTime(now)
  } else {
    const current = param.value
    param.cancelScheduledValues(now)
    param.setValueAtTime(current, now)
  }
  param.linearRampToValueAtTime(value, now + seconds)
}

export function createAmbientEngine(options: { onError?: (id: AmbientId) => void } = {}): AmbientEngine {
  let ctx: AudioContext | null = null
  let master: GainNode | null = null
  let voice: Voice | null = null
  let wanted: AmbientId | null = null
  let volume = 50
  let suspendWhenQuiet = false
  const buffers = new Map<AmbientId, AudioBuffer>()
  const loading = new Map<AmbientId, Promise<AudioBuffer>>()

  // Si el sistema corta el audio mientras suena (llamada, otra app…), vuelve con el siguiente toque.
  const resumeOnTouch = () => {
    if (ctx && wanted && ctx.state !== 'running') void ctx.resume().catch(() => {})
  }

  function open(): AudioContext | null {
    if (ctx) return ctx
    const Ctor = audioContextClass()
    if (!Ctor) return null
    try {
      const c = new Ctor()
      const g = c.createGain()
      g.gain.value = volumeToGain(volume)
      g.connect(c.destination)
      ctx = c
      master = g
      window.addEventListener('pointerdown', resumeOnTouch)
      window.addEventListener('keydown', resumeOnTouch)
      return c
    } catch {
      return null
    }
  }

  function remember(id: AmbientId, buffer: AudioBuffer) {
    buffers.delete(id)
    buffers.set(id, buffer)
    while (buffers.size > MAX_CACHED) {
      const oldest = buffers.keys().next().value
      if (oldest === undefined) break
      buffers.delete(oldest)
    }
  }

  function load(c: AudioContext, id: AmbientId): Promise<AudioBuffer> {
    const running = loading.get(id)
    if (running) return running
    const rate = ambientSampleRate(id, c.sampleRate)
    const promise = generateAmbientAsync(id, rate)
      .then((channels) => {
        const buffer = c.createBuffer(channels.length, channels[0].length, rate)
        channels.forEach((data, i) => buffer.getChannelData(i).set(data))
        remember(id, buffer)
        return buffer
      })
      .finally(() => loading.delete(id))
    loading.set(id, promise)
    return promise
  }

  /** Apaga una voz con un fundido y la desconecta al acabar. */
  function release(v: Voice, seconds: number) {
    const c = ctx
    if (!c) return
    const now = c.currentTime
    rampTo(v.gain.gain, 0, now, seconds)
    v.source.onended = () => {
      v.source.disconnect()
      v.gain.disconnect()
      // Sin nada sonando, se duerme el audio para no gastar batería.
      if (!wanted && !voice && suspendWhenQuiet && ctx === c && c.state === 'running') void c.suspend().catch(() => {})
    }
    try {
      v.source.stop(now + seconds + 0.05)
    } catch {
      /* ya estaba parada */
    }
  }

  function start(c: AudioContext, id: AmbientId, buffer: AudioBuffer) {
    if (!master) return
    const source = c.createBufferSource()
    source.buffer = buffer
    source.loop = true
    const gain = c.createGain()
    source.connect(gain)
    gain.connect(master)
    const now = c.currentTime
    gain.gain.setValueAtTime(0, now)
    gain.gain.linearRampToValueAtTime(1, now + FADE_IN_S)
    // Cada vez empieza en un punto distinto del bucle.
    source.start(now, Math.random() * buffer.duration)
    if (voice) release(voice, FADE_IN_S)
    voice = { id, source, gain }
  }

  function setVolume(next: number) {
    volume = next
    if (ctx && master) master.gain.setTargetAtTime(volumeToGain(next), ctx.currentTime, VOLUME_SMOOTHING_S)
  }

  return {
    get current() {
      return wanted
    },

    play(id, nextVolume) {
      const c = open()
      if (!c) return false
      suspendWhenQuiet = false
      if (c.state !== 'running') void c.resume().catch(() => {})
      setVolume(nextVolume)
      wanted = id
      if (voice?.id === id) return true
      const cached = buffers.get(id)
      if (cached) {
        remember(id, cached)
        start(c, id, cached)
        return true
      }
      // Mientras se genera, lo que sonaba sigue sonando; luego se funden.
      load(c, id).then(
        (buffer) => {
          if (wanted === id && ctx === c && voice?.id !== id) start(c, id, buffer)
        },
        () => {
          if (wanted !== id) return
          wanted = null
          if (voice) release(voice, FADE_OUT_S)
          voice = null
          options.onError?.(id)
        },
      )
      return true
    },

    stop(stopOptions) {
      wanted = null
      suspendWhenQuiet = !stopOptions?.keepAwake
      if (voice) release(voice, FADE_OUT_S)
      voice = null
    },

    setVolume,

    dispose() {
      wanted = null
      if (voice) {
        try {
          voice.source.stop()
        } catch {
          /* ya estaba parada */
        }
      }
      voice = null
      buffers.clear()
      loading.clear()
      if (typeof window !== 'undefined') {
        window.removeEventListener('pointerdown', resumeOnTouch)
        window.removeEventListener('keydown', resumeOnTouch)
      }
      if (ctx) void ctx.close().catch(() => {})
      ctx = null
      master = null
    },
  }
}
