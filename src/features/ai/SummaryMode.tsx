import { Check, Copy, LoaderCircle, StickyNote } from 'lucide-react'
import { useState } from 'react'
import { useToast } from '../../components/Toast'
import { useStore } from '../../hooks/store'
import { detectSubject, type SubjectId } from '../../lib/subjects'
import { noteTitle } from '../notes/logic'
import { useNotes } from '../notes/store'
import { useProfile } from '../profile/profile'
import { generate } from './client'
import { checkSource, sourceMessage, summarySystem } from './prompts'
import { RichText } from './RichText'
import { createTask, sourceStore } from './session'
import { SourceInput } from './SourceInput'
import type { AiConfig } from './types'

interface Summary {
  text: string
  truncated: boolean
  /** Título y asignatura para guardarlo como nota. */
  title: string
  noteSubject: SubjectId | null
  saved: boolean
}

const summaryTask = createTask<Summary>()

/** Modo «Resumir»: resumen de un texto pegado o de una nota. */
export function SummaryMode({ config }: { config: AiConfig }) {
  const [{ loading, error, result }] = useStore(summaryTask.store)
  const [source] = useStore(sourceStore)
  const { notes, add } = useNotes()
  const { level } = useProfile()
  const toast = useToast()
  const [notice, setNotice] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const run = () => {
    const problem = checkSource(source.text)
    setNotice(problem)
    if (problem) return
    const note = notes.find((n) => n.id === source.noteId)
    const title = note ? noteTitle(note) : ''
    void summaryTask.run(async (signal) => {
      const { text, truncated } = await generate(config, { system: summarySystem(level), messages: [sourceMessage(source.text, title)] }, { signal })
      return { text, truncated, title, noteSubject: note?.subject ?? null, saved: false }
    })
  }

  const copy = async () => {
    if (!result) return
    try {
      await navigator.clipboard.writeText(result.text)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1500)
    } catch {
      toast('No se pudo copiar. Selecciona el texto y cópialo a mano.')
    }
  }

  const saveAsNote = () => {
    if (!result || result.saved) return
    const subject = result.noteSubject ?? detectSubject(`${result.title} ${result.text}`)
    add(subject, result.title ? `Resumen: ${result.title}` : 'Resumen', result.text)
    summaryTask.update((r) => ({ ...r, saved: true }))
    toast('Resumen guardado en tus notas.')
  }

  return (
    <div className="ai-mode">
      <SourceInput disabled={loading} />
      {notice && (
        <p className="error-text" role="alert">
          {notice}
        </p>
      )}
      <div className="ai-actions">
        {loading ? (
          <>
            <span className="hint ai-inline" role="status">
              <LoaderCircle size={15} className="ai-spin" aria-hidden="true" /> Resumiendo…
            </span>
            <button type="button" className="btn btn-ghost" onClick={summaryTask.cancel}>
              Cancelar
            </button>
          </>
        ) : (
          <button type="button" className="btn btn-primary" onClick={run}>
            Crear resumen
          </button>
        )}
      </div>
      {error && (
        <p className="error-text" role="alert">
          {error}
        </p>
      )}
      {result && (
        <section className="ai-result" aria-label="Resumen">
          <RichText text={result.text} />
          {result.truncated && <p className="hint">El resumen se ha cortado por ser muy largo. Prueba con menos texto.</p>}
          <div className="ai-actions">
            <button type="button" className="btn btn-small" onClick={copy}>
              {copied ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}
              {copied ? 'Copiado' : 'Copiar'}
            </button>
            <button type="button" className="btn btn-small" onClick={saveAsNote} disabled={result.saved}>
              {result.saved ? <Check size={14} aria-hidden="true" /> : <StickyNote size={14} aria-hidden="true" />}
              {result.saved ? 'Guardado' : 'Guardar como nota'}
            </button>
          </div>
        </section>
      )}
    </div>
  )
}
