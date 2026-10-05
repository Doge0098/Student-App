import { pageKey, type EmbedInfo } from '../../lib/web'
import type { BrowserTab, HistoryItem } from './types'

export interface OpenAllOptions {
  maxTabs: number
  /** Cómo se ve la web dentro de la app (null = solo en pestaña nueva). */
  embed: (url: URL) => EmbedInfo | null
  /** ¿Se puede abrir ahora? (las distracciones dependen del modo y del temporizador). */
  allowed: (url: URL) => boolean
  makeId: () => string
}

export interface OpenAllPlan {
  /** Pestañas que quedan: las de antes que caben y, al final, las nuevas. */
  tabs: BrowserTab[]
  /** Pestaña que se activa: la primera página del lote. */
  activeId: string | null
  /** Páginas del lote que quedan abiertas dentro (nuevas o que ya lo estaban). */
  opened: number
  /** Se podrían ver dentro pero no caben. */
  overflow: number
  /** No se dejan mostrar dentro. No se abren todas de golpe (bloqueador de ventanas y más distracción). */
  external: HistoryItem[]
  /** Distracciones o mensajería que ahora no tocan. */
  skipped: number
  /** Pestañas abiertas antes que se cierran para hacer sitio. */
  closed: number
}

function parse(url: string): URL | null {
  try {
    return new URL(url)
  } catch {
    return null
  }
}

/**
 * «Abrir todo» de una asignatura: las páginas que se dejan ver dentro van a pestañas internas
 * (hasta el máximo; si hace falta se cierran las pestañas más antiguas de otras cosas), y las que no,
 * se devuelven aparte para no abrir un montón de ventanas.
 */
export function planOpenAll(items: readonly HistoryItem[], existing: readonly BrowserTab[], options: OpenAllOptions): OpenAllPlan {
  const { maxTabs, embed, allowed, makeId } = options
  const candidates: { item: HistoryItem; url: URL; key: string; info: EmbedInfo }[] = []
  const external: HistoryItem[] = []
  const seen = new Set<string>()
  let skipped = 0

  for (const item of items) {
    const url = parse(item.url)
    if (!url) continue
    if (!allowed(url)) {
      skipped++
      continue
    }
    const key = pageKey(url)
    if (seen.has(key)) continue
    seen.add(key)
    const info = embed(url)
    if (info) candidates.push({ item, url, key, info })
    else external.push(item)
  }

  const limit = Math.max(0, maxTabs)
  const batch = candidates.slice(0, limit)
  const overflow = candidates.length - batch.length

  const newTabs: BrowserTab[] = []
  const batchTabs = batch.map(({ item, url, key, info }) => {
    const open = existing.find((t) => t.key === key)
    if (open) return open
    const tab: BrowserTab = { id: makeId(), key, url: url.href, src: info.src, title: item.title, hint: info.hint, reloads: 0 }
    newTabs.push(tab)
    return tab
  })

  // Las pestañas que no son del lote se quedan si hay sitio (primero se cierran las más antiguas).
  const batchIds = new Set(batchTabs.map((t) => t.id))
  const others = existing.filter((t) => !batchIds.has(t.id))
  const room = Math.max(0, limit - batchTabs.length)
  const kept = new Set(others.slice(Math.max(0, others.length - room)).map((t) => t.id))
  const tabs = [...existing.filter((t) => batchIds.has(t.id) || kept.has(t.id)), ...newTabs]

  return {
    tabs,
    activeId: batchTabs[0]?.id ?? null,
    opened: batchTabs.length,
    overflow,
    external,
    skipped,
    closed: others.length - kept.size,
  }
}

const plural = (n: number, one: string, many: string) => (n === 1 ? one : many)

/**
 * Resumen corto y sincero de lo que ha hecho «Abrir todo».
 * `firstExternal`: si no había nada que ver dentro, se abre solo la primera página en una pestaña nueva.
 */
export function openAllMessage(
  plan: OpenAllPlan,
  options: { subject: string; maxTabs: number; firstExternal?: string | null },
): string {
  const { subject, maxTabs, firstExternal } = options
  const parts: string[] = []
  let outside = plan.external.length

  if (plan.opened > 0) {
    parts.push(
      `${plural(plan.opened, 'Abierta 1 página', `Abiertas ${plan.opened} páginas`)} de ${subject}.`,
    )
    if (plan.overflow > 0) parts.push(`${plan.overflow} no ${plural(plan.overflow, 'cabe', 'caben')} (máximo ${maxTabs} pestañas).`)
    if (plan.closed > 0) parts.push(`Cerré ${plan.closed} ${plural(plan.closed, 'pestaña antigua', 'pestañas antiguas')}.`)
  } else if (firstExternal) {
    parts.push(`«${firstExternal}» se ha abierto en una pestaña nueva.`)
    outside--
  }

  if (outside > 0) {
    parts.push(
      plan.opened > 0 || firstExternal
        ? `${plural(outside, 'Otra solo se abre', `Otras ${outside} solo se abren`)} fuera: ${plural(outside, 'ábrela', 'ábrelas')} desde la lista.`
        : `${plural(outside, 'Esta página solo se abre', `Estas ${outside} páginas solo se abren`)} fuera: ${plural(outside, 'ábrela', 'ábrelas')} desde la lista.`,
    )
  }
  if (plan.skipped > 0) {
    parts.push(`${plan.skipped} no se ${plural(plan.skipped, 'abre', 'abren')} ahora porque ${plural(plan.skipped, 'distrae', 'distraen')}.`)
  }
  return parts.length > 0 ? parts.join(' ') : `No hay nada de ${subject} que abrir.`
}
