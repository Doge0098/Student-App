import { parseMusicInput } from '../../lib/web'

/**
 * Portada de una lista o canción: la de YouTube se saca del identificador del vídeo (sin pedir nada);
 * la de Spotify se guarda cuando se consulta su oEmbed (`thumb`). Sin portada → null (se pone un icono).
 */
export function coverUrl(link: string, thumb?: string): string | null {
  if (thumb && /^https:\/\//.test(thumb)) return thumb
  const music = parseMusicInput(link)
  if (music?.provider === 'youtube' && music.videoId) return `https://i.ytimg.com/vi/${music.videoId}/hqdefault.jpg`
  return null
}

export type ProviderLabel = 'YouTube Music' | 'Spotify'

/** Los enlaces de YouTube se reproducen con YouTube, pero para el estudiante son «YouTube Music». */
export function providerLabel(link: string): ProviderLabel {
  return parseMusicInput(link)?.provider === 'spotify' ? 'Spotify' : 'YouTube Music'
}
