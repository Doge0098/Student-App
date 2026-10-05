import { Pause, Play } from 'lucide-react'
import { useAmbient } from './AmbientContext'
import { AMBIENT_IDS, AMBIENT_SOUNDS, isAmbientId } from './ambientSounds'

/** Sonido ambiente en una sola fila: qué sonido, poner/parar y volumen. Va dentro del panel de Música. */
export function AmbientControls() {
  const ambient = useAmbient()
  const label = AMBIENT_SOUNDS[ambient.sound].label.toLowerCase()

  return (
    <section className="ambient" aria-labelledby="ambient-title">
      <h3 className="section-title" id="ambient-title">
        Sonido ambiente
      </h3>
      <div className="ambient-row">
        <select
          className="ambient-select"
          value={ambient.sound}
          aria-label="Sonido"
          onChange={(e) => {
            if (isAmbientId(e.target.value)) ambient.setSound(e.target.value)
          }}
        >
          {AMBIENT_IDS.map((id) => (
            <option key={id} value={id}>
              {AMBIENT_SOUNDS[id].label}
            </option>
          ))}
        </select>
        <button
          type="button"
          className={`icon-btn ambient-toggle ${ambient.playing ? 'is-on' : ''}`}
          aria-label={ambient.playing ? `Parar ${label}` : `Poner ${label}`}
          title={ambient.playing ? 'Parar' : 'Poner'}
          onClick={ambient.toggle}
        >
          {ambient.playing ? <Pause size={16} /> : <Play size={16} />}
        </button>
        <input
          type="range"
          className="ambient-volume"
          min={0}
          max={100}
          value={ambient.volume}
          aria-label="Volumen del sonido ambiente"
          onChange={(e) => ambient.setVolume(Number(e.target.value))}
        />
      </div>
    </section>
  )
}
