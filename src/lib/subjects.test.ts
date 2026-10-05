import { describe, expect, it } from 'vitest'
import { detectSubject } from './subjects'

describe('detectSubject', () => {
  it('reconoce la asignatura por palabras clave, con o sin tildes', () => {
    expect(detectSubject('Ejercicios de ecuaciones de segundo grado')).toBe('matematicas')
    expect(detectSubject('Resumen de la fotosíntesis y la célula')).toBe('biologia')
    expect(detectSubject('Trabajo sobre la Guerra Civil')).toBe('historia')
    expect(detectSubject('Analisis sintactico de oraciones')).toBe('lengua')
    expect(detectSubject('Phrasal verbs list for English exam')).toBe('idiomas')
    expect(detectSubject('Formulación química inorgánica')).toBe('quimica')
    expect(detectSubject('Practicar bucles en Python')).toBe('informatica')
  })

  it('usa la web como pista', () => {
    expect(detectSubject('calculator', 'www.desmos.com')).toBe('matematicas')
    expect(detectSubject('', 'www.duolingo.com')).toBe('idiomas')
  })

  it('devuelve General si no hay pistas', () => {
    expect(detectSubject('Comprar cartulina')).toBe('general')
    expect(detectSubject('')).toBe('general')
  })
})
