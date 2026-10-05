/** Evento de Server-Sent Events (lo que mandan los proveedores al responder poco a poco). */
export interface SseEvent {
  event: string
  data: string
}

/**
 * Lector de SSE por trozos: se le dan los trozos de texto tal como llegan (pueden cortar una
 * línea por la mitad) y devuelve los eventos completos.
 */
export function createSseParser() {
  let buffer = ''
  let event = ''
  let data: string[] = []

  const processLine = (line: string, out: SseEvent[]) => {
    if (line === '') {
      if (data.length > 0) out.push({ event: event || 'message', data: data.join('\n') })
      event = ''
      data = []
      return
    }
    if (line.startsWith(':')) return
    const colon = line.indexOf(':')
    const field = colon === -1 ? line : line.slice(0, colon)
    let value = colon === -1 ? '' : line.slice(colon + 1)
    if (value.startsWith(' ')) value = value.slice(1)
    if (field === 'event') event = value
    else if (field === 'data') data.push(value)
  }

  return {
    feed(chunk: string): SseEvent[] {
      const out: SseEvent[] = []
      buffer += chunk
      for (;;) {
        const match = /\r\n|\r|\n/.exec(buffer)
        if (!match) break
        // Un \r al final puede ser la mitad de un \r\n: se espera al siguiente trozo.
        if (match[0] === '\r' && match.index === buffer.length - 1) break
        const line = buffer.slice(0, match.index)
        buffer = buffer.slice(match.index + match[0].length)
        processLine(line, out)
      }
      return out
    },
    end(): SseEvent[] {
      const out: SseEvent[] = []
      if (buffer) processLine(buffer.replace(/\r$/, ''), out)
      buffer = ''
      processLine('', out)
      return out
    },
  }
}
