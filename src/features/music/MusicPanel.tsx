import { Headphones, Pause, Play, Save, SkipBack, SkipForward, Volume2, X } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Panel } from '../../components/Panel'
import { useToast } from '../../components/Toast'
import { useStore } from '../../hooks/store'
import { musicSourceUrl, parseMusicInput } from '../../lib/web'
import { useAccounts } from '../accounts/AccountsContext'
import { LoginButton } from '../accounts/LoginButton'
import { AmbientControls } from './AmbientControls'
import { useMusic } from './MusicContext'
import { autoPauseStore } from './musicStores'
import { SpotifyPlayer } from './SpotifyPlayer'
import { YouTubePlayer } from './YouTubePlayer'
import './music.css'

function providerOf(url: string) {
  return parseMusicInput(url)?.provider === 'spotify' ? 'Spotify' : 'YouTube'
}

export function MusicPanel() {
  const music = useMusic()
  const accounts = useAccounts()
  const toast = useToast()
  const [link, setLink] = useState('')
  const [saving, setSaving] = useState(false)
  const [autoPause, setAutoPause] = useStore(autoPauseStore)
  const { source } = music
  const currentUrl = source ? musicSourceUrl(source) : null
  const valid = parseMusicInput(link) !== null

  const playLink = (e: FormEvent) => {
    e.preventDefault()
    if (music.play(link)) setLink('')
    else toast('Pega un enlace de YouTube, YouTube Music o Spotify.')
  }

  const saveLink = async () => {
    setSaving(true)
    const ok = await music.addStation(link)
    setSaving(false)
    if (ok) {
      setLink('')
      toast('Guardado en tu lista.')
    }
  }

  return (
    <Panel title="Música" icon={<Headphones size={18} />} panel="music" className="music-panel">
      {source && (
        <>
          <div className="now-playing">
            <span className="now-playing-title" title={music.title}>
              {music.title || 'Cargando…'}
            </span>
            <div className="player-controls">
              {music.canSkip && (
                <button type="button" className="icon-btn" aria-label="Anterior" onClick={music.prev}>
                  <SkipBack size={18} />
                </button>
              )}
              <button
                type="button"
                className="icon-btn icon-btn-primary"
                aria-label={music.isPlaying ? 'Pausar' : 'Reproducir'}
                onClick={music.toggle}
              >
                {music.isPlaying ? <Pause size={20} /> : <Play size={20} />}
              </button>
              {music.canSkip && (
                <button type="button" className="icon-btn" aria-label="Siguiente" onClick={music.next}>
                  <SkipForward size={18} />
                </button>
              )}
            </div>
          </div>
          {source.provider === 'youtube' && (
            <label className="volume">
              <Volume2 size={16} aria-hidden="true" />
              <input
                type="range"
                min={0}
                max={100}
                value={music.volume}
                aria-label="Volumen"
                onChange={(e) => music.setVolume(Number(e.target.value))}
              />
            </label>
          )}
          {music.error && <p className="error-text">{music.error}</p>}
          {source.provider === 'youtube' ? (
            <YouTubePlayer key={currentUrl} videoId={source.videoId} listId={source.listId} />
          ) : (
            <>
              <SpotifyPlayer key={`${currentUrl}-${accounts.versions.spotify}`} kind={source.kind} id={source.id} />
              <div className="inline-note">
                <span>Sin cuenta solo suenan 30 s.</span>
                <LoginButton service="spotify" />
              </div>
            </>
          )}
        </>
      )}

      <ul className="station-list" aria-label="Mi lista de música">
        {music.stations.map((station) => {
          const active = station.url === currentUrl
          return (
            <li key={station.id} className={`station ${active ? 'is-active' : ''}`}>
              <button type="button" className="station-play" onClick={() => music.play(station.url)}>
                <span className="station-icon" aria-hidden="true">
                  {active && music.isPlaying ? <Pause size={14} /> : <Play size={14} />}
                </span>
                <span className="station-name">{station.name}</span>
                <span className="station-provider">{providerOf(station.url)}</span>
              </button>
              <button
                type="button"
                className="icon-btn"
                aria-label={`Quitar ${station.name}`}
                title="Quitar"
                onClick={() => music.removeStation(station.id)}
              >
                <X size={14} />
              </button>
            </li>
          )
        })}
      </ul>

      <form className="input-row" onSubmit={playLink}>
        <input
          type="text"
          inputMode="url"
          value={link}
          onChange={(e) => setLink(e.target.value)}
          placeholder="Pegar enlace…"
          aria-label="Enlace de YouTube, YouTube Music o Spotify"
        />
        <button type="submit" className="btn btn-primary btn-icon" aria-label="Reproducir enlace" disabled={!valid}>
          <Play size={18} />
        </button>
        <button
          type="button"
          className="btn btn-icon"
          aria-label="Guardar en mi lista"
          title="Guardar en mi lista"
          disabled={!valid || saving}
          onClick={saveLink}
        >
          <Save size={18} />
        </button>
      </form>

      <AmbientControls />

      <label
        className="music-auto-pause"
        title="Al empezar un descanso se pausa lo que suena, y vuelve a sonar al seguir estudiando."
      >
        <span>Pausar en los descansos</span>
        <input
          type="checkbox"
          role="switch"
          className="music-switch"
          checked={autoPause !== false}
          onChange={(e) => setAutoPause(e.target.checked)}
        />
      </label>
    </Panel>
  )
}
