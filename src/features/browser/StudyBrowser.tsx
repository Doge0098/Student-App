import { ArrowRight, Compass, ExternalLink, House, Info, LayoutGrid, Layers, Lock, NotebookPen, RotateCcw, Sparkles, TriangleAlert, X } from 'lucide-react'
import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { Modal } from '../../components/Modal'
import { Panel } from '../../components/Panel'
import { useToast } from '../../components/Toast'
import { usePersistentState } from '../../hooks/usePersistentState'
import { fetchTitle } from '../../lib/oembed'
import { SUBJECTS, type SubjectId } from '../../lib/subjects'
import { uid } from '../../lib/text'
import { formatClock } from '../../lib/time'
import {
  SEARCH_ENGINES,
  categorize,
  deriveTitle,
  detectSubjectForUrl,
  getEmbed,
  isMusicUrl,
  pageKey,
  parseYouTube,
  resolveInput,
  siteName,
  type EmbedInfo,
  type SearchEngineId,
} from '../../lib/web'
import { platform } from '../../platform'
import { useAccounts } from '../accounts/AccountsContext'
import { LoginButton } from '../accounts/LoginButton'
import { useMusic } from '../music/MusicContext'
import { useProfile } from '../profile/profile'
import { useRemainingMs, useTimer } from '../timer/TimerContext'
import { AiAssistant } from '../ai/AiAssistant'
import { FlashcardsView } from '../flashcards/FlashcardsView'
import { NotesView } from '../notes/NotesView'
import { AppStore } from '../store/AppStore'
import { DEFAULT_MY_APPS, type StoreApp } from '../store/catalog'
import { BrowserFrame } from './BrowserFrame'
import { BrowserHome } from './BrowserHome'
import { blockedSites, checkSite, timerFlags, type GuardContext, type GuardVerdict } from './guard'
import { navigateTab, retitleHistory } from './navigation'
import { openAllMessage, planOpenAll } from './openAll'
import { SiteIcon } from './SiteIcon'
import type { BrowserTab, HistoryItem } from './types'

const HOME = 'home'
const STORE = 'store'
const NOTES = 'notes'
const CARDS = 'cards'
const AI = 'ai'

/** Pestañas fijas del espacio de estudio (las webs abiertas van después). */
const FIXED_TABS = [
  { id: HOME, label: 'Inicio', icon: House },
  { id: STORE, label: 'Apps', icon: LayoutGrid },
  { id: NOTES, label: 'Notas', icon: NotebookPen },
  { id: CARDS, label: 'Repasar', icon: Layers },
  { id: AI, label: 'IA', icon: Sparkles },
] as const
const FIXED_IDS: string[] = FIXED_TABS.map((t) => t.id)
const MAX_TABS = 6
const MAX_HISTORY = 150

function trimHistory(items: HistoryItem[]): HistoryItem[] {
  const pinned = items.filter((h) => h.pinned)
  const rest = items.filter((h) => !h.pinned).slice(0, MAX_HISTORY)
  return [...pinned, ...rest]
}

/** Cómo se ve una web dentro de la app (null = solo en una pestaña nueva del navegador). */
function embedFor(url: URL): EmbedInfo | null {
  return getEmbed(url) ?? (platform.canEmbedAnySite ? { src: url.href } : null)
}

function parseUrl(raw: string): URL | null {
  try {
    const url = new URL(raw)
    return url.protocol === 'http:' || url.protocol === 'https:' ? url : null
  } catch {
    return null
  }
}

/** Una web que pide aviso o está bloqueada, esperando respuesta. */
interface PendingOpen {
  url: string
  verdict: GuardVerdict
}

export function StudyBrowser() {
  const timer = useTimer()
  const music = useMusic()
  const accounts = useAccounts()
  const toast = useToast()
  const profile = useProfile()
  const [history, setHistory] = usePersistentState<HistoryItem[]>('browser-history', [])
  const [tabs, setTabs] = usePersistentState<BrowserTab[]>('browser-tabs', [])
  const [activeId, setActiveId] = usePersistentState<string>('browser-active', HOME)
  const [engine, setEngine] = usePersistentState<SearchEngineId>('browser-engine', 'google')
  const [myApps, setMyApps] = usePersistentState<string[]>('my-apps', DEFAULT_MY_APPS)
  const [address, setAddress] = useState('')
  const [pending, setPending] = useState<PendingOpen | null>(null)
  // Las pestañas guardadas solo se cargan cuando se abren, no todas a la vez al entrar.
  const [loaded, setLoaded] = useState<Set<string>>(() => new Set([activeId]))

  const activeTab = tabs.find((t) => t.id === activeId) ?? null
  // Vista fija que se ve ahora (Inicio si la pestaña guardada ya no existe).
  const fixedView = activeTab ? null : FIXED_IDS.includes(activeId) ? activeId : HOME

  // Modo de estudio + temporizador: qué se abre, qué pide aviso y qué queda bloqueado.
  const guard: GuardContext = { mode: profile.mode, extraDistractions: profile.extraDistractions, ...timerFlags(timer) }

  // En escritorio, las webs bloqueadas tampoco se abren pulsando enlaces dentro de una página.
  const blockedKey = blockedSites(guard).join(' ')
  useEffect(() => {
    platform.setBlockedSites(blockedKey ? blockedKey.split(' ') : [])
  }, [blockedKey])

  useEffect(
    () =>
      platform.onBlockedNavigation((raw) => {
        const url = parseUrl(raw)
        toast(`${url ? siteName(url) : 'Esa web'} está bloqueada hasta el descanso (modo Estricto).`)
      }),
    [toast],
  )

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
    const embed = embedFor(url)

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

    // Distracciones y mensajería: se abren, se avisa o se bloquean según el modo (ver distractionPolicy).
    const verdict = checkSite(url, guard)
    if (verdict.action !== 'allow') {
      setPending({ url: url.href, verdict })
      return
    }
    // Las distracciones no se guardan en el historial aunque se abran (p. ej. en el descanso).
    launch(url, shouldRecord && verdict.kind !== 'distraction')
  }

  // Escritorio: los enlaces que una web abre «en pestaña nueva» se abren como pestañas de LockIn,
  // pasando por los mismos avisos de distracciones y el mismo historial que la barra de direcciones.
  const openRef = useRef<(raw: string) => void>(() => {})
  useEffect(() => {
    openRef.current = (raw) => open(raw)
  })
  useEffect(() => platform.onOpenTab((url) => openRef.current(url)), [])

  /** «Abrir todo» de una asignatura: dentro las que se dejan; las de fuera no se abren todas de golpe. */
  const openAll = (items: HistoryItem[], subject: SubjectId) => {
    const plan = planOpenAll(items, tabs, {
      maxTabs: MAX_TABS,
      embed: embedFor,
      allowed: (url) => checkSite(url, guard).action === 'allow',
      makeId: uid,
    })
    setTabs(plan.tabs)
    let firstExternal: string | null = null
    if (plan.activeId) {
      activate(plan.activeId)
    } else if (plan.external.length > 0) {
      // Una sola pestaña nueva (el navegador bloquearía más de una y distraería).
      const first = plan.external[0]
      const url = parseUrl(first.url)
      if (url) {
        launch(url, false)
        firstExternal = first.title
      }
    }
    toast(openAllMessage(plan, { subject: SUBJECTS[subject]?.label ?? 'esta asignatura', maxTabs: MAX_TABS, firstExternal }))
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

  /**
   * Solo en escritorio: el estudiante ha pulsado un enlace dentro de una pestaña (o la página ha
   * cambiado de título). Se actualiza la pestaña y se guarda la página real en el historial.
   */
  const handleNavigate = (tabId: string, rawUrl: string, rawTitle: string) => {
    const tab = tabs.find((t) => t.id === tabId)
    const nav = tab ? navigateTab(tab, rawUrl, rawTitle) : null
    if (!tab || !nav) return
    setTabs((prev) => prev.map((t) => (t.id === tabId ? nav.tab : t)))

    const verdict = checkSite(nav.url, guard)
    if (verdict.kind === 'distraction') {
      // No se guarda en el historial; si ahora no toca, se le recuerda.
      if (!nav.samePage && verdict.action !== 'allow') toast(`Ojo: ${verdict.label} es una distracción.`)
      return
    }
    if (nav.samePage) setHistory((prev) => retitleHistory(prev, nav.url, nav.title, tab.title))
    else record(nav.url, nav.title)
  }

  // El aviso de navegación llega desde la vista de escritorio, que puede guardar la función: siempre la última.
  const navigateRef = useRef(handleNavigate)
  useEffect(() => {
    navigateRef.current = handleNavigate
  })
  const onNavigate = useCallback((tabId: string, url: string, title: string) => navigateRef.current(tabId, url, title), [])

  const updateItem = (id: string, patch: Partial<HistoryItem>) =>
    setHistory((prev) => prev.map((h) => (h.id === id ? { ...h, ...patch } : h)))

  return (
    <Panel title="Estudio" icon={<Compass size={18} />} panel="browser" className="browser-panel">
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
        {FIXED_TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={fixedView === id}
            className={`tab tab-fixed ${fixedView === id ? 'is-active' : ''}`}
            title={label}
            onClick={() => activate(id)}
          >
            <Icon size={15} aria-hidden="true" />
            <span className="tab-title">{label}</span>
          </button>
        ))}
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

      {activeTab?.hint && !(activeTab.hint === 'search' && platform.canEmbedAnySite) && (
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
        {fixedView === HOME && (
          <BrowserHome
            history={history}
            myApps={myApps}
            onOpen={open}
            onOpenApp={openApp}
            onOpenAll={openAll}
            onShowStore={() => activate(STORE)}
            onUpdate={updateItem}
            onRemove={(id) => setHistory((prev) => prev.filter((h) => h.id !== id))}
          />
        )}
        {fixedView === STORE && (
          <AppStore myApps={myApps} onToggleMyApp={toggleMyApp} onOpenApp={openApp} onDownloadApp={downloadApp} />
        )}
        {fixedView === NOTES && <NotesView />}
        {fixedView === CARDS && <FlashcardsView />}
        {fixedView === AI && <AiAssistant />}
        {tabs.map((tab) =>
          loaded.has(tab.id) ? (
            <TabFrame key={`${tab.id}-${tab.reloads}`} tab={tab} hidden={tab.id !== activeTab?.id} onNavigate={onNavigate} />
          ) : null,
        )}
      </div>

      <DistractionModal
        pending={pending}
        onCancel={() => setPending(null)}
        onConfirm={() => {
          if (pending && pending.verdict.action === 'warn') launch(new URL(pending.url), false)
          setPending(null)
        }}
      />
    </Panel>
  )
}

interface TabFrameProps {
  tab: BrowserTab
  hidden: boolean
  onNavigate: (tabId: string, url: string, title: string) => void
}

/** Página de una pestaña. Si luego navega dentro (escritorio), no se recarga: la dirección inicial se queda. */
function TabFrame({ tab, hidden, onNavigate }: TabFrameProps) {
  const [src] = useState(tab.src)
  const { id } = tab
  const handleNavigate = useCallback((url: string, title: string) => onNavigate(id, url, title), [onNavigate, id])
  return <BrowserFrame src={src} title={tab.title} hidden={hidden} onNavigate={handleNavigate} />
}

interface DistractionModalProps {
  pending: PendingOpen | null
  onCancel: () => void
  /** Solo para avisos: en modo Estricto no hay opción de abrir. */
  onConfirm: () => void
}

function DistractionModal({ pending, onCancel, onConfirm }: DistractionModalProps) {
  const timer = useTimer()
  const remainingMs = useRemainingMs()
  const { focusRunning } = timerFlags(timer)
  const verdict = pending?.verdict
  const label = verdict?.label ?? ''
  const blocked = verdict?.action === 'block'
  const messaging = verdict?.kind === 'messaging'
  const left = formatClock(remainingMs)

  const title = blocked
    ? 'Bloqueado hasta el descanso'
    : messaging
      ? `¿Abrir ${label} ahora?`
      : verdict?.own
        ? `${label} está en tu lista de distracciones`
        : `Eso parece una distracción (${label})`

  const text = blocked
    ? `Estás en modo Estricto: ${label} no se abre mientras te concentras. Te quedan ${left}; en el descanso podrás entrar.`
    : messaging
      ? `Estás en un bloque de concentración: te quedan ${left}. Los mensajes pueden esperar al descanso.`
      : focusRunning
        ? `Estás en un bloque de concentración: te quedan ${left}. Aguanta un poco: en el descanso podrás entrar sin avisos.`
        : 'Has venido aquí a estudiar. ¿Seguro que quieres abrirlo?'

  return (
    <Modal
      open={pending !== null}
      title={title}
      icon={blocked ? <Lock size={28} /> : <TriangleAlert size={28} />}
      onClose={onCancel}
    >
      <p className="modal-text">{text}</p>
      <div className="modal-actions">
        <button type="button" className="btn btn-primary" data-autofocus onClick={onCancel}>
          Volver a lo mío
        </button>
        {!blocked && (
          <button type="button" className="btn btn-ghost" onClick={onConfirm}>
            Abrir igualmente
          </button>
        )}
      </div>
    </Modal>
  )
}
