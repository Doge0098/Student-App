import type { ReactNode } from 'react'
import { accentStyle, type PanelId } from '../features/settings/appearance'
import { useAppearance } from '../features/settings/AppearanceContext'

interface PanelProps {
  title: string
  icon: ReactNode
  /** Función a la que pertenece el panel: decide su color personalizado. */
  panel: PanelId
  actions?: ReactNode
  className?: string
  children: ReactNode
}

export function Panel({ title, icon, panel, actions, className = '', children }: PanelProps) {
  const { panelColor } = useAppearance()
  const color = panelColor(panel)
  return (
    <section className={`panel ${className}`} aria-label={title} data-accent={color} style={accentStyle(color)}>
      <header className="panel-header">
        <h2 className="panel-title">
          <span className="panel-icon" aria-hidden="true">
            {icon}
          </span>
          {title}
        </h2>
        {actions && <div className="panel-actions">{actions}</div>}
      </header>
      <div className="panel-body">{children}</div>
    </section>
  )
}
