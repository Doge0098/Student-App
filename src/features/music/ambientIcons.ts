import { AudioWaveform, CloudRain, Flame, WavesHorizontal, type LucideIcon } from 'lucide-react'
import type { AmbientId } from './ambientSounds'

/** Icono de cada sonido ambiente (en el mini reproductor de la barra superior). */
export const AMBIENT_ICONS: Record<AmbientId, LucideIcon> = {
  lluvia: CloudRain,
  olas: WavesHorizontal,
  chimenea: Flame,
  blanco: AudioWaveform,
  rosa: AudioWaveform,
  marron: AudioWaveform,
}
