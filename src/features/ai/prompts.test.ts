import { describe, expect, it } from 'vitest'
import { MAX_INPUT_CHARS, MAX_QUESTION_CHARS, cardsSystem, chatHistory, chatSystem, checkQuestion, checkSource, quizSystem, sourceMessage, studentLine } from './prompts'

describe('instrucciones', () => {
  it('se adaptan al curso', () => {
    expect(studentLine('primaria')).toContain('Primaria')
    expect(studentLine('universidad')).toContain('universitario')
    expect(studentLine(null)).toContain('no sabes su curso')
    expect(chatSystem('eso')).toContain('ESO')
    expect(chatSystem('eso')).toContain('español')
  })

  it('el test y las tarjetas describen el JSON esperado (sirve aunque el modelo no admita esquemas)', () => {
    expect(quizSystem('bachillerato', 10)).toContain('10 preguntas')
    expect(quizSystem('bachillerato', 10)).toContain('"questions"')
    expect(cardsSystem(null, 20)).toContain('hasta 20 tarjetas')
    expect(cardsSystem(null, 20)).toContain('"cards"')
  })

  it('el texto de estudio va delimitado', () => {
    expect(sourceMessage('  Hola  ', 'Tema 1')).toEqual({ role: 'user', text: 'Título: Tema 1\n\n<texto>\nHola\n</texto>' })
    expect(sourceMessage('Hola').text).toBe('<texto>\nHola\n</texto>')
  })
})

describe('checkSource / checkQuestion', () => {
  it('avisa si falta texto o sobra', () => {
    expect(checkSource('   ')).toMatch(/Escribe o pega/)
    expect(checkSource('corto')).toMatch(/muy corto/)
    expect(checkSource('a'.repeat(100))).toBeNull()
    expect(checkSource('a'.repeat(MAX_INPUT_CHARS + 1))).toMatch(/demasiado largo/)
    expect(checkQuestion('')).toMatch(/Escribe tu pregunta/)
    expect(checkQuestion('¿?')).toBeNull()
    expect(checkQuestion('a'.repeat(MAX_QUESTION_CHARS + 1))).toMatch(/demasiado largo/)
  })
})

describe('chatHistory', () => {
  const msgs = [
    { role: 'user' as const, text: 'P1' },
    { role: 'assistant' as const, text: 'R1' },
    { role: 'user' as const, text: 'P2' },
    { role: 'assistant' as const, text: '', failed: true },
    { role: 'user' as const, text: 'P3' },
    { role: 'assistant' as const, text: 'R3' },
  ]

  it('manda solo pares completos y acaba con la pregunta nueva', () => {
    expect(chatHistory(msgs, 'P4')).toEqual([
      { role: 'user', text: 'P1' },
      { role: 'assistant', text: 'R1' },
      { role: 'user', text: 'P3' },
      { role: 'assistant', text: 'R3' },
      { role: 'user', text: 'P4' },
    ])
  })

  it('si no cabe todo, se queda con lo más reciente', () => {
    expect(chatHistory(msgs, 'P4', 6)).toEqual([
      { role: 'user', text: 'P3' },
      { role: 'assistant', text: 'R3' },
      { role: 'user', text: 'P4' },
    ])
    expect(chatHistory(msgs, 'P4', 2)).toEqual([{ role: 'user', text: 'P4' }])
  })

  it('empieza siempre por el estudiante', () => {
    expect(chatHistory([{ role: 'assistant', text: 'Hola' }], 'P')[0].role).toBe('user')
  })
})
