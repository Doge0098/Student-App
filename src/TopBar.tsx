import { BookOpen, Coffee, Moon, Palette, Sun, UserRound } from 'lucide-react'
import { useState } from 'react'
import { MiniPlayer } from './features/music/MiniPlayer'
import { accentStyle } from './features/settings/appearance'
import { useAppearance } from './features/settings/AppearanceContext'
import { SettingsDialog, type SettingsTab } from './features/settings/SettingsDialog'
import { useRemainingMs, useTimer } from './features/timer/TimerContext'
import { formatClock } from './lib/time'

function TimerPill() {
  const { phase, status } = useTimer()
  const remainingMs = useRemainingMs()
  const { panelColor } = useAppearance()
  if (phase === 'idle') return null
  const Icon = phase === 'focus' ? BookOpen : Coffee
  const color = panelColor('timer')
  return (
    <div className={`timer-pill pill-${phase}`} data-accent={color} style={accentStyle(color)}>
      <Icon size={15} aria-hidden="true" />
      <span>{phase === 'focus' ? 'Concentración' : 'Descanso'}</span>
      <strong>{status === 'finished' ? '¡Tiempo!' : formatClock(remainingMs)}</strong>
      {status === 'paused' && <span className="pill-paused">en pausa</span>}
    </div>
  )
}

export function TopBar() {
  const { resolvedTheme, setTheme } = useAppearance()
  const [settings, setSettings] = useState<SettingsTab | null>(null)
  const [lastTab, setLastTab] = useState<SettingsTab>('appearance')
  const dark = resolvedTheme === 'dark'

  const openSettings = (tab: SettingsTab) => {
    setSettings(tab)
    setLastTab(tab)
  }

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
          role="switch"
          aria-checked={dark}
          aria-label="Modo oscuro"
          title={dark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
          className={`theme-switch ${dark ? 'is-dark' : ''}`}
          onClick={() => setTheme(dark ? 'light' : 'dark')}
        >
          <span className="theme-switch-thumb">{dark ? <Moon size={13} /> : <Sun size={13} />}</span>
        </button>
        <button type="button" className="icon-btn" aria-label="Cuentas" title="Cuentas" onClick={() => openSettings('accounts')}>
          <UserRound size={18} />
        </button>
        <button
          type="button"
          className="icon-btn"
          aria-label="Personalizar"
          title="Personalizar"
          onClick={() => openSettings('appearance')}
        >
          <Palette size={18} />
        </button>
      </div>
      <SettingsDialog
        open={settings !== null}
        tab={settings ?? lastTab}
        onTabChange={openSettings}
        onClose={() => setSettings(null)}
      />
    </header>
  )
}
