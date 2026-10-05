import { Music2, Pause, Play, SkipForward } from 'lucide-react'
import { useAmbient } from './AmbientContext'
import { AMBIENT_ICONS } from './ambientIcons'
import { AMBIENT_SOUNDS } from './ambientSounds'
import { useMusic } from './MusicContext'
import './music.css'

/** Controles de música (y del sonido ambiente, si suena) siempre visibles en la barra superior. */
export function MiniPlayer() {
  const music = useMusic()
  const ambient = useAmbient()
  if (!music.source && !ambient.playing) return null

  const AmbientIcon = AMBIENT_ICONS[ambient.sound]
  const ambientLabel = AMBIENT_SOUNDS[ambient.sound].label
  const stopAmbient = `Parar ${ambientLabel.toLowerCase()}`

  return (
    <div className="mini-player">
      {music.source ? (
        <>
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
          {ambient.playing && (
            // Con música, el sonido ambiente es solo su icono: al pulsarlo se para.
            <button
              type="button"
              className="icon-btn is-on mini-ambient"
              aria-label={stopAmbient}
              title={`${ambientLabel} · pulsa para parar`}
              onClick={() => ambient.stop()}
            >
              <AmbientIcon size={16} />
            </button>
          )}
        </>
      ) : (
        <>
          <AmbientIcon size={16} aria-hidden="true" className="mini-player-icon" />
          <span className="mini-player-title">{ambientLabel}</span>
          <button type="button" className="icon-btn" aria-label={stopAmbient} onClick={() => ambient.stop()}>
            <Pause size={16} />
          </button>
        </>
      )}
    </div>
  )
}
