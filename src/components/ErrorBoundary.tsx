import { Component, type ReactNode } from 'react'
import { clearData } from '../features/data/backup'

interface State {
  failed: boolean
}

/** Si algo se rompe (p. ej. datos dañados), en vez de una página en blanco se ofrece una salida. */
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { failed: false }

  static getDerivedStateFromError(): State {
    return { failed: true }
  }

  render() {
    if (!this.state.failed) return this.props.children
    return (
      <div className="crash">
        <h1>Algo ha fallado en LockIn</h1>
        <p>Prueba a recargar. Si vuelve a pasar, puede que tus datos guardados estén dañados.</p>
        <div className="crash-actions">
          <button type="button" className="btn btn-primary" onClick={() => window.location.reload()}>
            Recargar
          </button>
          <button
            type="button"
            className="btn"
            onClick={() => {
              if (!window.confirm('Se borrarán todos tus datos de LockIn en este navegador. ¿Seguimos?')) return
              clearData(localStorage, { keepSecrets: false })
              window.location.reload()
            }}
          >
            Borrar datos de LockIn y recargar
          </button>
        </div>
      </div>
    )
  }
}
