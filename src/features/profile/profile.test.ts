import { describe, expect, it } from 'vitest'
import { distractionPolicy, subjectsForLevel } from './profile'

const focus = { focusRunning: true, onBreak: false }
const rest = { focusRunning: false, onBreak: true }
const idle = { focusRunning: false, onBreak: false }

describe('distractionPolicy', () => {
  it('Suave: solo avisa mientras te concentras', () => {
    expect(distractionPolicy('suave', 'distraction', focus)).toBe('warn')
    expect(distractionPolicy('suave', 'distraction', idle)).toBe('allow')
    expect(distractionPolicy('suave', 'messaging', focus)).toBe('warn')
    expect(distractionPolicy('suave', 'messaging', idle)).toBe('allow')
  })

  it('Normal: avisa siempre de distracciones menos en el descanso; mensajes solo al concentrarse', () => {
    expect(distractionPolicy('normal', 'distraction', focus)).toBe('warn')
    expect(distractionPolicy('normal', 'distraction', idle)).toBe('warn')
    expect(distractionPolicy('normal', 'distraction', rest)).toBe('allow')
    expect(distractionPolicy('normal', 'messaging', focus)).toBe('warn')
    expect(distractionPolicy('normal', 'messaging', idle)).toBe('allow')
  })

  it('Estricto: bloquea mientras te concentras', () => {
    expect(distractionPolicy('estricto', 'distraction', focus)).toBe('block')
    expect(distractionPolicy('estricto', 'messaging', focus)).toBe('block')
    expect(distractionPolicy('estricto', 'distraction', idle)).toBe('warn')
    expect(distractionPolicy('estricto', 'distraction', rest)).toBe('allow')
    expect(distractionPolicy('estricto', 'messaging', rest)).toBe('allow')
  })
})

describe('subjectsForLevel', () => {
  it('en Primaria ofrece menos asignaturas', () => {
    expect(subjectsForLevel('primaria')).toContain('matematicas')
    expect(subjectsForLevel('primaria')).not.toContain('filosofia')
    expect(subjectsForLevel('universidad')).toContain('filosofia')
    expect(subjectsForLevel(null)).toContain('filosofia')
  })
})
