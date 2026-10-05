import { describe, expect, it } from 'vitest'
import { scoreMessage, scoreQuiz, wrongQuestions } from './quiz'
import type { QuizQuestion } from './schemas'

const q = (answer: number): QuizQuestion => ({ question: `P${answer}`, options: ['A', 'B', 'C'], answer, explanation: '' })
const questions = [q(0), q(1), q(2)]

describe('quiz', () => {
  it('cuenta aciertos y respondidas', () => {
    expect(scoreQuiz(questions, [0, 2, null])).toEqual({ correct: 1, answered: 2, total: 3 })
    expect(scoreQuiz(questions, [])).toEqual({ correct: 0, answered: 0, total: 3 })
  })

  it('mensaje final según la nota', () => {
    expect(scoreMessage(3, 3)).toMatch(/Perfecto/)
    expect(scoreMessage(4, 5)).toMatch(/Muy bien/)
    expect(scoreMessage(1, 2)).toMatch(/Vas bien/)
    expect(scoreMessage(0, 3)).toMatch(/repasar/)
    expect(scoreMessage(0, 0)).toBe('')
  })

  it('devuelve las falladas (y las no contestadas)', () => {
    expect(wrongQuestions(questions, [0, 2, null])).toEqual([q(1), q(2)])
  })
})
