import { hostMatches } from './text'
import { musicSourceUrl, parseMusicInput } from './web'

/**
 * Pide el título real de un vídeo o lista a YouTube o Vimeo
 * (sus servicios oEmbed son públicos y no necesitan cuenta).
 */
export async function fetchTitle(link: string, signal?: AbortSignal): Promise<string | null> {
  return (await fetchMeta(link, signal))?.title ?? null
}

export interface LinkMeta {
  title: string | null
  /** Portada (https) si el servicio la da. */
  thumbnail: string | null
}

export async function fetchMeta(link: string, signal?: AbortSignal): Promise<LinkMeta | null> {
  let endpoint: string | null = null
  const music = parseMusicInput(link)
  if (music?.provider === 'youtube') {
    endpoint = `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(musicSourceUrl(music))}`
  } else {
    try {
      if (hostMatches(new URL(link).hostname, 'vimeo.com')) {
        endpoint = `https://vimeo.com/api/oembed.json?url=${encodeURIComponent(link)}`
      }
    } catch {
      return null
    }
  }
  if (!endpoint) return null

  try {
    const res = await fetch(endpoint, { signal })
    if (!res.ok) return null
    const data = (await res.json()) as { title?: unknown; thumbnail_url?: unknown }
    const title = typeof data.title === 'string' && data.title.trim() ? data.title.trim() : null
    const thumbnail = typeof data.thumbnail_url === 'string' && data.thumbnail_url.startsWith('https://') ? data.thumbnail_url : null
    return title || thumbnail ? { title, thumbnail } : null
  } catch {
    return null
  }
}
