import { BookOpen, Coffee, Moon, Sun } from 'lucide-react'
import { useEffect } from 'react'
import { MiniPlayer } from './features/music/MiniPlayer'
import { useRemainingMs, useTimer } from './features/timer/TimerContext'
import { usePersistentState } from './hooks/usePersistentState'
import { formatClock } from './lib/time'

type Theme = 'light' | 'dark'

function TimerPill() {
  const { phase, status } = useTimer()
  const remainingMs = useRemainingMs()
  if (phase === 'idle') return null
  const Icon = phase === 'focus' ? BookOpen : Coffee
  return (
    <div className={`timer-pill pill-${phase}`}>
      <Icon size={15} aria-hidden="true" />
      <span>{phase === 'focus' ? 'Concentración' : 'Descanso'}</span>
      <strong>{status === 'finished' ? '¡Tiempo!' : formatClock(remainingMs)}</strong>
      {status === 'paused' && <span className="pill-paused">en pausa</span>}
    </div>
  )
}

export function TopBar() {
  const [theme, setTheme] = usePersistentState<Theme>('theme', () =>
    window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light',
  )

  useEffect(() => {
    document.documentElement.dataset.theme = theme
  }, [theme])

  return (
    <header className="topbar">
      <div className="brand">
        <span className="brand-logo" aria-hidden="true">
          <BookOpen size={18} />
        </span>
        <span className="brand-name">Student App</span>
      </div>
      <div className="topbar-center">
        <TimerPill />
      </div>
      <div className="topbar-right">
        <MiniPlayer />
        <button
          type="button"
          className="icon-btn"
          aria-label={theme === 'dark' ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro'}
          title={theme === 'dark' ? 'Tema claro' : 'Tema oscuro'}
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
        >
          {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
        </button>
      </div>
    </header>
  )
}
