import { parseMusicInput } from '../../lib/web'

/**
 * Portada de una lista o canción: la de YouTube se saca del identificador del vídeo (sin pedir nada).
 * Sin portada → null (se pone un icono).
 */
export function coverUrl(link: string): string | null {
  const music = parseMusicInput(link)
  if (music?.provider === 'youtube' && music.videoId) return `https://i.ytimg.com/vi/${music.videoId}/hqdefault.jpg`
  return null
}
