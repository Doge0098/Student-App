import { describe, expect, it } from 'vitest'
import { parseInline, parseRichText } from './richText'

describe('parseInline', () => {
  it('negrita y código', () => {
    expect(parseInline('La **derivada** de `x^2` es 2x')).toEqual([
      { text: 'La ' },
      { text: 'derivada', bold: true },
      { text: ' de ' },
      { text: 'x^2', code: true },
      { text: ' es 2x' },
    ])
    expect(parseInline('__clave__')).toEqual([{ text: 'clave', bold: true }])
  })

  it('lo que no cierra se queda como texto', () => {
    expect(parseInline('2 * 3 = 6 y **sin cerrar')).toEqual([{ text: '2 * 3 = 6 y **sin cerrar' }])
  })
})

describe('parseRichText', () => {
  it('párrafos, títulos, listas y código', () => {
    const text = [
      '## Idea clave',
      'Una línea',
      'y otra.',
      '',
      '- uno',
      '* dos',
      '1. primero',
      '2) segundo',
      '```',
      'print(1)',
      '```',
      '**Negrita** al empezar',
    ].join('\n')
    expect(parseRichText(text)).toEqual([
      { kind: 'h', inline: [{ text: 'Idea clave' }] },
      { kind: 'p', lines: [[{ text: 'Una línea' }], [{ text: 'y otra.' }]] },
      { kind: 'ul', items: [[{ text: 'uno' }], [{ text: 'dos' }]] },
      { kind: 'ol', items: [[{ text: 'primero' }], [{ text: 'segundo' }]] },
      { kind: 'pre', text: 'print(1)' },
      { kind: 'p', lines: [[{ text: 'Negrita', bold: true }, { text: ' al empezar' }]] },
    ])
  })

  it('texto vacío o un bloque de código sin cerrar', () => {
    expect(parseRichText('')).toEqual([])
    expect(parseRichText('```\nabc')).toEqual([{ kind: 'pre', text: 'abc' }])
  })
})
