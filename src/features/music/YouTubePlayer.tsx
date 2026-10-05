import { useEffect, useRef } from 'react'
import { useMusic } from './MusicContext'
import { loadYouTubeApi, type YTPlayer } from './providers'

interface YouTubePlayerProps {
  videoId?: string
  listId?: string
}

const ERRORS: Record<number, string> = {
  2: 'El enlace de YouTube no es válido.',
  5: 'Este vídeo no se puede reproducir aquí.',
  100: 'El vídeo no existe o es privado.',
  101: 'El autor no permite reproducir este vídeo fuera de YouTube.',
  150: 'El autor no permite reproducir este vídeo fuera de YouTube.',
}

export function YouTubePlayer({ videoId, listId }: YouTubePlayerProps) {
  const { autoplay, volume, report, registerControls } = useMusic()
  const hostRef = useRef<HTMLDivElement>(null)
  // Valores que solo importan al crear el reproductor; no deben recrearlo al cambiar.
  const initial = useRef({ autoplay, volume })
  useEffect(() => {
    initial.current = { autoplay, volume }
  }, [autoplay, volume])

  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    let player: YTPlayer | null = null
    let playing = false
    let cancelled = false
    // La API de YouTube sustituye el elemento por un iframe, así que se le da uno propio fuera de React.
    const mount = document.createElement('div')
    host.appendChild(mount)

    loadYouTubeApi()
      .then((YT) => {
        if (cancelled) return
        player = new YT.Player(mount, {
          width: '100%',
          height: '100%',
          videoId,
          playerVars: {
            ...(listId ? { list: listId, listType: 'playlist' } : {}),
            rel: 0,
            playsinline: 1,
            origin: window.location.origin,
          },
          events: {
            onReady: (e) => {
              const p = e.target
              p.setVolume(initial.current.volume)
              registerControls({
                play: () => p.playVideo(),
                toggle: () => (playing ? p.pauseVideo() : p.playVideo()),
                next: listId ? () => p.nextVideo() : undefined,
                prev: listId ? () => p.previousVideo() : undefined,
                setVolume: (v) => p.setVolume(v),
              })
              report({ error: null, title: p.getVideoData().title || undefined })
              if (initial.current.autoplay) p.playVideo()
            },
            onStateChange: (e) => {
              playing = e.data === YT.PlayerState.PLAYING || e.data === YT.PlayerState.BUFFERING
              report({ isPlaying: playing, title: e.target.getVideoData().title || undefined })
            },
            onError: (e) => report({ isPlaying: false, error: ERRORS[e.data] ?? 'No se pudo reproducir este vídeo.' }),
          },
        })
      })
      .catch(() => report({ error: 'No se pudo cargar YouTube. Revisa tu conexión.' }))

    return () => {
      cancelled = true
      registerControls(null)
      player?.destroy()
      host.replaceChildren()
    }
  }, [videoId, listId, report, registerControls])

  return <div ref={hostRef} className="player-frame player-video" />
}
