import { Check, Pencil, Pin, PinOff, Plus, X } from 'lucide-react'
import { useMemo, useState, type CSSProperties } from 'react'
import { SubjectPicker } from '../../components/SubjectPicker'
import { SUBJECTS, type SubjectId } from '../../lib/subjects'
import { timeAgo } from '../../lib/time'
import { siteName } from '../../lib/web'
import { GOOGLE_CREATE, findApp, type StoreApp } from '../store/catalog'
import { SiteIcon } from './SiteIcon'
import type { HistoryItem } from './types'

interface BrowserHomeProps {
  history: HistoryItem[]
  myApps: string[]
  onOpen: (url: string, options?: { record?: boolean }) => void
  onOpenApp: (app: StoreApp) => void
  onShowStore: () => void
  onUpdate: (id: string, patch: Partial<HistoryItem>) => void
  onRemove: (id: string) => void
}

const RECENT = 5

function hostOf(url: string) {
  try {
    return siteName(new URL(url))
  } catch {
    return url
  }
}

/** Pestaña de inicio: seguir con lo último, tus apps y lo que has abierto. */
export function BrowserHome({ history, myApps, onOpen, onOpenApp, onShowStore, onUpdate, onRemove }: BrowserHomeProps) {
  const [showAll, setShowAll] = useState(false)
  const [subjectFilter, setSubjectFilter] = useState<SubjectId | 'all'>('all')
  const [editing, setEditing] = useState<{ id: string; title: string } | null>(null)

  const sorted = useMemo(
    () => [...history].sort((a, b) => Number(Boolean(b.pinned)) - Number(Boolean(a.pinned)) || b.lastVisited - a.lastVisited),
    [history],
  )
  const subjectsPresent = useMemo(() => [...new Set(history.map((h) => h.subject))], [history])
  const filtered = showAll && subjectFilter !== 'all' ? sorted.filter((h) => h.subject === subjectFilter) : sorted
  const visible = showAll ? filtered : filtered.slice(0, RECENT)
  const last = history.length > 0 ? history.reduce((a, b) => (b.lastVisited > a.lastVisited ? b : a)) : null
  const apps = myApps.map(findApp).filter((app): app is StoreApp => Boolean(app))

  const saveTitle = () => {
    if (editing && editing.title.trim()) onUpdate(editing.id, { title: editing.title.trim() })
    setEditing(null)
  }

  return (
    <div className="browser-home">
      {last && (
        <button type="button" className="resume-card" onClick={() => onOpen(last.url)}>
          <span className="resume-icon">
            <SiteIcon url={last.url} category={last.category} size={20} />
          </span>
          <span className="resume-text">
            <span className="eyebrow">Seguir con lo último</span>
            <span className="resume-title">{last.title}</span>
          </span>
        </button>
      )}

      <section className="home-section" aria-labelledby="my-apps-title">
        <h3 className="section-title" id="my-apps-title">
          Mis apps
        </h3>
        <div className="app-launcher">
          {apps.map((app) => {
            const Icon = app.icon
            return (
              <button key={app.id} type="button" className="launcher-item" onClick={() => onOpenApp(app)} title={app.description}>
                <span className="app-icon" aria-hidden="true">
                  <Icon size={20} />
                </span>
                <span className="launcher-name">{app.name}</span>
              </button>
            )
          })}
          <button type="button" className="launcher-item launcher-add" onClick={onShowStore}>
            <span className="app-icon" aria-hidden="true">
              <Plus size={20} />
            </span>
            <span className="launcher-name">Añadir apps</span>
          </button>
        </div>
        <p className="create-row">
          <span>Crear:</span>
          {GOOGLE_CREATE.map((c) => (
            <button key={c.url} type="button" className="text-link" onClick={() => onOpen(c.url, { record: false })}>
              {c.label}
            </button>
          ))}
        </p>
      </section>

      <section className="home-section" aria-labelledby="history-title">
        <h3 className="section-title" id="history-title">
          Lo que has abierto
        </h3>

        {history.length === 0 ? (
          <p className="empty">Busca algo arriba o abre una app. Aquí lo verás ordenado por asignatura para volver luego.</p>
        ) : (
          <>
            {showAll && subjectsPresent.length > 1 && (
              <div className="chip-row" role="group" aria-label="Filtrar por asignatura">
                <button
                  type="button"
                  className={`chip ${subjectFilter === 'all' ? 'is-active' : ''}`}
                  aria-pressed={subjectFilter === 'all'}
                  onClick={() => setSubjectFilter('all')}
                >
                  Todo
                </button>
                {subjectsPresent.map((id) => (
                  <button
                    key={id}
                    type="button"
                    className={`chip chip-subject ${subjectFilter === id ? 'is-active' : ''}`}
                    style={{ '--subject': SUBJECTS[id].color } as CSSProperties}
                    aria-pressed={subjectFilter === id}
                    onClick={() => setSubjectFilter(id)}
                  >
                    <span className="subject-dot" aria-hidden="true" />
                    {SUBJECTS[id].label}
                  </button>
                ))}
              </div>
            )}

            <ul className="history-list">
              {visible.map((item) => (
                <li key={item.id} className={`history-item ${item.pinned ? 'is-pinned' : ''}`}>
                  <span className="history-icon">
                    <SiteIcon url={item.url} category={item.category} />
                  </span>
                  {editing?.id === item.id ? (
                    <form
                      className="history-edit"
                      onSubmit={(e) => {
                        e.preventDefault()
                        saveTitle()
                      }}
                    >
                      <input
                        autoFocus
                        value={editing.title}
                        aria-label="Nuevo nombre"
                        onChange={(e) => setEditing({ id: item.id, title: e.target.value })}
                        onBlur={saveTitle}
                        onKeyDown={(e) => e.key === 'Escape' && setEditing(null)}
                      />
                      <button type="submit" className="icon-btn" aria-label="Guardar nombre">
                        <Check size={16} />
                      </button>
                    </form>
                  ) : (
                    <button type="button" className="history-open" onClick={() => onOpen(item.url)} title={item.url}>
                      <span className="history-title">{item.title}</span>
                      <span className="history-meta">
                        {hostOf(item.url)} · {timeAgo(item.lastVisited)}
                      </span>
                    </button>
                  )}
                  <SubjectPicker
                    value={item.subject}
                    onChange={(subject) => onUpdate(item.id, { subject, subjectManual: true })}
                  />
                  <div className="history-actions">
                    <button
                      type="button"
                      className="icon-btn"
                      aria-label={`Renombrar ${item.title}`}
                      title="Renombrar"
                      onClick={() => setEditing({ id: item.id, title: item.title })}
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      type="button"
                      className={`icon-btn ${item.pinned ? 'is-on' : ''}`}
                      aria-label={item.pinned ? `Desfijar ${item.title}` : `Fijar ${item.title}`}
                      aria-pressed={Boolean(item.pinned)}
                      title={item.pinned ? 'Desfijar' : 'Fijar arriba'}
                      onClick={() => onUpdate(item.id, { pinned: !item.pinned })}
                    >
                      {item.pinned ? <PinOff size={14} /> : <Pin size={14} />}
                    </button>
                    <button
                      type="button"
                      className="icon-btn"
                      aria-label={`Quitar ${item.title}`}
                      title="Quitar"
                      onClick={() => onRemove(item.id)}
                    >
                      <X size={14} />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
            {history.length > RECENT && (
              <button
                type="button"
                className="btn btn-link"
                onClick={() => {
                  setShowAll((v) => !v)
                  setSubjectFilter('all')
                }}
              >
                {showAll ? 'Ver menos' : `Ver todo (${history.length})`}
              </button>
            )}
          </>
        )}
      </section>
    </div>
  )
}
