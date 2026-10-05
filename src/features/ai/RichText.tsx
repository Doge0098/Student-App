import { Fragment } from 'react'
import { parseRichText, type Inline } from './richText'

function Spans({ parts }: { parts: Inline[] }) {
  return (
    <>
      {parts.map((p, i) =>
        p.code ? <code key={i}>{p.text}</code> : p.bold ? <strong key={i}>{p.text}</strong> : <Fragment key={i}>{p.text}</Fragment>,
      )}
    </>
  )
}

/** Texto de la IA con formato sencillo (sin insertar HTML). */
export function RichText({ text }: { text: string }) {
  const blocks = parseRichText(text)
  return (
    <div className="ai-rich">
      {blocks.map((b, i) => {
        switch (b.kind) {
          case 'h':
            return (
              <p key={i} className="ai-rich-h">
                <Spans parts={b.inline} />
              </p>
            )
          case 'p':
            return (
              <p key={i}>
                {b.lines.map((line, j) => (
                  <Fragment key={j}>
                    {j > 0 && <br />}
                    <Spans parts={line} />
                  </Fragment>
                ))}
              </p>
            )
          case 'ul':
          case 'ol': {
            const List = b.kind
            return (
              <List key={i}>
                {b.items.map((item, j) => (
                  <li key={j}>
                    <Spans parts={item} />
                  </li>
                ))}
              </List>
            )
          }
          case 'pre':
            return <pre key={i}>{b.text}</pre>
        }
      })}
    </div>
  )
}
