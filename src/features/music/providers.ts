/* Carga bajo demanda las librerías oficiales de los reproductores de YouTube y Spotify. */

export interface YTPlayer {
  playVideo(): void
  pauseVideo(): void
  nextVideo(): void
  previousVideo(): void
  setVolume(volume: number): void
  getVolume(): number
  getVideoData(): { title?: string; author?: string }
  destroy(): void
}

interface YTEvent {
  target: YTPlayer
  data: number
}

export interface YTNamespace {
  Player: new (
    element: HTMLElement,
    options: {
      width?: string | number
      height?: string | number
      videoId?: string
      playerVars?: Record<string, string | number>
      events?: {
        onReady?: (e: YTEvent) => void
        onStateChange?: (e: YTEvent) => void
        onError?: (e: YTEvent) => void
      }
    },
  ) => YTPlayer
  PlayerState: { PLAYING: number; PAUSED: number; ENDED: number; BUFFERING: number }
}

export interface SpotifyController {
  play(): void
  togglePlay(): void
  pause?(): void
  resume?(): void
  destroy(): void
  addListener(event: 'ready' | 'playback_update', callback: (e: { data?: { isPaused?: boolean } }) => void): void
}

export interface SpotifyIFrameAPI {
  createController(
    element: HTMLElement,
    options: { uri: string; width?: string | number; height?: string | number },
    callback: (controller: SpotifyController) => void,
  ): void
}

declare global {
  interface Window {
    YT?: YTNamespace
    onYouTubeIframeAPIReady?: () => void
    onSpotifyIframeApiReady?: (api: SpotifyIFrameAPI) => void
  }
}

function loadScript(src: string, onError: () => void) {
  const script = document.createElement('script')
  script.src = src
  script.async = true
  script.onerror = onError
  document.head.appendChild(script)
}

let youtube: Promise<YTNamespace> | null = null

export function loadYouTubeApi(): Promise<YTNamespace> {
  if (window.YT?.Player) return Promise.resolve(window.YT)
  youtube ??= new Promise((resolve, reject) => {
    const previous = window.onYouTubeIframeAPIReady
    window.onYouTubeIframeAPIReady = () => {
      previous?.()
      if (window.YT) resolve(window.YT)
    }
    loadScript('https://www.youtube.com/iframe_api', () => {
      youtube = null
      reject(new Error('No se pudo cargar YouTube'))
    })
  })
  return youtube
}

let spotify: Promise<SpotifyIFrameAPI> | null = null

export function loadSpotifyApi(): Promise<SpotifyIFrameAPI> {
  spotify ??= new Promise((resolve, reject) => {
    window.onSpotifyIframeApiReady = (api) => resolve(api)
    loadScript('https://open.spotify.com/embed/iframe-api/v1', () => {
      spotify = null
      reject(new Error('No se pudo cargar Spotify'))
    })
  })
  return spotify
}
