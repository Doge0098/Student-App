import { Check, History, Info, LayoutGrid, Pencil, Pin, PinOff, Plus, Sparkles, X } from 'lucide-react'
import { useMemo, useState, type CSSProperties } from 'react'
import { SubjectPicker } from '../../components/SubjectPicker'
import { SUBJECTS, type SubjectId } from '../../lib/subjects'
import { timeAgo } from '../../lib/time'
import { CATEGORIES, siteName } from '../../lib/web'
import { LoginButton } from '../accounts/LoginButton'
import { GOOGLE_APPS, GOOGLE_CREATE, STUDY_TOOLS, type QuickLink } from './links'
import { SiteIcon } from './SiteIcon'
import type { HistoryItem } from './types'

interface BrowserHomeProps {
  history: HistoryItem[]
  onOpen: (url: string, options?: { record?: boolean }) => void
  onUpdate: (id: string, patch: Partial<HistoryItem>) => void
  onRemove: (id: string) => void
}

const VISIBLE_STEP = 8

function hostOf(url: string) {
  try {
    return siteName(new URL(url))
  } catch {
    return url
  }
}

function LinkGrid({ links, onOpen, compact = false }: { links: QuickLink[]; onOpen: (url: string) => void; compact?: boolean }) {
  return (
    <div className={`tile-grid ${compact ? 'tile-grid-compact' : ''}`}>
      {links.map(({ label, url, icon: Icon, tint }) => (
        <button
          key={url}
          type="button"
          className="tile"
          style={{ '--tint': tint } as CSSProperties}
          onClick={() => onOpen(url)}
        >
          <span className="tile-icon" aria-hidden="true">
            {compact ? <Plus size={14} /> : <Icon size={18} />}
          </span>
          <span className="tile-label">{label}</span>
        </button>
      ))}
    </div>
  )
}

/** Pestaña de inicio: "Continuar donde lo dejaste", Google y herramientas de estudio. */
export function BrowserHome({ history, onOpen, onUpdate, onRemove }: BrowserHomeProps) {
  const [subjectFilter, setSubjectFilter] = useState<SubjectId | 'all'>('all')
  const [visible, setVisible] = useState(VISIBLE_STEP)
  const [editing, setEditing] = useState<{ id: string; title: string } | null>(null)

  const subjectsPresent = useMemo(() => {
    const counts = new Map<SubjectId, number>()
    for (const item of history) counts.set(item.subject, (counts.get(item.subject) ?? 0) + 1)
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([id]) => id)
  }, [history])

  const filtered = useMemo(() => {
    const list = subjectFilter === 'all' ? history : history.filter((h) => h.subject === subjectFilter)
    return [...list].sort((a, b) => Number(Boolean(b.pinned)) - Number(Boolean(a.pinned)) || b.lastVisited - a.lastVisited)
  }, [history, subjectFilter])

  const last = history.length > 0 ? history.reduce((a, b) => (b.lastVisited > a.lastVisited ? b : a)) : null
  const openTool = (url: string) => onOpen(url, { record: false })

  const saveTitle = () => {
    if (editing && editing.title.trim()) onUpdate(editing.id, { title: editing.title.trim() })
    setEditing(null)
  }

  return (
    <div className="browser-home">
      {last && (
        <button type="button" className="resume-card" onClick={() => onOpen(last.url)}>
          <span className="resume-icon">
            <SiteIcon url={last.url} category={last.category} size={22} />
          </span>
          <span className="resume-text">
            <span className="eyebrow">Seguir con lo último</span>
            <span className="resume-title">{last.title}</span>
            <span className="resume-meta">
              {SUBJECTS[last.subject]?.label} · {hostOf(last.url)} · {timeAgo(last.lastVisited)}
            </span>
          </span>
        </button>
      )}

      <section className="home-section" aria-labelledby="continue-title">
        <h3 className="section-title" id="continue-title">
          <History size={16} aria-hidden="true" /> Continuar donde lo dejaste
        </h3>

        {history.length === 0 ? (
          <p className="empty">
            Aquí aparecerá lo que vayas abriendo, clasificado por asignatura y tipo de web, para que vuelvas a ello
            con un clic.
          </p>
        ) : (
          <>
            {subjectsPresent.length > 1 && (
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
              {filtered.slice(0, visible).map((item) => (
                <li key={item.id} className={`history-item ${item.pinned ? 'is-pinned' : ''}`}>
                  <span className={`history-icon cat-${item.category}`}>
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
                        {CATEGORIES[item.category]} · {hostOf(item.url)} · {timeAgo(item.lastVisited)}
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
            {filtered.length > visible && (
              <button type="button" className="btn btn-link" onClick={() => setVisible((v) => v + VISIBLE_STEP)}>
                Ver más ({filtered.length - visible})
              </button>
            )}
          </>
        )}
      </section>

      <section className="home-section" aria-labelledby="google-title">
        <div className="section-head">
          <h3 className="section-title" id="google-title">
            <LayoutGrid size={16} aria-hidden="true" /> Google
          </h3>
          <LoginButton service="google" />
        </div>
        <LinkGrid links={GOOGLE_APPS} onOpen={openTool} />
        <div className="create-row">
          <span className="create-label">Crear nuevo:</span>
          <LinkGrid links={GOOGLE_CREATE} onOpen={openTool} compact />
        </div>
        <p className="hint hint-box">
          <Info size={14} aria-hidden="true" />
          <span>
            ¿Tienes un Doc, Hoja o Presentación? Pega su enlace en la barra de arriba: se abrirá aquí dentro (si has
            entrado en tu cuenta de Google) y quedará guardado en «Continuar».
          </span>
        </p>
      </section>

      <section className="home-section" aria-labelledby="tools-title">
        <h3 className="section-title" id="tools-title">
          <Sparkles size={16} aria-hidden="true" /> Herramientas de estudio
        </h3>
        <LinkGrid links={STUDY_TOOLS} onOpen={openTool} />
      </section>
    </div>
  )
}
