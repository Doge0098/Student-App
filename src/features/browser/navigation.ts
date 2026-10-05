import { deriveTitle, detectSubjectForUrl, getEmbed, pageKey } from '../../lib/web'
import type { BrowserTab, HistoryItem } from './types'

export interface Navigation {
  /** La pestaña con la página nueva. */
  tab: BrowserTab
  url: URL
  title: string
  /** Sigue en la misma página (solo ha cambiado el título). */
  samePage: boolean
}

/**
 * Escritorio: la página de una pestaña ha cambiado (enlace pulsado dentro o título nuevo).
 * Devuelve la pestaña actualizada, o null si no hay nada que cambiar.
 * `src` pasa a ser la página real: solo se usa al recargar o al volver a abrir LockIn.
 */
export function navigateTab(tab: BrowserTab, rawUrl: string, rawTitle: string): Navigation | null {
  let url: URL
  try {
    url = new URL(rawUrl)
  } catch {
    return null
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null
  const key = pageKey(url)
  const title = rawTitle.trim() || deriveTitle(url)
  // Un vídeo se muestra con su versión «embed»: que cargue esa dirección no es una página nueva.
  if (tab.src !== tab.url && key === pageKey(new URL(tab.src))) {
    if (title === tab.title) return null
    return { tab: { ...tab, title }, url: new URL(tab.url), title, samePage: true }
  }
  const samePage = key === tab.key
  if (samePage && title === tab.title) return null
  return {
    tab: { ...tab, url: url.href, key, title, src: url.href, hint: getEmbed(url)?.hint },
    url,
    title,
    samePage,
  }
}

/**
 * La página ya guardada trae su título de verdad: se corrige en el historial (y se vuelve a
 * adivinar la asignatura), salvo que el estudiante la haya renombrado o elegido la asignatura a mano.
 */
export function retitleHistory(history: HistoryItem[], url: URL, title: string, previousTitle: string): HistoryItem[] {
  const key = pageKey(url)
  const derived = deriveTitle(url)
  return history.map((h) =>
    h.key === key && h.title !== title && (h.title === previousTitle || h.title === derived)
      ? { ...h, title, subject: h.subjectManual ? h.subject : detectSubjectForUrl(url, title) }
      : h,
  )
}

/** Mínimo entre dos páginas nuevas guardadas en el historial desde la misma pestaña. */
export const MIN_RECORD_GAP_MS = 3000

/** Dice si ya se puede guardar otra página de esta pestaña y apunta el momento si es así. */
export function canRecordNavigation(last: Map<string, number>, tabId: string, now: number): boolean {
  const before = last.get(tabId)
  if (before !== undefined && now - before < MIN_RECORD_GAP_MS) return false
  last.set(tabId, now)
  return true
}
