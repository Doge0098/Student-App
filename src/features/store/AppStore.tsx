import { Download, ExternalLink, Star } from 'lucide-react'
import { useState } from 'react'
import { normalize } from '../../lib/text'
import { LoginButton } from '../accounts/LoginButton'
import { PRICE_LABELS, STORE_APPS, STORE_CATEGORIES, type StoreApp, type StoreCategory } from './catalog'

interface AppStoreProps {
  myApps: string[]
  onToggleMyApp: (id: string) => void
  onOpenApp: (app: StoreApp) => void
  onDownloadApp: (app: StoreApp) => void
}

/** Tienda de apps de estudio: apps web para abrir aquí y programas para descargar de su web oficial. */
export function AppStore({ myApps, onToggleMyApp, onOpenApp, onDownloadApp }: AppStoreProps) {
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState<StoreCategory | 'all'>('all')

  const q = normalize(query.trim())
  const apps = STORE_APPS.filter(
    (app) =>
      (category === 'all' || app.category === category) &&
      (!q || normalize(`${app.name} ${app.description} ${STORE_CATEGORIES[app.category]}`).includes(q)),
  )

  return (
    <div className="store">
      <input
        type="search"
        className="store-search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Buscar apps: Python, IA, Linux, apuntes…"
        aria-label="Buscar apps"
      />

      <div className="chip-row" role="group" aria-label="Categorías">
        <button
          type="button"
          className={`chip ${category === 'all' ? 'is-active' : ''}`}
          aria-pressed={category === 'all'}
          onClick={() => setCategory('all')}
        >
          Todas
        </button>
        {(Object.keys(STORE_CATEGORIES) as StoreCategory[]).map((id) => (
          <button
            key={id}
            type="button"
            className={`chip ${category === id ? 'is-active' : ''}`}
            aria-pressed={category === id}
            onClick={() => setCategory(id)}
          >
            {STORE_CATEGORIES[id]}
          </button>
        ))}
      </div>

      <p className="hint">
        Las apps web se abren desde aquí. Las descargables te llevan a su página oficial para instalarlas. Pulsa ★
        para tenerlas en Inicio.
      </p>
      {category === 'google' && (
        <div>
          <LoginButton service="google" />
        </div>
      )}

      {apps.length === 0 ? (
        <p className="empty">No hay apps que coincidan con «{query}».</p>
      ) : (
        <ul className="store-grid">
          {apps.map((app) => {
            const Icon = app.icon
            const mine = myApps.includes(app.id)
            return (
              <li key={app.id} className="app-card">
                <div className="app-card-head">
                  <span className="app-icon" aria-hidden="true">
                    <Icon size={20} />
                  </span>
                  <div className="app-card-title">
                    <h4>{app.name}</h4>
                    <span className="app-meta">{PRICE_LABELS[app.price]}</span>
                  </div>
                  <button
                    type="button"
                    className={`icon-btn star-btn ${mine ? 'is-on' : ''}`}
                    aria-pressed={mine}
                    aria-label={mine ? `Quitar ${app.name} de Inicio` : `Añadir ${app.name} a Inicio`}
                    title={mine ? 'Quitar de Inicio' : 'Añadir a Inicio'}
                    onClick={() => onToggleMyApp(app.id)}
                  >
                    <Star size={17} fill={mine ? 'currentColor' : 'none'} />
                  </button>
                </div>
                <p className="app-desc">{app.description}</p>
                <div className="app-actions">
                  {app.webUrl && (
                    <button type="button" className="btn btn-primary btn-small" onClick={() => onOpenApp(app)}>
                      <ExternalLink size={14} /> Abrir
                    </button>
                  )}
                  {app.downloadUrl && (
                    <button type="button" className="btn btn-small" onClick={() => onDownloadApp(app)}>
                      <Download size={14} /> Descargar
                    </button>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
