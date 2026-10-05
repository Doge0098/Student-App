import { parseMusicInput, type MusicSource } from '../../lib/web'
import type { Station } from './MusicContext'

export const DEFAULT_STATIONS: Station[] = [
  { id: 'lofi-girl', name: 'Lofi Girl · radio para estudiar', url: 'https://www.youtube.com/watch?v=jfKfPfyJRdk' },
  { id: 'synthwave', name: 'Synthwave radio · para concentrarte', url: 'https://www.youtube.com/watch?v=4xDzrJKXOOY' },
  { id: 'chillhop', name: 'Chillhop Radio · jazzy & lofi', url: 'https://www.youtube.com/watch?v=5yx6BWlEVcY' },
]

/**
 * Quita lo que no es de YouTube (p. ej. listas de Spotify guardadas antes). Devuelve lo mismo si no hay
 * nada que quitar. Si solo había Spotify o los datos no son una lista, vuelven las de serie.
 */
export function cleanMusicData(source: unknown, stations: unknown): { source: MusicSource | null; stations: Station[] } {
  const isYouTube = (url: unknown) => typeof url === 'string' && parseMusicInput(url)?.provider === 'youtube'
  const cleanSource = source && (source as MusicSource).provider === 'youtube' ? (source as MusicSource) : null
  if (!Array.isArray(stations)) return { source: cleanSource, stations: DEFAULT_STATIONS }
  const list = stations as Station[]
  const kept = list.filter((s) => s && typeof s.id === 'string' && typeof s.name === 'string' && isYouTube(s.url))
  if (kept.length === list.length) return { source: cleanSource, stations: list }
  return { source: cleanSource, stations: kept.length > 0 ? kept : DEFAULT_STATIONS }
}
