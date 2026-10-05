import { BookOpen, Coffee, Download, Moon, Settings, Sun } from 'lucide-react'
import { useState } from 'react'
import { MiniPlayer } from './features/music/MiniPlayer'
import { accentStyle } from './features/settings/appearance'
import { useAppearance } from './features/settings/AppearanceContext'
import { SettingsDialog, type SettingsTab } from './features/settings/SettingsDialog'
import { WelcomeGuide } from './features/settings/WelcomeGuide'
import { useRemainingMs, useTimer } from './features/timer/TimerContext'
import { usePersistentState } from './hooks/usePersistentState'
import { formatClock } from './lib/time'
import { useInstallPrompt } from './platform/install'

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
  const { canInstall, install } = useInstallPrompt()
  const [settings, setSettings] = useState<SettingsTab | null>(null)
  const [lastTab, setLastTab] = useState<SettingsTab>('appearance')
  const [welcomeDone, setWelcomeDone] = usePersistentState('welcome-done', false)
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
        {canInstall && (
          <button type="button" className="btn btn-small install-btn" onClick={() => void install()}>
            <Download size={14} /> Instalar
          </button>
        )}
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
        <button type="button" className="icon-btn" aria-label="Ajustes" title="Ajustes" onClick={() => openSettings(lastTab)}>
          <Settings size={18} />
        </button>
      </div>
      <SettingsDialog
        open={settings !== null}
        tab={settings ?? lastTab}
        onTabChange={openSettings}
        onClose={() => setSettings(null)}
        onShowGuide={() => {
          setSettings(null)
          setWelcomeDone(false)
        }}
      />
      <WelcomeGuide open={!welcomeDone && settings === null} onClose={() => setWelcomeDone(true)} />
    </header>
  )
}
