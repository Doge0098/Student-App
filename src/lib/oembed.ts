import { hostMatches } from './text'
import { musicSourceUrl, parseMusicInput } from './web'

/**
 * Pide el título real de un vídeo o lista a YouTube, Spotify o Vimeo
 * (sus servicios oEmbed son públicos y no necesitan cuenta).
 */
export async function fetchTitle(link: string, signal?: AbortSignal): Promise<string | null> {
  let endpoint: string | null = null
  const music = parseMusicInput(link)
  if (music?.provider === 'youtube') {
    endpoint = `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(musicSourceUrl(music))}`
  } else if (music?.provider === 'spotify') {
    endpoint = `https://open.spotify.com/oembed?url=${encodeURIComponent(musicSourceUrl(music))}`
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
    const data: unknown = await res.json()
    const title = (data as { title?: unknown }).title
    return typeof title === 'string' && title.trim() ? title.trim() : null
  } catch {
    return null
  }
}
