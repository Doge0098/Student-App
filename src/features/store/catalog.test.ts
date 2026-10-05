import { describe, expect, it } from 'vitest'
import { DEFAULT_MY_APPS, STORE_APPS, findApp } from './catalog'

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
