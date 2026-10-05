import { Music2, Pause, Play, SkipForward } from 'lucide-react'
import { useMusic } from './MusicContext'

/** Controles de música siempre visibles en la barra superior. */
export function MiniPlayer() {
  const music = useMusic()
  if (!music.source) return null

  return (
    <div className="mini-player">
      <Music2 size={16} aria-hidden="true" className="mini-player-icon" />
      <span className="mini-player-title" title={music.title}>
        {music.title || 'Música'}
      </span>
      <button
        type="button"
        className="icon-btn"
        aria-label={music.isPlaying ? 'Pausar música' : 'Reproducir música'}
        onClick={music.toggle}
      >
        {music.isPlaying ? <Pause size={16} /> : <Play size={16} />}
      </button>
      {music.canSkip && (
        <button type="button" className="icon-btn" aria-label="Siguiente canción" onClick={music.next}>
          <SkipForward size={16} />
        </button>
      )}
    </div>
  )
}
