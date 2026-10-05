import { describe, expect, it } from 'vitest'
import { pageKey } from '../../lib/web'
import { canRecordNavigation, navigateTab, retitleHistory } from './navigation'
import type { BrowserTab, HistoryItem } from './types'

const start = 'https://es.wikipedia.org/wiki/Roma'
const tab: BrowserTab = { id: 't1', key: pageKey(new URL(start)), url: start, src: start, title: 'Roma', reloads: 0 }

describe('navigateTab', () => {
  it('actualiza la pestaña con la página nueva', () => {
    const nav = navigateTab(tab, 'https://es.wikipedia.org/wiki/Imperio_romano', 'Imperio romano - Wikipedia')
    expect(nav?.samePage).toBe(false)
    expect(nav?.tab).toEqual({
      ...tab,
      url: 'https://es.wikipedia.org/wiki/Imperio_romano',
      key: 'https://es.wikipedia.org/wiki/Imperio_romano',
      src: 'https://es.wikipedia.org/wiki/Imperio_romano',
      title: 'Imperio romano - Wikipedia',
      hint: undefined,
    })
  })

  it('sin título usa uno sacado de la dirección', () => {
    expect(navigateTab(tab, 'https://es.wikipedia.org/wiki/Cartago', '  ')?.title).toBe('Cartago')
  })

  it('detecta cuando solo cambia el título', () => {
    const nav = navigateTab(tab, `${start}#Historia`, 'Roma - Wikipedia')
    expect(nav?.samePage).toBe(true)
    expect(nav?.tab.title).toBe('Roma - Wikipedia')
  })

  it('ignora lo que no cambia nada y las direcciones raras', () => {
    expect(navigateTab(tab, start, 'Roma')).toBeNull()
    expect(navigateTab(tab, 'about:blank', 'x')).toBeNull()
    expect(navigateTab(tab, 'no es un enlace', 'x')).toBeNull()
  })

  it('marca los documentos de Google para avisar de la sesión', () => {
    expect(navigateTab(tab, 'https://docs.google.com/document/d/abc/edit', 'Apuntes')?.tab.hint).toBe('google-login')
  })
})

describe('retitleHistory', () => {
  const url = new URL('https://www.youtube.com/watch?v=jfKfPfyJRdk')
  const item = (patch: Partial<HistoryItem> = {}): HistoryItem => ({
    id: 'h1',
    key: pageKey(url),
    url: url.href,
    title: 'Vídeo de YouTube',
    category: 'video',
    subject: 'general',
    visits: 1,
    lastVisited: 0,
    ...patch,
  })

  it('pone el título real y vuelve a adivinar la asignatura', () => {
    const [h] = retitleHistory([item()], url, 'Las derivadas explicadas', 'Vídeo de YouTube')
    expect(h.title).toBe('Las derivadas explicadas')
    expect(h.subject).toBe('matematicas')
  })

  it('respeta lo que el estudiante ha cambiado a mano', () => {
    expect(retitleHistory([item({ title: 'Mi vídeo' })], url, 'Las derivadas explicadas', 'Vídeo de YouTube')[0].title).toBe('Mi vídeo')
    const [h] = retitleHistory([item({ subject: 'historia', subjectManual: true })], url, 'Las derivadas explicadas', 'x')
    expect(h).toMatchObject({ title: 'Las derivadas explicadas', subject: 'historia' })
  })

  it('no toca otras páginas', () => {
    const other = item({ id: 'h2', key: 'https://otra.com', url: 'https://otra.com/' })
    expect(retitleHistory([other], url, 'Nuevo', 'Vídeo de YouTube')[0]).toBe(other)
  })
})

describe('navigateTab con vídeos (versión embed)', () => {
  it('que la pestaña cargue su propia dirección embed no es una página nueva', () => {
    const watch = 'https://www.youtube.com/watch?v=jfKfPfyJRdk'
    const embed = 'https://www.youtube.com/embed/jfKfPfyJRdk'
    const tab = { id: 't', key: pageKey(new URL(watch)), url: watch, src: embed, title: 'Vídeo de YouTube', reloads: 0 } as BrowserTab
    expect(navigateTab(tab, embed, 'Vídeo de YouTube')).toBeNull()
    const nav = navigateTab(tab, embed, 'lofi hip hop radio')
    expect(nav?.samePage).toBe(true)
    expect(nav?.tab.key).toBe(tab.key)
    expect(nav?.url.href).toBe(watch)
  })
})

describe('canRecordNavigation', () => {
  it('una pestaña no puede llenar el historial: una entrada nueva cada pocos segundos', () => {
    const last = new Map<string, number>()
    expect(canRecordNavigation(last, 'a', 1000)).toBe(true)
    expect(canRecordNavigation(last, 'a', 1500)).toBe(false)
    expect(canRecordNavigation(last, 'b', 1500)).toBe(true)
    expect(canRecordNavigation(last, 'a', 4100)).toBe(true)
  })
})
