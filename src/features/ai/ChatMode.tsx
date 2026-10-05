import { LoaderCircle, RotateCcw, SendHorizontal, Square } from 'lucide-react'
import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import { useStore } from '../../hooks/store'
import { LEVELS, useProfile } from '../profile/profile'
import { chatStore, resetChat, retryLast, sendChat, stopChat } from './chat'
import { checkQuestion } from './prompts'
import { RichText } from './RichText'
import type { AiConfig } from './types'

/** Modo «Preguntar»: conversación para resolver dudas, adaptada al curso. */
export function ChatMode({ config }: { config: AiConfig }) {
  const [{ messages, busy }] = useStore(chatStore)
  const { level } = useProfile()
  const [draft, setDraft] = useState('')
  const [notice, setNotice] = useState<string | null>(null)
  const endRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const last = messages.at(-1)

  // Sigue la respuesta mientras se escribe.
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'nearest' })
  }, [last?.text, last?.error, messages.length])

  const send = (e?: FormEvent) => {
    e?.preventDefault()
    if (busy) return
    const problem = checkQuestion(draft)
    setNotice(problem)
    if (problem) return
    void sendChat(draft, config, level)
    setDraft('')
  }

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    // Intro envía; Mayús+Intro hace salto de línea.
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault()
      send()
    }
  }

  return (
    <div className="ai-chat">
      {messages.length === 0 ? (
        <p className="empty ai-chat-empty">
          Pregunta lo que no entiendas y te lo explico {level && level !== 'otro' ? `para ${LEVELS[level].label}` : 'paso a paso'}.
        </p>
      ) : (
        <div className="ai-messages" role="log" aria-live="polite" aria-busy={busy}>
          {messages.map((m, i) =>
            m.role === 'user' ? (
              <div key={m.id} className="ai-msg ai-msg-user">
                {m.text}
              </div>
            ) : (
              <div key={m.id} className="ai-msg ai-msg-ai">
                {m.error ? (
                  <>
                    <p className="error-text" role="alert">
                      {m.error}
                    </p>
                    {i === messages.length - 1 && !busy && (
                      <button type="button" className="btn-link ai-retry" onClick={() => void retryLast(config, level)}>
                        <RotateCcw size={13} aria-hidden="true" /> Reintentar
                      </button>
                    )}
                  </>
                ) : m.text ? (
                  <>
                    <RichText text={m.text} />
                    {m.stopped && <p className="hint">(Respuesta incompleta)</p>}
                  </>
                ) : (
                  <p className="hint ai-inline">
                    <LoaderCircle size={14} className="ai-spin" aria-hidden="true" /> Pensando…
                  </p>
                )}
              </div>
            ),
          )}
          <div ref={endRef} />
        </div>
      )}

      <form className="ai-composer" onSubmit={send}>
        {messages.length > 0 && !busy && (
          <button
            type="button"
            className="btn-link ai-new-chat"
            onClick={() => {
              resetChat()
              setNotice(null)
              inputRef.current?.focus()
            }}
          >
            <RotateCcw size={13} aria-hidden="true" /> Nueva conversación
          </button>
        )}
        {notice && (
          <p className="error-text" role="alert">
            {notice}
          </p>
        )}
        <div className="ai-composer-row">
          <textarea
            ref={inputRef}
            className="ai-textarea ai-composer-input"
            rows={1}
            placeholder="Escribe tu duda…"
            aria-label="Tu pregunta"
            value={draft}
            onChange={(e) => {
              setDraft(e.target.value)
              if (notice) setNotice(null)
            }}
            onKeyDown={onKeyDown}
          />
          {busy ? (
            <button type="button" className="btn btn-icon" aria-label="Parar la respuesta" title="Parar" onClick={stopChat}>
              <Square size={16} />
            </button>
          ) : (
            <button type="submit" className="btn btn-primary btn-icon" aria-label="Enviar" title="Enviar" disabled={!draft.trim()}>
              <SendHorizontal size={16} />
            </button>
          )}
        </div>
      </form>
    </div>
  )
}
