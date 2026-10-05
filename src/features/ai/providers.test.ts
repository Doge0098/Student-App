import { describe, expect, it } from 'vitest'
import { cleanKey, hasOddCharacters } from './providers'

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
