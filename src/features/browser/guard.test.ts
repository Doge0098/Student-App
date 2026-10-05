import { describe, expect, it } from 'vitest'
import { blockedSites, checkSite, timerFlags, type GuardContext } from './guard'

const u = (s: string) => new URL(s)
const focus = { focusRunning: true, onBreak: false }
const rest = { focusRunning: false, onBreak: true }
const idle = { focusRunning: false, onBreak: false }
const ctx = (mode: GuardContext['mode'], timer: typeof focus, extra: string[] = []): GuardContext => ({
  mode,
  extraDistractions: extra,
  ...timer,
})

describe('timerFlags', () => {
  it('solo cuenta lo que está corriendo', () => {
    expect(timerFlags({ phase: 'focus', status: 'running' })).toEqual(focus)
    expect(timerFlags({ phase: 'break', status: 'running' })).toEqual(rest)
    // Pausar no levanta el bloqueo: si no, bastaría con pausar para abrir la distracción.
    expect(timerFlags({ phase: 'focus', status: 'paused' })).toEqual(focus)
    expect(timerFlags({ phase: 'focus', status: 'finished' })).toEqual(idle)
    expect(timerFlags({ phase: 'idle', status: 'paused' })).toEqual(idle)
  })
})

describe('checkSite', () => {
  it('deja pasar las webs de estudio en cualquier modo', () => {
    for (const mode of ['suave', 'normal', 'estricto'] as const) {
      expect(checkSite(u('https://es.wikipedia.org/wiki/Roma'), ctx(mode, focus))).toEqual({
        action: 'allow',
        kind: null,
        label: null,
        own: false,
      })
    }
  })

  it('aplica el modo a las distracciones', () => {
    const insta = u('https://www.instagram.com/reels/')
    expect(checkSite(insta, ctx('suave', idle)).action).toBe('allow')
    expect(checkSite(insta, ctx('normal', idle)).action).toBe('warn')
    expect(checkSite(insta, ctx('normal', rest)).action).toBe('allow')
    expect(checkSite(insta, ctx('estricto', focus))).toEqual({
      action: 'block',
      kind: 'distraction',
      label: 'Instagram',
      own: false,
    })
  })

  it('trata la mensajería aparte', () => {
    const wa = u('https://web.whatsapp.com/')
    expect(checkSite(wa, ctx('normal', idle)).action).toBe('allow')
    expect(checkSite(wa, ctx('normal', focus))).toMatchObject({ action: 'warn', kind: 'messaging', label: 'WhatsApp' })
    expect(checkSite(wa, ctx('estricto', focus)).action).toBe('block')
  })

  it('usa «Mis distracciones», también por encima de la mensajería', () => {
    expect(checkSite(u('https://www.marca.com/'), ctx('estricto', focus, ['marca.com']))).toEqual({
      action: 'block',
      kind: 'distraction',
      label: 'marca.com',
      own: true,
    })
    expect(checkSite(u('https://web.whatsapp.com/'), ctx('normal', idle, ['whatsapp.com']))).toMatchObject({
      action: 'warn',
      kind: 'distraction',
    })
  })
})

describe('blockedSites', () => {
  it('solo bloquea en modo Estricto durante la concentración', () => {
    expect(blockedSites(ctx('estricto', idle))).toEqual([])
    expect(blockedSites(ctx('estricto', rest))).toEqual([])
    expect(blockedSites(ctx('normal', focus))).toEqual([])
    expect(blockedSites(ctx('suave', focus))).toEqual([])
  })

  it('incluye distracciones, mensajería y la lista propia', () => {
    const hosts = blockedSites(ctx('estricto', focus, ['marca.com', 'https://www.as.com/x']))
    expect(hosts).toEqual(expect.arrayContaining(['instagram.com', 'tiktok.com', 'whatsapp.com', 'discord.com', 'marca.com', 'as.com']))
    expect(hosts).not.toContain('youtube.com')
    expect(new Set(hosts).size).toBe(hosts.length)
  })
})
