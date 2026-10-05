/**
 * Paleta de colores predefinidos para personalizar la app.
 * Cada color tiene una versión para el tema claro y otra para el oscuro,
 * elegidas para que el texto sobre ellas se lea bien en ambos.
 */
export const COLORS = {
  indigo: { label: 'Índigo', light: '#5b5bd6', dark: '#8d8eff' },
  azul: { label: 'Azul', light: '#2563eb', dark: '#6ea8ff' },
  cian: { label: 'Azul cian', light: '#0079b8', dark: '#29c5f6' },
  turquesa: { label: 'Turquesa', light: '#0e7c86', dark: '#4fd1c5' },
  verde: { label: 'Verde', light: '#1a7d48', dark: '#5fd68f' },
  naranja: { label: 'Naranja', light: '#c2410c', dark: '#ffa260' },
  rosa: { label: 'Rosa', light: '#c2185b', dark: '#ff7eb6' },
  rojo: { label: 'Rojo', light: '#c53030', dark: '#ff8080' },
  morado: { label: 'Morado', light: '#7c3aed', dark: '#b794ff' },
  grafito: { label: 'Grafito', light: '#475569', dark: '#a3b1c6' },
} as const

export type ColorId = keyof typeof COLORS

export const COLOR_IDS = Object.keys(COLORS) as ColorId[]

export const DEFAULT_COLOR: ColorId = 'indigo'

export function isColorId(value: unknown): value is ColorId {
  return typeof value === 'string' && value in COLORS
}
