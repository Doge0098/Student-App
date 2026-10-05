import { describe, expect, it } from 'vitest'
import { getEmbed, pageKey } from '../../lib/web'
import { openAllMessage, planOpenAll, type OpenAllOptions } from './openAll'
import type { BrowserTab, HistoryItem } from './types'

function item(url: string, title = url): HistoryItem {
  return {
    id: `h-${url}`,
    key: pageKey(new URL(url)),
    url,
    title,
    category: 'web',
    subject: 'historia',
    visits: 1,
    lastVisited: 0,
  }
}

function tab(url: string, id: string): BrowserTab {
  return { id, key: pageKey(new URL(url)), url, src: url, title: url, reloads: 0 }
}

function options(overrides: Partial<OpenAllOptions> = {}): OpenAllOptions {
  let n = 0
  return {
    maxTabs: 6,
    embed: getEmbed,
    allowed: () => true,
    makeId: () => `new-${++n}`,
    ...overrides,
  }
}

const wiki = (n: number) => `https://es.wikipedia.org/wiki/Pagina_${n}`

describe('planOpenAll', () => {
  it('abre dentro las que se dejan y separa las que no', () => {
    const items = [item(wiki(1)), item('https://www.historiasiglo20.org/'), item('https://www.youtube.com/watch?v=jfKfPfyJRdk')]
    const plan = planOpenAll(items, [], options())
    expect(plan.opened).toBe(2)
    expect(plan.tabs.map((t) => t.src)).toEqual([wiki(1), 'https://www.youtube.com/embed/jfKfPfyJRdk'])
    expect(plan.tabs[0].title).toBe(wiki(1))
    expect(plan.activeId).toBe('new-1')
    expect(plan.external.map((h) => h.url)).toEqual(['https://www.historiasiglo20.org/'])
    expect(plan).toMatchObject({ overflow: 0, skipped: 0, closed: 0 })
  })

  it('respeta el máximo de pestañas y dice cuántas no caben', () => {
    const items = Array.from({ length: 9 }, (_, i) => item(wiki(i)))
    const plan = planOpenAll(items, [], options())
    expect(plan.tabs).toHaveLength(6)
    expect(plan.opened).toBe(6)
    expect(plan.overflow).toBe(3)
  })

  it('reutiliza las pestañas ya abiertas y cierra las más antiguas de otras cosas si hace falta', () => {
    const existing = [tab(wiki(100), 'a'), tab(wiki(101), 'b'), tab(wiki(102), 'c'), tab(wiki(1), 'd')]
    const items = [item(wiki(1)), item(wiki(2)), item(wiki(3)), item(wiki(4))]
    const plan = planOpenAll(items, existing, options())
    expect(plan.tabs).toHaveLength(6)
    // 'd' ya estaba abierta (se reutiliza); para 3 nuevas solo hay sitio para 2 de las 3 de antes: se cierra la más antigua
    expect(plan.tabs.map((t) => t.id)).toEqual(['b', 'c', 'd', 'new-1', 'new-2', 'new-3'])
    expect(plan.activeId).toBe('d')
    expect(plan.opened).toBe(4)
    expect(plan.closed).toBe(1)
  })

  it('no toca las pestañas de antes si hay sitio', () => {
    const existing = [tab(wiki(100), 'a')]
    const plan = planOpenAll([item(wiki(1))], existing, options())
    expect(plan.tabs.map((t) => t.id)).toEqual(['a', 'new-1'])
    expect(plan.closed).toBe(0)
  })

  it('se salta lo que ahora no toca y los enlaces rotos', () => {
    const items = [item('https://www.instagram.com/'), item(wiki(1)), { ...item(wiki(2)), url: 'no es un enlace' }]
    const plan = planOpenAll(items, [], options({ allowed: (url) => !url.hostname.endsWith('instagram.com') }))
    expect(plan.opened).toBe(1)
    expect(plan.skipped).toBe(1)
    expect(plan.external).toEqual([])
  })

  it('en escritorio todo se ve dentro', () => {
    const items = [item('https://www.historiasiglo20.org/'), item('https://classroom.google.com/')]
    const plan = planOpenAll(items, [], options({ embed: (url) => getEmbed(url) ?? { src: url.href } }))
    expect(plan.opened).toBe(2)
    expect(plan.external).toEqual([])
  })

  it('no repite la misma página', () => {
    const plan = planOpenAll([item(wiki(1)), item(`${wiki(1)}#parte`)], [], options())
    expect(plan.opened).toBe(1)
  })
})

describe('openAllMessage', () => {
  const base = { tabs: [], activeId: null, opened: 0, overflow: 0, external: [], skipped: 0, closed: 0 }
  const opts = { subject: 'Historia', maxTabs: 6 }

  it('resume lo abierto', () => {
    expect(openAllMessage({ ...base, opened: 1 }, opts)).toBe('Abierta 1 página de Historia.')
    expect(openAllMessage({ ...base, opened: 6, overflow: 2, closed: 1 }, opts)).toBe(
      'Abiertas 6 páginas de Historia. 2 no caben (máximo 6 pestañas). Cerré 1 pestaña antigua.',
    )
  })

  it('explica que las de fuera no se abren todas de golpe', () => {
    const external = [item('https://a.com/'), item('https://b.com/')]
    expect(openAllMessage({ ...base, opened: 2, external }, opts)).toBe(
      'Abiertas 2 páginas de Historia. Otras 2 solo se abren fuera: ábrelas desde la lista.',
    )
    expect(openAllMessage({ ...base, external }, { ...opts, firstExternal: 'A' })).toBe(
      '«A» se ha abierto en una pestaña nueva. Otra solo se abre fuera: ábrela desde la lista.',
    )
    expect(openAllMessage({ ...base, external: external.slice(0, 1) }, { ...opts, firstExternal: 'A' })).toBe(
      '«A» se ha abierto en una pestaña nueva.',
    )
  })

  it('avisa de las distracciones que no se abren', () => {
    expect(openAllMessage({ ...base, skipped: 2 }, opts)).toBe('2 no se abren ahora porque distraen.')
    expect(openAllMessage(base, opts)).toBe('No hay nada de Historia que abrir.')
  })
})
