import { useEffect, useRef } from 'react'
import type { SpotifyKind } from '../../lib/web'
import { useMusic } from './MusicContext'
import { loadSpotifyApi, type SpotifyController } from './providers'

interface SpotifyPlayerProps {
  kind: SpotifyKind
  id: string
}

export function SpotifyPlayer({ kind, id }: SpotifyPlayerProps) {
  const { autoplay, report, registerControls } = useMusic()
  const hostRef = useRef<HTMLDivElement>(null)
  const autoplayRef = useRef(autoplay)
  useEffect(() => {
    autoplayRef.current = autoplay
  }, [autoplay])
  // Las listas y álbumes se ven más altos para poder elegir canción.
  const height = kind === 'track' || kind === 'episode' ? 152 : 352

  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    let controller: SpotifyController | null = null
    let cancelled = false
    const mount = document.createElement('div')
    host.appendChild(mount)

    loadSpotifyApi()
      .then((api) => {
        if (cancelled) return
        api.createController(mount, { uri: `spotify:${kind}:${id}`, width: '100%', height }, (c) => {
          if (cancelled) {
            c.destroy()
            return
          }
          controller = c
          let paused = true
          registerControls({
            play: () => c.play(),
            toggle: () => c.togglePlay(),
            // pause/resume no existen en todas las versiones del reproductor: si faltan, se usa togglePlay.
            pause: () => {
              if (typeof c.pause === 'function') c.pause()
              else if (!paused) c.togglePlay()
            },
            resume: () => {
              if (typeof c.resume === 'function') c.resume()
              else if (paused) c.togglePlay()
            },
          })
          report({ error: null })
          c.addListener('ready', () => {
            if (autoplayRef.current) c.play()
          })
          c.addListener('playback_update', (e) => {
            if (e.data?.isPaused === undefined) return
            paused = e.data.isPaused
            report({ isPlaying: !paused })
          })
        })
      })
      .catch(() => report({ error: 'No se pudo cargar Spotify. Revisa tu conexión.' }))

    return () => {
      cancelled = true
      registerControls(null)
      controller?.destroy()
      host.replaceChildren()
    }
  }, [kind, id, height, report, registerControls])

  return <div ref={hostRef} className="player-frame player-spotify" style={{ height }} />
}
