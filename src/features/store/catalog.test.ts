import { describe, expect, it } from 'vitest'
import { LEVEL_IDS } from '../profile/profile'
import { DEFAULT_MY_APPS, STORE_APPS, findApp, recommendedApps } from './catalog'

describe('catálogo de la tienda', () => {
  it('no repite apps', () => {
    const ids = STORE_APPS.map((a) => a.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('cada app se puede abrir o descargar, con enlaces https válidos', () => {
    for (const app of STORE_APPS) {
      expect(app.webUrl || app.downloadUrl, app.id).toBeTruthy()
      for (const link of [app.webUrl, app.downloadUrl].filter(Boolean) as string[]) {
        expect(new URL(link).protocol, `${app.id}: ${link}`).toBe('https:')
      }
    }
  })

  it('incluye lo pedido: VS Code, máquinas virtuales y apps de IA', () => {
    expect(findApp('vscode')?.downloadUrl).toContain('code.visualstudio.com')
    expect(STORE_APPS.filter((a) => a.category === 'maquinas').length).toBeGreaterThanOrEqual(3)
    expect(STORE_APPS.filter((a) => a.category === 'ia').length).toBeGreaterThanOrEqual(3)
  })

  it('las apps por defecto existen', () => {
    for (const id of DEFAULT_MY_APPS) expect(findApp(id), id).toBeDefined()
  })
})

describe('recomendaciones por curso', () => {
  it('cada curso tiene sus apps, sin repetir y todas del catálogo', () => {
    for (const level of LEVEL_IDS) {
      const apps = recommendedApps(level)
      expect(apps.length, level).toBeGreaterThanOrEqual(8)
      expect(new Set(apps.map((a) => a.id)).size, level).toBe(apps.length)
    }
  })

  it('sin curso elegido no recomienda nada', () => {
    expect(recommendedApps(null)).toEqual([])
    expect(recommendedApps('inventado' as never)).toEqual([])
  })

  it('Primaria: apps sencillas, sin las avanzadas ni chats de IA', () => {
    const ids = recommendedApps('primaria').map((a) => a.id)
    expect(ids).toEqual(expect.arrayContaining(['scratch', 'khan', 'wikipedia', 'rae', 'translate']))
    for (const advanced of ['overleaf', 'github', 'vscode', 'zotero']) expect(ids).not.toContain(advanced)
    for (const app of recommendedApps('primaria')) {
      expect(['maquinas', 'ia', 'mensajeria'], app.id).not.toContain(app.category)
    }
  })

  it('Universidad: herramientas de investigación y estudio avanzado', () => {
    const ids = recommendedApps('universidad').map((a) => a.id)
    expect(ids).toEqual(expect.arrayContaining(['zotero', 'overleaf', 'anki', 'vscode', 'notebooklm']))
  })

  it('no quita apps de la tienda', () => {
    for (const id of ['virtualbox', 'overleaf', 'github', 'chatgpt']) expect(findApp(id), id).toBeDefined()
  })
})
