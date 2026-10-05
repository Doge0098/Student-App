import { describe, expect, it } from 'vitest'
import { PROVIDERS, cleanKey, hasOddCharacters } from './providers'

describe('cleanKey', () => {
  it('quita comillas normales y tipográficas, espacios y caracteres invisibles', () => {
    expect(cleanKey('  "sk-proj-abc123"  ')).toBe('sk-proj-abc123')
    expect(cleanKey('“sk-proj-abc123”')).toBe('sk-proj-abc123')
    expect(cleanKey('sk-proj-abc123​')).toBe('sk-proj-abc123')
    expect(cleanKey('sk-proj-\nabc123')).toBe('sk-proj-abc123')
  })

  it('detecta lo que no puede ir en una clave', () => {
    expect(hasOddCharacters('sk-proj-abc123')).toBe(false)
    expect(hasOddCharacters('sk-pröj-abc')).toBe(true)
  })
})

describe('mini manual de cada IA', () => {
  it('cada IA explica cómo conseguir la clave', () => {
    for (const info of Object.values(PROVIDERS)) {
      expect(info.keySteps.length, info.name).toBeGreaterThanOrEqual(3)
      expect(new URL(info.keyUrl).protocol).toBe('https:')
    }
  })

  it('avisa de que pagar la suscripción no incluye la API (Claude y ChatGPT)', () => {
    expect(PROVIDERS.anthropic.keySteps.join(' ')).toMatch(/no incluye la API/)
    expect(PROVIDERS.openai.keySteps.join(' ')).toMatch(/no incluye la API/)
  })
})
