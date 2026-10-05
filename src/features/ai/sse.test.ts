import { describe, expect, it } from 'vitest'
import { createSseParser } from './sse'

describe('createSseParser', () => {
  it('lee eventos con nombre y datos', () => {
    const p = createSseParser()
    const events = p.feed('event: message_start\ndata: {"a":1}\n\nevent: ping\ndata: {}\n\n')
    expect(events).toEqual([
      { event: 'message_start', data: '{"a":1}' },
      { event: 'ping', data: '{}' },
    ])
  })

  it('aguanta trozos que cortan líneas por la mitad', () => {
    const p = createSseParser()
    expect(p.feed('data: {"te')).toEqual([])
    expect(p.feed('xt":"ho"}\n')).toEqual([])
    expect(p.feed('\ndata: [DONE]\n\n')).toEqual([
      { event: 'message', data: '{"text":"ho"}' },
      { event: 'message', data: '[DONE]' },
    ])
  })

  it('acepta \\r\\n aunque llegue partido entre dos trozos', () => {
    const p = createSseParser()
    expect(p.feed('data: uno\r')).toEqual([])
    expect(p.feed('\n\r\n')).toEqual([{ event: 'message', data: 'uno' }])
  })

  it('ignora comentarios y junta varias líneas de datos', () => {
    const p = createSseParser()
    expect(p.feed(': keep-alive\ndata: a\ndata: b\n\n')).toEqual([{ event: 'message', data: 'a\nb' }])
  })

  it('entrega el último evento aunque no acabe en línea vacía', () => {
    const p = createSseParser()
    expect(p.feed('data: final')).toEqual([])
    expect(p.end()).toEqual([{ event: 'message', data: 'final' }])
  })
})
