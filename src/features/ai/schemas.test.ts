import { describe, expect, it } from 'vitest'
import { AiError } from './errors'
import { CARDS_SCHEMA, QUIZ_SCHEMA, extractJson, parseCards, parseQuiz, toGeminiSchema } from './schemas'

const question = (over: Record<string, unknown> = {}) => ({
  question: '¿Capital de Francia?',
  options: ['Madrid', 'París', 'Roma', 'Berlín'],
  answer: 1,
  explanation: 'París es la capital.',
  ...over,
})

describe('extractJson', () => {
  it('lee JSON limpio, dentro de ``` o con texto alrededor', () => {
    expect(extractJson('{"a":1}')).toEqual({ a: 1 })
    expect(extractJson('Aquí tienes:\n```json\n{"a":2}\n```\n¡Suerte!')).toEqual({ a: 2 })
    expect(extractJson('Claro. {"a":3} Espero que ayude')).toEqual({ a: 3 })
    expect(extractJson('[1,2]')).toEqual([1, 2])
  })

  it('da un error amable si no hay JSON', () => {
    expect(() => extractJson('Lo siento, no puedo')).toThrow(AiError)
    try {
      extractJson('nada')
    } catch (e) {
      expect((e as AiError).kind).toBe('bad_output')
      expect((e as AiError).message).toMatch(/Vuelve a intentarlo/)
    }
  })
})

describe('parseQuiz', () => {
  it('lee preguntas válidas y respeta el máximo', () => {
    const raw = JSON.stringify({ questions: [question(), question({ question: '¿2+2?', options: ['3', '4'], answer: 1 }), question({ question: 'Otra' })] })
    const quiz = parseQuiz(raw, 2)
    expect(quiz).toHaveLength(2)
    expect(quiz[0]).toEqual(question())
  })

  it('descarta preguntas mal formadas', () => {
    const raw = JSON.stringify({
      questions: [
        question({ answer: 7 }), // fuera de rango
        question({ options: ['Solo una'] }), // pocas opciones
        question({ options: ['A', 'a', 'B'] }), // repetidas
        question({ options: ['A', '', 'B'], answer: 0 }), // opción vacía
        question({ question: '' }),
        'texto suelto',
        question({ question: 'Buena' }),
      ],
    })
    expect(parseQuiz(raw, 10).map((q) => q.question)).toEqual(['Buena'])
  })

  it('acepta formas parecidas (respuesta como texto o número en texto, claves en español)', () => {
    const raw = JSON.stringify([
      { pregunta: 'P1', opciones: ['A', 'B', 'C'], correcta: 'C', explicacion: 'Porque sí' },
      { question: 'P2', options: ['A', 'B'], answer: '0' },
    ])
    expect(parseQuiz(raw, 5)).toEqual([
      { question: 'P1', options: ['A', 'B', 'C'], answer: 2, explanation: 'Porque sí' },
      { question: 'P2', options: ['A', 'B'], answer: 0, explanation: '' },
    ])
  })

  it('si no hay ninguna válida, error amable', () => {
    expect(() => parseQuiz('{"questions":[]}', 5)).toThrow(AiError)
    expect(() => parseQuiz('{"questions":[{"question":"x"}]}', 5)).toThrow(/no ha devuelto/)
  })
})

describe('parseCards', () => {
  it('lee tarjetas, quita repetidas y vacías, y respeta el máximo', () => {
    const raw = JSON.stringify({
      cards: [
        { front: 'Mitocondria', back: 'Produce energía' },
        { front: 'mitocondria', back: 'Repetida' },
        { front: '', back: 'Sin pregunta' },
        { question: 'ADN', answer: 'Material genético' },
        { front: 'Ribosoma', back: 'Fabrica proteínas' },
      ],
    })
    expect(parseCards(raw, 2)).toEqual([
      { front: 'Mitocondria', back: 'Produce energía' },
      { front: 'ADN', back: 'Material genético' },
    ])
  })

  it('error amable si no hay tarjetas', () => {
    expect(() => parseCards('{"cards":[{"front":"x"}]}', 5)).toThrow(AiError)
  })
})

describe('esquemas', () => {
  it('cumplen lo que exigen OpenAI y Anthropic (objetos cerrados con todos los campos obligatorios)', () => {
    const check = (s: typeof QUIZ_SCHEMA) => {
      if (s.type === 'object') {
        expect(s.additionalProperties).toBe(false)
        expect([...(s.required ?? [])].sort()).toEqual(Object.keys(s.properties ?? {}).sort())
        Object.values(s.properties ?? {}).forEach(check)
      }
      if (s.items) check(s.items)
    }
    check(QUIZ_SCHEMA)
    check(CARDS_SCHEMA)
  })

  it('se convierten al formato de Gemini', () => {
    const g = toGeminiSchema(CARDS_SCHEMA)
    expect(g).toEqual({
      type: 'OBJECT',
      properties: {
        cards: {
          type: 'ARRAY',
          items: {
            type: 'OBJECT',
            properties: {
              front: { type: 'STRING', description: 'Pregunta o concepto' },
              back: { type: 'STRING', description: 'Respuesta corta' },
            },
            propertyOrdering: ['front', 'back'],
            required: ['front', 'back'],
          },
        },
      },
      propertyOrdering: ['cards'],
      required: ['cards'],
    })
  })
})
