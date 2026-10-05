import { Check, CircleCheck, Compass, Download, Headphones, ListTodo, LogIn, LogOut, Monitor, Moon, RotateCcw, ShieldCheck, Sun, Timer, UserRound } from 'lucide-react'
import type { ReactNode } from 'react'
import { Modal } from '../../components/Modal'
import { COLORS, COLOR_IDS, type ColorId } from '../../lib/colors'
import { platform } from '../../platform'
import { useInstallPrompt } from '../../platform/install'
import { useAccounts } from '../accounts/AccountsContext'
import { SERVICES, type ServiceId } from '../accounts/services'
import { PANEL_LABELS, accentStyle, type PanelId, type ThemeMode } from './appearance'
import { useAppearance } from './AppearanceContext'

export type SettingsTab = 'appearance' | 'accounts' | 'install'

interface SettingsDialogProps {
  open: boolean
  tab: SettingsTab
  onTabChange: (tab: SettingsTab) => void
  onClose: () => void
  onShowGuide: () => void
}

const TABS: { id: SettingsTab; label: string }[] = [
  { id: 'appearance', label: 'Personalizar' },
  { id: 'accounts', label: 'Cuentas' },
  { id: 'install', label: 'Instalar' },
]

const THEMES: { id: ThemeMode; label: string; icon: ReactNode }[] = [
  { id: 'light', label: 'Claro', icon: <Sun size={16} /> },
  { id: 'dark', label: 'Oscuro', icon: <Moon size={16} /> },
  { id: 'system', label: 'Automático', icon: <Monitor size={16} /> },
]

const PANEL_ICONS: Record<PanelId, ReactNode> = {
  timer: <Timer size={16} />,
  tasks: <ListTodo size={16} />,
  browser: <Compass size={16} />,
  music: <Headphones size={16} />,
}

function Swatches({
  value,
  onChange,
  label,
  inheritLabel,
}: {
  value: ColorId | null
  onChange: (color: ColorId | null) => void
  label: string
  /** Si se pasa, aparece la opción "igual que el color principal". */
  inheritLabel?: string
}) {
  return (
    <div className="swatches" role="radiogroup" aria-label={label}>
      {inheritLabel !== undefined && (
        <button
          type="button"
          role="radio"
          aria-checked={value === null}
          className={`swatch swatch-inherit ${value === null ? 'is-selected' : ''}`}
          title={inheritLabel}
          aria-label={inheritLabel}
          onClick={() => onChange(null)}
        >
          {value === null && <Check size={14} />}
        </button>
      )}
      {COLOR_IDS.map((id) => (
        <button
          key={id}
          type="button"
          role="radio"
          aria-checked={value === id}
          className={`swatch ${value === id ? 'is-selected' : ''}`}
          data-accent={id}
          style={accentStyle(id)}
          title={COLORS[id].label}
          aria-label={COLORS[id].label}
          onClick={() => onChange(id)}
        >
          {value === id && <Check size={14} />}
        </button>
      ))}
    </div>
  )
}

function AppearanceSettings() {
  const appearance = useAppearance()
  return (
    <div className="settings-section">
      <div className="setting">
        <span className="setting-label">Tema</span>
        <div className="segmented" role="radiogroup" aria-label="Tema">
          {THEMES.map((t) => (
            <button
              key={t.id}
              type="button"
              role="radio"
              aria-checked={appearance.theme === t.id}
              className={appearance.theme === t.id ? 'is-active' : ''}
              onClick={() => appearance.setTheme(t.id)}
            >
              {t.icon} {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="setting">
        <span className="setting-label">
          Color principal <span className="setting-value">{COLORS[appearance.accent].label}</span>
        </span>
        <Swatches value={appearance.accent} onChange={(c) => c && appearance.setAccent(c)} label="Color principal" />
      </div>

      <div className="setting">
        <span className="setting-label">Color de cada función</span>
        <p className="hint">El primer círculo usa el color principal.</p>
        {(Object.keys(PANEL_LABELS) as PanelId[]).map((panel) => {
          const own = appearance.panels[panel] ?? null
          return (
            <div key={panel} className="panel-color-row" data-accent={appearance.panelColor(panel)} style={accentStyle(appearance.panelColor(panel))}>
              <span className="panel-color-name">
                <span className="panel-icon" aria-hidden="true">
                  {PANEL_ICONS[panel]}
                </span>
                {PANEL_LABELS[panel]}
              </span>
              <Swatches
                value={own}
                onChange={(c) => appearance.setPanelColor(panel, c)}
                label={`Color de ${PANEL_LABELS[panel]}`}
                inheritLabel="Igual que el color principal"
              />
            </div>
          )
        })}
      </div>

      <button type="button" className="btn btn-link" onClick={appearance.reset}>
        <RotateCcw size={14} /> Volver a los colores de siempre
      </button>
    </div>
  )
}

function AccountsSettings() {
  const accounts = useAccounts()
  return (
    <div className="settings-section">
      <p className="hint hint-box">
        <ShieldCheck size={14} aria-hidden="true" />
        <span>
          Se abre la página oficial de cada servicio para que inicies sesión. Tu contraseña nunca se escribe ni se guarda
          en Student App. Funciona mejor en Chrome o Edge.
        </span>
      </p>
      {(Object.keys(SERVICES) as ServiceId[]).map((id) => {
        const service = SERVICES[id]
        return (
          <div key={id} className="account-card">
            <div className="account-head">
              <span className="panel-icon" aria-hidden="true">
                <UserRound size={16} />
              </span>
              <strong>{service.name}</strong>
            </div>
            <p className="hint">{service.unlocks}</p>
            <div className="account-actions">
              <button type="button" className="btn btn-primary btn-small" onClick={() => accounts.login(id)}>
                <LogIn size={14} /> Iniciar sesión
              </button>
              {service.switchUrl && (
                <button type="button" className="btn btn-small" onClick={() => accounts.switchAccount(id)}>
                  Cambiar de cuenta
                </button>
              )}
              <button type="button" className="btn btn-ghost btn-small" onClick={() => accounts.logout(id)}>
                <LogOut size={14} /> Cerrar sesión
              </button>
            </div>
          </div>
        )
      })}
    </div>
  )
}

function InstallSettings({ onShowGuide }: { onShowGuide: () => void }) {
  const { canInstall, install } = useInstallPrompt()
  return (
    <div className="settings-section">
      <div className="setting">
        <span className="setting-label">Instalar en este ordenador o móvil</span>
        {platform.isInstalled ? (
          <p className="hint hint-box">
            <CircleCheck size={14} aria-hidden="true" />
            <span>Ya estás usando Student App como app instalada.</span>
          </p>
        ) : canInstall ? (
          <>
            <p className="hint">Tendrás su propio icono y ventana, sin pestañas del navegador que distraigan.</p>
            <div>
              <button type="button" className="btn btn-primary" onClick={() => void install()}>
                <Download size={16} /> Instalar Student App
              </button>
            </div>
          </>
        ) : (
          <ul className="install-steps">
            <li>
              <strong>Chrome o Edge (ordenador o Chromebook):</strong> pulsa el icono de instalar de la barra de
              direcciones, o busca «Instalar» en el menú ⋮.
            </li>
            <li>
              <strong>Android:</strong> menú ⋮ → «Añadir a pantalla de inicio».
            </li>
            <li>
              <strong>iPhone o iPad (Safari):</strong> botón Compartir → «Añadir a pantalla de inicio».
            </li>
          </ul>
        )}
      </div>
      <div className="setting">
        <span className="setting-label">Versión de escritorio</span>
        <p className="hint">
          Está en preparación: un programa para Windows, Mac y Linux donde todas las webs se abrirán dentro de la app.
        </p>
      </div>
      <button type="button" className="btn btn-link" onClick={onShowGuide}>
        Ver otra vez la guía de bienvenida
      </button>
    </div>
  )
}

export function SettingsDialog({ open, tab, onTabChange, onClose, onShowGuide }: SettingsDialogProps) {
  return (
    <Modal open={open} title="Ajustes" onClose={onClose} wide>
      <div className="segmented settings-tabs" role="tablist" aria-label="Secciones de ajustes">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            className={tab === t.id ? 'is-active' : ''}
            onClick={() => onTabChange(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>
      {tab === 'appearance' && <AppearanceSettings />}
      {tab === 'accounts' && <AccountsSettings />}
      {tab === 'install' && <InstallSettings onShowGuide={onShowGuide} />}
    </Modal>
  )
}
