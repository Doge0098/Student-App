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
