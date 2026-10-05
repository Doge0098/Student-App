import type { QuizQuestion } from './schemas'

/** Respuestas del estudiante: posición elegida en cada pregunta, o null si aún no ha contestado. */
export type QuizAnswers = (number | null)[]

export function scoreQuiz(questions: QuizQuestion[], answers: QuizAnswers): { correct: number; answered: number; total: number } {
  let correct = 0
  let answered = 0
  questions.forEach((q, i) => {
    const a = answers[i]
    if (a === null || a === undefined) return
    answered++
    if (a === q.answer) correct++
  })
  return { correct, answered, total: questions.length }
}

/** Frase corta para el resultado final. */
export function scoreMessage(correct: number, total: number): string {
  if (total === 0) return ''
  const ratio = correct / total
  if (ratio === 1) return '¡Perfecto! Lo dominas.'
  if (ratio >= 0.8) return '¡Muy bien! Repasa los fallos y listo.'
  if (ratio >= 0.5) return 'Vas bien. Repasa lo que has fallado.'
  return 'Toca repasar este tema otra vez.'
}

/** Preguntas falladas, para repetir solo esas. */
export function wrongQuestions(questions: QuizQuestion[], answers: QuizAnswers): QuizQuestion[] {
  return questions.filter((q, i) => answers[i] !== q.answer)
}
