import { createStore } from '../../hooks/store'
import { DEFAULT_AMBIENT, type AmbientSettings } from './ambientSounds'

/** Sonido ambiente elegido y su volumen (se lee siempre con sanitizeAmbient). No se guarda si sonaba: no suena solo al abrir. */
export const ambientStore = createStore<AmbientSettings>('music-ambient', DEFAULT_AMBIENT)

/** «Pausar en los descansos» (activado por defecto). */
export const autoPauseStore = createStore<boolean>('music-auto-pause', true)
