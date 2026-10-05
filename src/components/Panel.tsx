import type { ReactNode } from 'react'

interface PanelProps {
  title: string
  icon: ReactNode
  actions?: ReactNode
  className?: string
  children: ReactNode
}

export function Panel({ title, icon, actions, className = '', children }: PanelProps) {
  return (
    <section className={`panel ${className}`} aria-label={title}>
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
