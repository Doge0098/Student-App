import type { CSSProperties } from 'react'
import { COLORS, DEFAULT_COLOR, type ColorId } from '../../lib/colors'

export type ThemeMode = 'light' | 'dark' | 'system'
export type PanelId = 'timer' | 'tasks' | 'browser' | 'music'

export const PANEL_LABELS: Record<PanelId, string> = {
  timer: 'Temporizador',
  tasks: 'Tareas',
  browser: 'Navegador',
  music: 'Música',
}

/** Variables CSS que pintan un elemento (y lo que contiene) con un color de la paleta. */
export function accentStyle(color: ColorId): CSSProperties {
  const c = COLORS[color] ?? COLORS[DEFAULT_COLOR]
  return { '--accent-light': c.light, '--accent-dark': c.dark } as CSSProperties
}
