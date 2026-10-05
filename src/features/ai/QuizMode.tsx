import { Check, LoaderCircle, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useStore } from '../../hooks/store'
import { noteTitle } from '../notes/logic'
import { useNotes } from '../notes/store'
import { useProfile } from '../profile/profile'
import { generateJson } from './client'
import { QUIZ_SIZES, checkSource, quizSystem, sourceMessage } from './prompts'
import { scoreMessage, scoreQuiz, wrongQuestions, type QuizAnswers } from './quiz'
import { QUIZ_SCHEMA, parseQuiz, type QuizQuestion } from './schemas'
import { createTask, sourceStore } from './session'
import { SourceInput } from './SourceInput'
import type { AiConfig } from './types'

interface QuizSession {
  questions: QuizQuestion[]
  answers: QuizAnswers
  /** Pregunta actual; igual a questions.length cuando ha terminado. */
  index: number
}

const quizTask = createTask<QuizSession>()

const start = (questions: QuizQuestion[]): QuizSession => ({ questions, answers: questions.map(() => null), index: 0 })
const LETTERS = 'ABCDEF'

/** Modo «Test»: preguntas tipo test sobre un texto, una a una, con nota al final. */
export function QuizMode({ config }: { config: AiConfig }) {
  const [{ loading, error, result }] = useStore(quizTask.store)
  const [source] = useStore(sourceStore)
  const { notes } = useNotes()
  const { level } = useProfile()
  const [count, setCount] = useState<number>(10)
  const [notice, setNotice] = useState<string | null>(null)

  const create = () => {
    const problem = checkSource(source.text)
    setNotice(problem)
    if (problem) return
    const note = notes.find((n) => n.id === source.noteId)
    const request = {
      system: quizSystem(level, count),
      messages: [sourceMessage(source.text, note ? noteTitle(note) : '')],
      schema: QUIZ_SCHEMA,
      schemaName: 'test',
    }
    void quizTask.run(async (signal) => start(await generateJson(config, request, (text) => parseQuiz(text, count), { signal })))
  }

  if (result) return <QuizPlayer session={result} />

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
              <LoaderCircle size={15} className="ai-spin" aria-hidden="true" /> Preparando el test…
            </span>
            <button type="button" className="btn btn-ghost" onClick={quizTask.cancel}>
              Cancelar
            </button>
          </>
        ) : (
          <>
            <button type="button" className="btn btn-primary" onClick={create}>
              Crear test
            </button>
            <select aria-label="Número de preguntas" value={count} onChange={(e) => setCount(Number(e.target.value))}>
              {QUIZ_SIZES.map((n) => (
                <option key={n} value={n}>
                  {n} preguntas
                </option>
              ))}
            </select>
          </>
        )}
      </div>
      {error && (
        <p className="error-text" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}

function QuizPlayer({ session }: { session: QuizSession }) {
  const { questions, answers, index } = session
  const nextRef = useRef<HTMLButtonElement>(null)
  const chosen = answers[index] ?? null

  // Tras contestar, el foco va a «Siguiente» para seguir con el teclado.
  useEffect(() => {
    if (chosen !== null) nextRef.current?.focus()
  }, [chosen, index])

  if (index >= questions.length) return <QuizResult session={session} />

  const q = questions[index]
  const answer = (option: number) => {
    if (chosen !== null) return
    quizTask.update((s) => ({ ...s, answers: s.answers.map((a, i) => (i === s.index ? option : a)) }))
  }

  return (
    <div className="ai-mode ai-quiz">
      <div className="ai-quiz-head">
        <span className="badge">
          Pregunta {index + 1} de {questions.length}
        </span>
        <button type="button" className="btn-link" onClick={quizTask.clear}>
          Salir del test
        </button>
      </div>
      <p className="ai-quiz-question" id={`ai-q-${index}`}>
        {q.question}
      </p>
      <div className={`ai-options ${chosen !== null ? 'is-answered' : ''}`} role="group" aria-labelledby={`ai-q-${index}`}>
        {q.options.map((option, i) => {
          const state = chosen === null ? '' : i === q.answer ? 'is-correct' : i === chosen ? 'is-wrong' : 'is-dim'
          return (
            <button key={i} type="button" className={`ai-option ${state}`} aria-pressed={chosen === i} disabled={chosen !== null} onClick={() => answer(i)}>
              <span className="ai-option-letter" aria-hidden="true">
                {state === 'is-correct' ? <Check size={14} /> : state === 'is-wrong' ? <X size={14} /> : LETTERS[i]}
              </span>
              <span>{option}</span>
            </button>
          )
        })}
      </div>
      {chosen !== null && (
        <div className="ai-feedback" role="status">
          <p className={chosen === q.answer ? 'ai-good' : 'ai-bad'}>{chosen === q.answer ? '¡Correcto!' : `La correcta es la ${LETTERS[q.answer]}.`}</p>
          {q.explanation && <p>{q.explanation}</p>}
          <button ref={nextRef} type="button" className="btn btn-primary" onClick={() => quizTask.update((s) => ({ ...s, index: s.index + 1 }))}>
            {index + 1 < questions.length ? 'Siguiente' : 'Ver resultado'}
          </button>
        </div>
      )}
    </div>
  )
}

function QuizResult({ session }: { session: QuizSession }) {
  const { questions, answers } = session
  const { correct, total } = scoreQuiz(questions, answers)
  const wrong = wrongQuestions(questions, answers)

  return (
    <div className="ai-mode ai-quiz">
      <section className="ai-score" aria-live="polite">
        <p className="ai-score-number">
          {correct} de {total}
        </p>
        <p className="hint">{scoreMessage(correct, total)}</p>
      </section>
      {wrong.length > 0 && (
        <section className="ai-review" aria-label="Preguntas falladas">
          <h3 className="section-title">Para repasar</h3>
          <ul>
            {wrong.map((q, i) => (
              <li key={i}>
                <span>{q.question}</span>
                <span className="ai-review-answer">
                  <Check size={13} aria-hidden="true" /> {q.options[q.answer]}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
      <div className="ai-actions">
        {wrong.length > 0 && (
          <button type="button" className="btn btn-primary" onClick={() => quizTask.update(() => start(wrong))}>
            Repetir las falladas
          </button>
        )}
        <button type="button" className={`btn ${wrong.length > 0 ? '' : 'btn-primary'}`} onClick={() => quizTask.update(() => start(questions))}>
          Repetir el test
        </button>
        <button type="button" className="btn btn-ghost" onClick={quizTask.clear}>
          Nuevo test
        </button>
      </div>
    </div>
  )
}
