import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useState, type ReactNode } from 'react'
import { usePersistentState } from '../../hooks/usePersistentState'
import { COLORS, DEFAULT_COLOR, isColorId, type ColorId } from '../../lib/colors'
import type { PanelId, ThemeMode } from './appearance'

interface Appearance {
  theme: ThemeMode
  accent: ColorId
  /** Color propio de cada función. Si falta, usa el color principal. */
  panels: Partial<Record<PanelId, ColorId>>
}

const DEFAULT_APPEARANCE: Appearance = { theme: 'system', accent: DEFAULT_COLOR, panels: {} }

interface AppearanceValue extends Appearance {
  /** Tema que se ve ahora mismo (resuelve "automático"). */
  resolvedTheme: 'light' | 'dark'
  setTheme: (theme: ThemeMode) => void
  setAccent: (color: ColorId) => void
  setPanelColor: (panel: PanelId, color: ColorId | null) => void
  panelColor: (panel: PanelId) => ColorId
  reset: () => void
}

const AppearanceContext = createContext<AppearanceValue | null>(null)

function systemPrefersDark() {
  return window.matchMedia('(prefers-color-scheme: dark)').matches
}

export function AppearanceProvider({ children }: { children: ReactNode }) {
  const [stored, setStored] = usePersistentState<Appearance>('appearance', DEFAULT_APPEARANCE)
  const [systemDark, setSystemDark] = useState(systemPrefersDark)

  // Datos guardados de versiones anteriores o modificados a mano: se sanean.
  const appearance: Appearance = useMemo(
    () => ({
      theme: ['light', 'dark', 'system'].includes(stored.theme) ? stored.theme : 'system',
      accent: isColorId(stored.accent) ? stored.accent : DEFAULT_COLOR,
      panels: stored.panels ?? {},
    }),
    [stored],
  )

  useEffect(() => {
    const query = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => setSystemDark(query.matches)
    query.addEventListener('change', onChange)
    return () => query.removeEventListener('change', onChange)
  }, [])

  const resolvedTheme = appearance.theme === 'system' ? (systemDark ? 'dark' : 'light') : appearance.theme

  useLayoutEffect(() => {
    const root = document.documentElement
    root.dataset.theme = resolvedTheme
    const c = COLORS[appearance.accent]
    root.style.setProperty('--accent-light', c.light)
    root.style.setProperty('--accent-dark', c.dark)
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', resolvedTheme === 'dark' ? c.dark : c.light)
  }, [resolvedTheme, appearance.accent])

  const setTheme = useCallback((theme: ThemeMode) => setStored((s) => ({ ...s, theme })), [setStored])
  const setAccent = useCallback((accent: ColorId) => setStored((s) => ({ ...s, accent })), [setStored])
  const setPanelColor = useCallback(
    (panel: PanelId, color: ColorId | null) =>
      setStored((s) => {
        const panels = { ...s.panels }
        if (color) panels[panel] = color
        else delete panels[panel]
        return { ...s, panels }
      }),
    [setStored],
  )
  const reset = useCallback(() => setStored(DEFAULT_APPEARANCE), [setStored])

  const value = useMemo<AppearanceValue>(
    () => ({
      ...appearance,
      resolvedTheme,
      setTheme,
      setAccent,
      setPanelColor,
      panelColor: (panel) => {
        const color = appearance.panels[panel]
        return isColorId(color) ? color : appearance.accent
      },
      reset,
    }),
    [appearance, resolvedTheme, setTheme, setAccent, setPanelColor, reset],
  )

  return <AppearanceContext.Provider value={value}>{children}</AppearanceContext.Provider>
}

// oxlint-disable-next-line react/only-export-components
export function useAppearance(): AppearanceValue {
  const ctx = useContext(AppearanceContext)
  if (!ctx) throw new Error('useAppearance debe usarse dentro de <AppearanceProvider>')
  return ctx
}
