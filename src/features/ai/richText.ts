/**
 * Formato mínimo para las respuestas de la IA: párrafos, listas, títulos, **negrita** y `código`.
 * Se convierte en bloques que React pinta como elementos normales (nunca se inserta HTML).
 */

export interface Inline {
  text: string
  bold?: boolean
  code?: boolean
}

export type Block =
  | { kind: 'p'; lines: Inline[][] }
  | { kind: 'h'; inline: Inline[] }
  | { kind: 'ul' | 'ol'; items: Inline[][] }
  | { kind: 'pre'; text: string }

/** Negrita (**…** o __…__) y código (`…`). Lo que no cierra se deja como texto. */
export function parseInline(text: string): Inline[] {
  const out: Inline[] = []
  const pattern = /\*\*(.+?)\*\*|__(.+?)__|`([^`]+)`/g
  let last = 0
  for (let match = pattern.exec(text); match; match = pattern.exec(text)) {
    if (match.index > last) out.push({ text: text.slice(last, match.index) })
    if (match[3] !== undefined) out.push({ text: match[3], code: true })
    else out.push({ text: match[1] ?? match[2], bold: true })
    last = match.index + match[0].length
  }
  if (last < text.length) out.push({ text: text.slice(last) })
  return out
}

const BULLET = /^\s*[-*•]\s+(.*)$/
const NUMBERED = /^\s*\d+[.)]\s+(.*)$/
const HEADING = /^\s*#{1,6}\s+(.*)$/
const FENCE = /^\s*```/

const isSpecial = (line: string) => FENCE.test(line) || HEADING.test(line) || BULLET.test(line) || NUMBERED.test(line)

export function parseRichText(text: string): Block[] {
  const blocks: Block[] = []
  const lines = text.replace(/\r\n?/g, '\n').split('\n')
  let i = 0
  while (i < lines.length) {
    const line = lines[i]
    if (!line.trim()) {
      i++
      continue
    }
    if (FENCE.test(line)) {
      const body: string[] = []
      i++
      while (i < lines.length && !FENCE.test(lines[i])) body.push(lines[i++])
      i++ // cierre del bloque (si lo hay)
      blocks.push({ kind: 'pre', text: body.join('\n') })
      continue
    }
    const heading = HEADING.exec(line)
    if (heading) {
      blocks.push({ kind: 'h', inline: parseInline(heading[1].replace(/\*\*/g, '').trim()) })
      i++
      continue
    }
    const kind = BULLET.test(line) ? 'ul' : NUMBERED.test(line) ? 'ol' : null
    if (kind) {
      const pattern = kind === 'ul' ? BULLET : NUMBERED
      const items: Inline[][] = []
      while (i < lines.length) {
        const item = pattern.exec(lines[i])
        if (!item) break
        items.push(parseInline(item[1]))
        i++
      }
      blocks.push({ kind, items })
      continue
    }
    const paragraph: Inline[][] = []
    while (i < lines.length && lines[i].trim() && !isSpecial(lines[i])) {
      paragraph.push(parseInline(lines[i].trim()))
      i++
    }
    blocks.push({ kind: 'p', lines: paragraph })
  }
  return blocks
}
