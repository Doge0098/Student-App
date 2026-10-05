import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { usePersistentState } from '../../hooks/usePersistentState'
import { fetchTitle } from '../../lib/oembed'
import { uid } from '../../lib/text'
import { musicSourceUrl, parseMusicInput, type MusicSource } from '../../lib/web'
import { AmbientProvider } from './AmbientContext'
import { useAutoPause } from './useAutoPause'

export interface PlayerControls {
  play: () => void
  toggle: () => void
  /** Pausa si está sonando (no hace nada si ya está en pausa). */
  pause: () => void
  /** Sigue desde donde se pausó. Si no lo hay, se usa play. */
  resume?: () => void
  next?: () => void
  prev?: () => void
  setVolume?: (volume: number) => void
}

export interface Station {
  id: string
  name: string
  url: string
}

export interface PlayerReport {
  isPlaying?: boolean
  title?: string
  error?: string | null
}

interface MusicContextValue {
  source: MusicSource | null
  /** Se pone a true cuando el estudiante elige algo, para que empiece a sonar sin otro clic. */
  autoplay: boolean
  isPlaying: boolean
  title: string
  error: string | null
  canSkip: boolean
  volume: number
  stations: Station[]
  play: (link: string) => boolean
  toggle: () => void
  /** Pausa lo que suena (lo usa «Pausar en los descansos»). */
  pause: () => void
  /** Sigue desde donde se pausó. */
  resume: () => void
  next: () => void
  prev: () => void
  setVolume: (volume: number) => void
  addStation: (link: string, name?: string) => Promise<boolean>
  removeStation: (id: string) => void
  /* Para los reproductores */
  report: (update: PlayerReport) => void
  registerControls: (controls: PlayerControls | null) => void
}

const DEFAULT_STATIONS: Station[] = [
  { id: 'lofi-girl', name: 'Lofi Girl · radio para estudiar', url: 'https://www.youtube.com/watch?v=jfKfPfyJRdk' },
  { id: 'deep-focus', name: 'Deep Focus', url: 'https://open.spotify.com/playlist/37i9dQZF1DWZeKCadgRdKQ' },
  { id: 'lofi-beats', name: 'lofi beats', url: 'https://open.spotify.com/playlist/37i9dQZF1DWWQRwui0ExPn' },
  { id: 'intense-studying', name: 'Intense Studying', url: 'https://open.spotify.com/playlist/37i9dQZF1DX8NTLI2TtZa6' },
]

const MusicContext = createContext<MusicContextValue | null>(null)

/** Música (YouTube, Spotify) y sonidos ambiente, con la pausa automática de los descansos. Va dentro de TimerProvider. */
export function MusicProvider({ children }: { children: ReactNode }) {
  return (
    <AmbientProvider>
      <MusicStateProvider>{children}</MusicStateProvider>
    </AmbientProvider>
  )
}

function MusicStateProvider({ children }: { children: ReactNode }) {
  const [source, setSource] = usePersistentState<MusicSource | null>('music-source', null)
  const [stations, setStations] = usePersistentState<Station[]>('music-stations', DEFAULT_STATIONS)
  const [volume, setVolumeState] = usePersistentState('music-volume', 70)
  const [autoplay, setAutoplay] = useState(false)
  const [isPlaying, setIsPlaying] = useState(false)
  const [title, setTitle] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [canSkip, setCanSkip] = useState(false)
  const controls = useRef<PlayerControls | null>(null)

  // Título inicial desde oEmbed; el reproductor de YouTube lo actualiza con cada canción.
  useEffect(() => {
    if (!source) return
    const abort = new AbortController()
    void fetchTitle(musicSourceUrl(source), abort.signal).then((t) => {
      if (t) setTitle((current) => current || t)
    })
    return () => abort.abort()
  }, [source])

  const sourceUrl = source ? musicSourceUrl(source) : null
  const play = useCallback(
    (link: string) => {
      const parsed = parseMusicInput(link)
      if (!parsed) return false
      if (musicSourceUrl(parsed) === sourceUrl && controls.current) {
        controls.current.play()
        return true
      }
      setTitle('')
      setError(null)
      setAutoplay(true)
      setSource(parsed)
      return true
    },
    [setSource, sourceUrl],
  )

  const addStation = useCallback(
    async (link: string, name?: string) => {
      const parsed = parseMusicInput(link)
      if (!parsed) return false
      const url = musicSourceUrl(parsed)
      const finalName = name?.trim() || (await fetchTitle(url)) || 'Mi lista'
      setStations((prev) => [{ id: uid(), name: finalName, url }, ...prev.filter((s) => s.url !== url)])
      return true
    },
    [setStations],
  )

  const removeStation = useCallback(
    (id: string) => setStations((prev) => prev.filter((s) => s.id !== id)),
    [setStations],
  )

  const report = useCallback((update: PlayerReport) => {
    if (update.isPlaying !== undefined) setIsPlaying(update.isPlaying)
    if (update.title) setTitle(update.title)
    if (update.error !== undefined) setError(update.error)
  }, [])

  const registerControls = useCallback((c: PlayerControls | null) => {
    controls.current = c
    setCanSkip(Boolean(c?.next))
    if (!c) setIsPlaying(false)
  }, [])

  const setVolume = useCallback(
    (v: number) => {
      setVolumeState(v)
      controls.current?.setVolume?.(v)
    },
    [setVolumeState],
  )

  const pause = useCallback(() => controls.current?.pause(), [])
  const resume = useCallback(() => {
    const c = controls.current
    if (c) (c.resume ?? c.play)()
  }, [])

  useAutoPause({ isPlaying, sourceKey: sourceUrl, pause, resume })

  const value = useMemo<MusicContextValue>(
    () => ({
      source,
      autoplay,
      isPlaying,
      title,
      error,
      canSkip,
      volume,
      stations,
      play,
      toggle: () => controls.current?.toggle(),
      pause,
      resume,
      next: () => controls.current?.next?.(),
      prev: () => controls.current?.prev?.(),
      setVolume,
      addStation,
      removeStation,
      report,
      registerControls,
    }),
    [
      source,
      autoplay,
      isPlaying,
      title,
      error,
      canSkip,
      volume,
      stations,
      play,
      pause,
      resume,
      setVolume,
      addStation,
      removeStation,
      report,
      registerControls,
    ],
  )

  return <MusicContext.Provider value={value}>{children}</MusicContext.Provider>
}

// oxlint-disable-next-line react/only-export-components
export function useMusic(): MusicContextValue {
  const ctx = useContext(MusicContext)
  if (!ctx) throw new Error('useMusic debe usarse dentro de <MusicProvider>')
  return ctx
}
