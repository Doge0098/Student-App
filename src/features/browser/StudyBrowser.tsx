import { ArrowRight, Compass, ExternalLink, House, Info, LayoutGrid, RotateCcw, TriangleAlert, X } from 'lucide-react'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Modal } from '../../components/Modal'
import { Panel } from '../../components/Panel'
import { useToast } from '../../components/Toast'
import { usePersistentState } from '../../hooks/usePersistentState'
import { fetchTitle } from '../../lib/oembed'
import { uid } from '../../lib/text'
import { formatClock } from '../../lib/time'
import {
  SEARCH_ENGINES,
  categorize,
  deriveTitle,
  detectSubjectForUrl,
  getDistraction,
  getMessagingApp,
  getEmbed,
  isMusicUrl,
  pageKey,
  parseYouTube,
  resolveInput,
  siteName,
  type SearchEngineId,
} from '../../lib/web'
import { platform } from '../../platform'
import { useAccounts } from '../accounts/AccountsContext'
import { LoginButton } from '../accounts/LoginButton'
import { useMusic } from '../music/MusicContext'
import { useRemainingMs, useTimer } from '../timer/TimerContext'
import { AppStore } from '../store/AppStore'
import { DEFAULT_MY_APPS, type StoreApp } from '../store/catalog'
import { BrowserFrame } from './BrowserFrame'
import { BrowserHome } from './BrowserHome'
import { SiteIcon } from './SiteIcon'
import type { BrowserTab, HistoryItem } from './types'

const HOME = 'home'
const STORE = 'store'
const MAX_TABS = 6
const MAX_HISTORY = 150

function trimHistory(items: HistoryItem[]): HistoryItem[] {
  const pinned = items.filter((h) => h.pinned)
  const rest = items.filter((h) => !h.pinned).slice(0, MAX_HISTORY)
  return [...pinned, ...rest]
}

export function StudyBrowser() {
  const timer = useTimer()
  const music = useMusic()
  const accounts = useAccounts()
  const toast = useToast()
  const [history, setHistory] = usePersistentState<HistoryItem[]>('browser-history', [])
  const [tabs, setTabs] = usePersistentState<BrowserTab[]>('browser-tabs', [])
  const [activeId, setActiveId] = usePersistentState<string>('browser-active', HOME)
  const [engine, setEngine] = usePersistentState<SearchEngineId>('browser-engine', 'google')
  const [myApps, setMyApps] = usePersistentState<string[]>('my-apps', DEFAULT_MY_APPS)
  const [address, setAddress] = useState('')
  const [pending, setPending] = useState<{ url: string; label: string; messaging: boolean } | null>(null)
  // Las pestañas guardadas solo se cargan cuando se abren, no todas a la vez al entrar.
  const [loaded, setLoaded] = useState<Set<string>>(() => new Set([activeId]))

  const activeTab = tabs.find((t) => t.id === activeId) ?? null
  const showStore = activeId === STORE

  // Tras iniciar sesión en Google se recargan los documentos abiertos para que usen la cuenta.
  const googleVersion = accounts.versions.google
  const seenGoogleVersion = useRef(googleVersion)
  useEffect(() => {
    if (seenGoogleVersion.current === googleVersion) return
    seenGoogleVersion.current = googleVersion
    setTabs((prev) => prev.map((t) => (t.hint === 'google-login' ? { ...t, reloads: t.reloads + 1 } : t)))
  }, [googleVersion, setTabs])

  const activate = (id: string) => {
    setActiveId(id)
    setLoaded((prev) => (prev.has(id) ? prev : new Set(prev).add(id)))
  }

  const record = (url: URL, title: string) => {
    const key = pageKey(url)
    const now = Date.now()
    setHistory((prev) => {
      const existing = prev.find((h) => h.key === key)
      if (existing) {
        return [{ ...existing, visits: existing.visits + 1, lastVisited: now }, ...prev.filter((h) => h !== existing)]
      }
      const item: HistoryItem = {
        id: uid(),
        key,
        url: url.href,
        title,
        category: categorize(url),
        subject: detectSubjectForUrl(url, title),
        visits: 1,
        lastVisited: now,
      }
      return trimHistory([item, ...prev])
    })
  }

  /** Los vídeos traen su título real (y así se adivina mejor la asignatura). */
  const improveTitle = (url: URL) => {
    const key = pageKey(url)
    void fetchTitle(url.href).then((title) => {
      if (!title) return
      setHistory((prev) =>
        prev.map((h) =>
          h.key === key && h.title === deriveTitle(url)
            ? { ...h, title, subject: h.subjectManual ? h.subject : detectSubjectForUrl(url, title) }
            : h,
        ),
      )
      setTabs((prev) => prev.map((t) => (t.key === key ? { ...t, title } : t)))
    })
  }

  const launch = (url: URL, shouldRecord: boolean) => {
    const title = deriveTitle(url)
    if (shouldRecord) record(url, title)
    const embed = getEmbed(url) ?? (platform.canEmbedAnySite ? { src: url.href } : null)

    if (embed) {
      const key = pageKey(url)
      const existing = tabs.find((t) => t.key === key)
      if (existing) {
        activate(existing.id)
      } else {
        const tab: BrowserTab = { id: uid(), key, url: url.href, src: embed.src, title, hint: embed.hint, reloads: 0 }
        setTabs((prev) => [...prev, tab].slice(-MAX_TABS))
        activate(tab.id)
      }
    } else {
      platform.openExternal(url.href)
      toast(
        categorize(url) === 'google'
          ? 'Google abre sus apps en una pestaña nueva. Pega aquí el enlace de tu Doc para tenerlo dentro.'
          : `${siteName(url)} no se deja mostrar dentro de la app: se ha abierto en una pestaña nueva.`,
      )
    }

    if (parseYouTube(url) || url.hostname.endsWith('vimeo.com')) improveTitle(url)
  }

  const open = (raw: string, options: { record?: boolean } = {}) => {
    const url = resolveInput(raw, engine)
    if (!url) return
    const shouldRecord = options.record ?? true

    if (isMusicUrl(url) && music.play(url.href)) {
      toast('Suena en el panel de Música 🎧')
      return
    }

    const distraction = getDistraction(url)
    const onBreak = timer.phase === 'break' && timer.status === 'running'
    if (distraction && !onBreak) {
      setPending({ url: url.href, label: distraction, messaging: false })
      return
    }
    // La mensajería no es una distracción en sí: solo se avisa en mitad de un bloque de concentración.
    const messaging = getMessagingApp(url)
    if (messaging && timer.phase === 'focus' && timer.status === 'running') {
      setPending({ url: url.href, label: messaging, messaging: true })
      return
    }
    launch(url, shouldRecord && !distraction)
  }

  const openApp = (app: StoreApp) => {
    if (app.webUrl) open(app.webUrl, { record: false })
    else if (app.downloadUrl) downloadApp(app)
  }

  const downloadApp = (app: StoreApp) => {
    if (!app.downloadUrl) return
    platform.openExternal(app.downloadUrl)
    toast(`Te llevo a la página oficial de ${app.name} para descargarlo.`)
  }

  const toggleMyApp = (id: string) =>
    setMyApps((prev) => (prev.includes(id) ? prev.filter((a) => a !== id) : [...prev, id]))

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!address.trim()) return
    open(address)
    setAddress('')
  }

  const closeTab = (id: string) => {
    const index = tabs.findIndex((t) => t.id === id)
    const remaining = tabs.filter((t) => t.id !== id)
    setTabs(remaining)
    if (activeId === id) activate(remaining[Math.min(index, remaining.length - 1)]?.id ?? HOME)
  }

  const reloadTab = (id: string) =>
    setTabs((prev) => prev.map((t) => (t.id === id ? { ...t, reloads: t.reloads + 1 } : t)))

  const updateItem = (id: string, patch: Partial<HistoryItem>) =>
    setHistory((prev) => prev.map((h) => (h.id === id ? { ...h, ...patch } : h)))

  return (
    <Panel title="Navegador" icon={<Compass size={18} />} panel="browser" className="browser-panel">
      <form className="address-bar" onSubmit={submit} role="search">
        <input
          type="text"
          inputMode="search"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder="Busca algo o pega un enlace"
          aria-label="Buscar o escribir dirección"
          enterKeyHint="go"
        />
        <select
          value={engine}
          onChange={(e) => setEngine(e.target.value as SearchEngineId)}
          aria-label="Buscar en"
          title="Buscar en"
        >
          {Object.entries(SEARCH_ENGINES).map(([id, e]) => (
            <option key={id} value={id}>
              {e.label}
            </option>
          ))}
        </select>
        <button type="submit" className="btn btn-primary btn-icon" aria-label="Ir" disabled={!address.trim()}>
          <ArrowRight size={18} />
        </button>
      </form>

      <div className="tab-strip" role="tablist" aria-label="Pestañas">
        <button
          type="button"
          role="tab"
          aria-selected={!activeTab && !showStore}
          className={`tab ${!activeTab && !showStore ? 'is-active' : ''}`}
          onClick={() => activate(HOME)}
        >
          <House size={15} aria-hidden="true" />
          <span className="tab-title">Inicio</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={showStore}
          className={`tab ${showStore ? 'is-active' : ''}`}
          onClick={() => activate(STORE)}
        >
          <LayoutGrid size={15} aria-hidden="true" />
          <span className="tab-title">Apps</span>
        </button>
        {tabs.map((tab) => (
          <div key={tab.id} className={`tab ${tab.id === activeTab?.id ? 'is-active' : ''}`}>
            <button
              type="button"
              role="tab"
              aria-selected={tab.id === activeTab?.id}
              className="tab-main"
              title={tab.title}
              onClick={() => activate(tab.id)}
            >
              <SiteIcon url={tab.url} category={categorize(new URL(tab.url))} size={15} />
              <span className="tab-title">{tab.title}</span>
            </button>
            <button type="button" className="tab-close" aria-label={`Cerrar ${tab.title}`} onClick={() => closeTab(tab.id)}>
              <X size={13} />
            </button>
          </div>
        ))}
        {activeTab && (
          <div className="tab-tools">
            <button type="button" className="icon-btn" title="Recargar" aria-label="Recargar" onClick={() => reloadTab(activeTab.id)}>
              <RotateCcw size={16} />
            </button>
            <a
              className="icon-btn"
              href={activeTab.url}
              target="_blank"
              rel="noopener noreferrer"
              title="Abrir en una pestaña nueva"
              aria-label="Abrir en una pestaña nueva"
            >
              <ExternalLink size={16} />
            </a>
          </div>
        )}
      </div>

      {activeTab?.hint && (
        <div className="frame-hint">
          <Info size={14} aria-hidden="true" />
          <span>
            {activeTab.hint === 'google-login'
              ? 'Para editar necesitas haber entrado en tu cuenta de Google. Si no carga, ábrelo con ↗.'
              : 'Si un resultado no carga aquí dentro, ábrelo con ↗ o pega su enlace en la barra.'}
          </span>
          {activeTab.hint === 'google-login' && <LoginButton service="google" />}
        </div>
      )}

      <div className="browser-viewport">
        {!activeTab && !showStore && (
          <BrowserHome
            history={history}
            myApps={myApps}
            onOpen={open}
            onOpenApp={openApp}
            onShowStore={() => activate(STORE)}
            onUpdate={updateItem}
            onRemove={(id) => setHistory((prev) => prev.filter((h) => h.id !== id))}
          />
        )}
        {showStore && (
          <AppStore myApps={myApps} onToggleMyApp={toggleMyApp} onOpenApp={openApp} onDownloadApp={downloadApp} />
        )}
        {tabs.map((tab) =>
          loaded.has(tab.id) ? (
            <BrowserFrame
              key={`${tab.id}-${tab.reloads}`}
              src={tab.src}
              title={tab.title}
              hidden={tab.id !== activeTab?.id}
            />
          ) : null,
        )}
      </div>

      <DistractionModal
        label={pending?.label ?? null}
        messaging={pending?.messaging ?? false}
        onCancel={() => setPending(null)}
        onConfirm={() => {
          if (pending) launch(new URL(pending.url), false)
          setPending(null)
        }}
      />
    </Panel>
  )
}

interface DistractionModalProps {
  label: string | null
  messaging: boolean
  onCancel: () => void
  onConfirm: () => void
}

function DistractionModal({ label, messaging, onCancel, onConfirm }: DistractionModalProps) {
  const timer = useTimer()
  const remainingMs = useRemainingMs()
  const focusRunning = timer.phase === 'focus' && timer.status === 'running'

  return (
    <Modal
      open={label !== null}
      title={messaging ? `¿Abrir ${label ?? ''} ahora?` : `Eso parece una distracción (${label ?? ''})`}
      icon={<TriangleAlert size={28} />}
      onClose={onCancel}
    >
      <p className="modal-text">
        {messaging
          ? `Estás en un bloque de concentración: te quedan ${formatClock(remainingMs)}. Los mensajes pueden esperar al descanso.`
          : focusRunning
            ? `Estás en un bloque de concentración: te quedan ${formatClock(remainingMs)}. Aguanta un poco: en el descanso podrás entrar sin avisos.`
            : 'Has venido aquí a estudiar. ¿Seguro que quieres abrirlo?'}
      </p>
      <div className="modal-actions">
        <button type="button" className="btn btn-primary" data-autofocus onClick={onCancel}>
          Volver a lo mío
        </button>
        <button type="button" className="btn btn-ghost" onClick={onConfirm}>
          Abrir igualmente
        </button>
      </div>
    </Modal>
  )
}
