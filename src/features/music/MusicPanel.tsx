import { AudioLines, Disc3, Headphones, Library, ListMusic, LogIn, Pause, Play, Plus, SkipBack, SkipForward, Volume2, X } from 'lucide-react'
import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { Panel } from '../../components/Panel'
import { useToast } from '../../components/Toast'
import { useStore } from '../../hooks/store'
import { fetchMeta } from '../../lib/oembed'
import { musicSourceUrl, parseMusicInput } from '../../lib/web'
import { useAccounts } from '../accounts/AccountsContext'
import { AmbientControls } from './AmbientControls'
import { coverUrl, providerLabel } from './covers'
import { useMusic, type Station } from './MusicContext'
import { autoPauseStore } from './musicStores'
import { SpotifyPlayer } from './SpotifyPlayer'
import { YouTubePlayer } from './YouTubePlayer'
import './music.css'

type Tab = 'ahora' | 'biblioteca' | 'ambiente'

const TABS: { id: Tab; label: string; icon: ReactNode }[] = [
  { id: 'ahora', label: 'Ahora', icon: <Disc3 size={20} /> },
  { id: 'biblioteca', label: 'Biblioteca', icon: <Library size={20} /> },
  { id: 'ambiente', label: 'Ambiente', icon: <AudioLines size={20} /> },
]

function Cover({ link, thumb, big = false }: { link: string; thumb?: string; big?: boolean }) {
  const url = coverUrl(link, thumb)
  // Si la portada no carga (sin conexión, enlace caído), se queda el icono en vez de una imagen rota.
  const [failed, setFailed] = useState<string | null>(null)
  const show = url !== null && failed !== url
  return (
    <span className={`cover ${big ? 'cover-big' : ''}`} aria-hidden="true">
      {show ? (
        <img src={url} alt="" loading="lazy" referrerPolicy="no-referrer" onError={() => setFailed(url)} />
      ) : (
        <ListMusic size={big ? 36 : 22} />
      )}
    </span>
  )
}

interface StationCardProps {
  station: Station
  active: boolean
  playing: boolean
  onPlay: () => void
  onRemove?: () => void
}

function StationCard({ station, active, playing, onPlay, onRemove }: StationCardProps) {
  return (
    <li className={`station-card ${active ? 'is-active' : ''}`}>
      <button type="button" className="station-card-main" onClick={onPlay} aria-label={`${active && playing ? 'Pausar' : 'Poner'} ${station.name}`}>
        <Cover link={station.url} thumb={station.thumb} />
        <span className="station-card-name">{station.name}</span>
        <span className="station-card-provider">{active && playing ? 'Sonando' : providerLabel(station.url)}</span>
      </button>
      {onRemove && (
        <button type="button" className="icon-btn station-card-remove" aria-label={`Quitar ${station.name}`} title="Quitar" onClick={onRemove}>
          <X size={14} />
        </button>
      )}
    </li>
  )
}

export function MusicPanel() {
  const music = useMusic()
  const accounts = useAccounts()
  const toast = useToast()
  const [tab, setTab] = useState<Tab>('ahora')
  const [link, setLink] = useState('')
  const [saving, setSaving] = useState(false)
  const [autoPause, setAutoPause] = useStore(autoPauseStore)
  const { source, stations } = music
  const currentUrl = source ? musicSourceUrl(source) : null
  const current = stations.find((s) => s.url === currentUrl)
  const valid = parseMusicInput(link) !== null

  // Las listas de Spotify traen su portada al preguntar a Spotify: se guarda una vez.
  const missing = stations
    .filter((s) => !s.thumb && parseMusicInput(s.url)?.provider === 'spotify')
    .map((s) => s.id)
    .join(',')
  useEffect(() => {
    if (!missing || tab !== 'biblioteca') return
    let cancelled = false
    const ids = missing.split(',')
    void (async () => {
      for (const id of ids) {
        const station = music.stations.find((s) => s.id === id)
        if (!station) continue
        const meta = await fetchMeta(station.url)
        if (cancelled) return
        if (meta?.thumbnail) music.updateStation(id, { thumb: meta.thumbnail })
      }
    })()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [missing, tab])

  const choose = (station: Station) => {
    if (station.url === currentUrl) music.toggle()
    else music.play(station.url)
    setTab('ahora')
  }

  const addLink = async (e: FormEvent) => {
    e.preventDefault()
    if (!valid) {
      toast('Pega un enlace de YouTube, YouTube Music o Spotify.')
      return
    }
    setSaving(true)
    const ok = await music.addStation(link)
    setSaving(false)
    if (ok) {
      setLink('')
      toast('Guardada en tu biblioteca.')
    }
  }

  return (
    <Panel title="Música" icon={<Headphones size={18} />} panel="music" className="music-panel">
      <div className="phone">
        <div className="phone-screen">
          {/* Los reproductores no se desmontan al cambiar de pestaña: la música sigue sonando. */}
          <div className={`phone-stage ${tab === 'ahora' && source ? '' : 'is-collapsed'}`}>
            {source?.provider === 'youtube' && <YouTubePlayer key={currentUrl} videoId={source.videoId} listId={source.listId} />}
            {source?.provider === 'spotify' && (
              <SpotifyPlayer key={`${currentUrl}-${accounts.versions.spotify}`} kind={source.kind} id={source.id} />
            )}
          </div>

          {tab === 'ahora' && (
            <div className="phone-page">
              {source ? (
                <>
                  <div className="phone-now">
                    <h3 className="phone-title" title={music.title}>
                      {music.title || current?.name || 'Cargando…'}
                    </h3>
                    <span className="phone-sub">{providerLabel(currentUrl ?? '')}</span>
                  </div>
                  {music.error && <p className="error-text">{music.error}</p>}
                  <div className="phone-controls">
                    <button type="button" className="icon-btn" aria-label="Anterior" onClick={music.prev} disabled={!music.canSkip}>
                      <SkipBack size={22} />
                    </button>
                    <button
                      type="button"
                      className="icon-btn icon-btn-primary phone-play"
                      aria-label={music.isPlaying ? 'Pausar' : 'Reproducir'}
                      onClick={music.toggle}
                    >
                      {music.isPlaying ? <Pause size={26} /> : <Play size={26} />}
                    </button>
                    <button type="button" className="icon-btn" aria-label="Siguiente" onClick={music.next} disabled={!music.canSkip}>
                      <SkipForward size={22} />
                    </button>
                  </div>
                  {source.provider === 'youtube' && (
                    <label className="volume">
                      <Volume2 size={16} aria-hidden="true" />
                      <input type="range" min={0} max={100} value={music.volume} aria-label="Volumen" onChange={(e) => music.setVolume(Number(e.target.value))} />
                    </label>
                  )}
                  {source.provider === 'spotify' && (
                    <p className="hint">Con tu cuenta de Spotify iniciada suenan las canciones completas (sin ella, 30 s).</p>
                  )}
                </>
              ) : (
                <div className="phone-empty">
                  <Cover link="" big />
                  <p>¿Qué quieres escuchar?</p>
                </div>
              )}

              <h3 className="phone-heading">Para concentrarte</h3>
              <ul className="station-row" aria-label="Listas para escuchar">
                {stations
                  .filter((s) => s.url !== currentUrl)
                  .slice(0, 8)
                  .map((s) => (
                    <StationCard key={s.id} station={s} active={false} playing={false} onPlay={() => choose(s)} />
                  ))}
              </ul>
            </div>
          )}

          {tab === 'biblioteca' && (
            <div className="phone-page">
              <h3 className="phone-heading">Tus cuentas</h3>
              <p className="hint">
                Entra para oír las canciones completas con tu cuenta. Tus listas y recomendaciones las abres desde la app de
                cada servicio; aquí guardas las que quieras escuchar mientras estudias.
              </p>
              <ul className="phone-accounts">
                <li className="phone-account">
                  <span className="phone-account-text">
                    <strong>YouTube Music</strong>
                    <span>Entra con tu cuenta de Google.</span>
                  </span>
                  <button type="button" className="btn btn-small" onClick={() => accounts.login('google')}>
                    <LogIn size={14} /> Entrar
                  </button>
                </li>
                <li className="phone-account">
                  <span className="phone-account-text">
                    <strong>Spotify</strong>
                    <span>Para oír las canciones completas.</span>
                  </span>
                  <button type="button" className="btn btn-small" onClick={() => accounts.login('spotify')}>
                    <LogIn size={14} /> Entrar
                  </button>
                </li>
              </ul>

              <h3 className="phone-heading">Tu biblioteca</h3>
              {stations.length === 0 ? (
                <p className="empty">Aún no tienes listas. Pega el enlace de una abajo.</p>
              ) : (
                <ul className="station-grid" aria-label="Mi biblioteca">
                  {stations.map((s) => (
                    <StationCard
                      key={s.id}
                      station={s}
                      active={s.url === currentUrl}
                      playing={music.isPlaying}
                      onPlay={() => choose(s)}
                      onRemove={() => music.removeStation(s.id)}
                    />
                  ))}
                </ul>
              )}

              <form className="input-row" onSubmit={addLink}>
                <input
                  type="text"
                  inputMode="url"
                  value={link}
                  onChange={(e) => setLink(e.target.value)}
                  placeholder="Pegar enlace de una lista…"
                  aria-label="Enlace de YouTube, YouTube Music o Spotify"
                />
                <button type="submit" className="btn btn-primary btn-icon" aria-label="Añadir a mi biblioteca" disabled={!valid || saving}>
                  <Plus size={18} />
                </button>
              </form>
              <details className="phone-guide">
                <summary>¿Cómo copio el enlace de mi lista?</summary>
                <ul>
                  <li>
                    <strong>YouTube Music:</strong> abre la lista, pulsa los tres puntos ⋮ → «Compartir» → «Copiar enlace».
                  </li>
                  <li>
                    <strong>Spotify:</strong> abre la lista, pulsa los tres puntos ··· → «Compartir» → «Copiar enlace de la
                    lista».
                  </li>
                </ul>
              </details>
            </div>
          )}

          {tab === 'ambiente' && (
            <div className="phone-page">
              <AmbientControls />
              <label className="music-auto-pause" title="Al empezar un descanso se pausa lo que suena, y vuelve a sonar al seguir estudiando.">
                <span>Pausar en los descansos</span>
                <input type="checkbox" role="switch" className="music-switch" checked={autoPause !== false} onChange={(e) => setAutoPause(e.target.checked)} />
              </label>
            </div>
          )}
        </div>

        {source && tab !== 'ahora' && (
          <div className="phone-mini">
            <button type="button" className="phone-mini-main" onClick={() => setTab('ahora')} aria-label="Abrir el reproductor">
              <Cover link={currentUrl ?? ''} thumb={current?.thumb} />
              <span className="phone-mini-title">{music.title || current?.name || 'Música'}</span>
            </button>
            <button type="button" className="icon-btn" aria-label={music.isPlaying ? 'Pausar' : 'Reproducir'} onClick={music.toggle}>
              {music.isPlaying ? <Pause size={20} /> : <Play size={20} />}
            </button>
          </div>
        )}

        <nav className="phone-nav" role="tablist" aria-label="Música">
          {TABS.map((t) => (
            <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} className={tab === t.id ? 'is-active' : ''} onClick={() => setTab(t.id)}>
              {t.icon}
              <span>{t.label}</span>
            </button>
          ))}
        </nav>
      </div>
    </Panel>
  )
}
