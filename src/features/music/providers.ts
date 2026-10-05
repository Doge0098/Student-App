/* Carga bajo demanda la librería oficial del reproductor de YouTube. */

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

declare global {
  interface Window {
    YT?: YTNamespace
    onYouTubeIframeAPIReady?: () => void
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
