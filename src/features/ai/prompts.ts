/**
 * Instrucciones para la IA en cada modo, adaptadas al curso del estudiante.
 * El JSON esperado se describe siempre en el texto: así funciona también con modelos que no
 * admiten salida con esquema.
 */
import type { LevelId } from '../profile/profile'
import type { ChatTurn } from './types'

/** Máximo de texto que se puede mandar a resumir, convertir en test o en tarjetas (~7.500 palabras). */
export const MAX_INPUT_CHARS = 40000
/** Máximo de una pregunta en el chat. */
export const MAX_QUESTION_CHARS = 4000
/** Cuánta conversación anterior se manda con cada pregunta (lo más reciente). */
export const MAX_CHAT_CONTEXT_CHARS = 24000

export const QUIZ_SIZES = [5, 10, 15] as const
export const CARD_SIZES = [5, 10, 20] as const

const STUDENT: Record<LevelId, string> = {
  primaria: 'un niño o niña de Primaria (6 a 12 años): usa palabras sencillas, frases cortas y ejemplos de la vida diaria',
  eso: 'un estudiante de ESO (12 a 16 años): explica con claridad y sin dar por sabido lo avanzado',
  bachillerato: 'un estudiante de Bachillerato (16 a 18 años)',
  fp: 'un estudiante de Formación Profesional: prioriza lo práctico',
  universidad: 'un estudiante universitario: puedes usar vocabulario técnico',
  otro: 'una persona adulta que estudia por su cuenta (oposiciones, idiomas…)',
}

export function studentLine(level: LevelId | null): string {
  return level && level in STUDENT
    ? `Hablas con ${STUDENT[level]}.`
    : 'Hablas con un estudiante; no sabes su curso, así que usa un nivel intermedio y claro.'
}

const FORMAT =
  'Escribe en texto sencillo: párrafos cortos, listas con guiones si ayudan y **negrita** solo para lo importante. ' +
  'No uses tablas ni LaTeX; escribe las fórmulas en una línea (por ejemplo: x^2 + 3x = 0).'

export function chatSystem(level: LevelId | null): string {
  return [
    'Eres el asistente de estudio de LockIn, una app para estudiar sin distracciones.',
    studentLine(level),
    'Responde siempre en español, de forma breve y adaptada a su nivel: primero la idea clave en una o dos frases y, si ayuda, un ejemplo.',
    'Si te pide que le hagas los deberes, ayúdale a entender cómo resolverlos paso a paso en lugar de darle solo el resultado.',
    'Si no estás seguro de algo, dilo.',
    FORMAT,
  ].join(' ')
}

export function summarySystem(level: LevelId | null): string {
  return [
    'Resume el texto que te da el estudiante para que pueda repasarlo.',
    studentLine(level),
    'Escribe en español. Empieza con una frase con la idea principal y sigue con los puntos clave en una lista con guiones.',
    'Sé fiel al texto: no añadas información que no esté en él. Sin introducciones ni despedidas.',
    FORMAT,
  ].join(' ')
}

export function quizSystem(level: LevelId | null, count: number): string {
  return [
    `Crea un test de ${count} preguntas sobre el texto que te da el estudiante.`,
    studentLine(level),
    'Escribe en español. Cada pregunta tiene 4 opciones y solo una es correcta; reparte la posición de la correcta.',
    'Pregunta por las ideas importantes del texto, no por detalles sin importancia, y añade una explicación de una o dos frases.',
    'Responde solo con JSON con esta forma: {"questions":[{"question":"…","options":["…","…","…","…"],"answer":0,"explanation":"…"}]}',
    'donde "answer" es la posición de la opción correcta empezando en 0.',
  ].join(' ')
}

export function cardsSystem(level: LevelId | null, count: number): string {
  return [
    `Crea hasta ${count} tarjetas de memoria para repasar el texto que te da el estudiante.`,
    studentLine(level),
    'Escribe en español. Una idea por tarjeta: delante una pregunta o concepto, detrás una respuesta corta (una frase o unas pocas palabras).',
    'Céntrate en lo importante y no repitas tarjetas.',
    'Responde solo con JSON con esta forma: {"cards":[{"front":"…","back":"…"}]}',
  ].join(' ')
}

/** Mensaje del estudiante con el texto de estudio. */
export function sourceMessage(text: string, title = ''): ChatTurn {
  const head = title.trim() ? `Título: ${title.trim()}\n\n` : ''
  return { role: 'user', text: `${head}<texto>\n${text.trim()}\n</texto>` }
}

const tooLong = (length: number, max: number) =>
  `Es demasiado largo (${length.toLocaleString('es-ES')} caracteres). El máximo es ${max.toLocaleString('es-ES')}: prueba con una parte.`

/** Comprueba el texto de estudio antes de mandarlo. Devuelve el aviso a mostrar, o null si está bien. */
export function checkSource(text: string): string | null {
  const length = text.trim().length
  if (length === 0) return 'Escribe o pega un texto primero.'
  if (length < 40) return 'El texto es muy corto. Pega un poco más para que la IA tenga de dónde sacar.'
  if (length > MAX_INPUT_CHARS) return tooLong(length, MAX_INPUT_CHARS)
  return null
}

/** Comprueba una pregunta del chat. */
export function checkQuestion(text: string): string | null {
  const length = text.trim().length
  if (length === 0) return 'Escribe tu pregunta.'
  if (length > MAX_QUESTION_CHARS) return tooLong(length, MAX_QUESTION_CHARS)
  return null
}

/**
 * Conversación que se manda con una pregunta nueva: solo pares pregunta-respuesta completos
 * (las preguntas que fallaron no se mandan) y solo lo más reciente que quepa en el límite.
 */
export function chatHistory(messages: { role: 'user' | 'assistant'; text: string; failed?: boolean }[], question: string, maxChars = MAX_CHAT_CONTEXT_CHARS): ChatTurn[] {
  const pairs: [ChatTurn, ChatTurn][] = []
  for (let i = 0; i < messages.length - 1; i++) {
    const a = messages[i]
    const b = messages[i + 1]
    if (a.role === 'user' && b.role === 'assistant' && !b.failed && b.text.trim()) {
      pairs.push([
        { role: 'user', text: a.text },
        { role: 'assistant', text: b.text },
      ])
      i++
    }
  }
  const out: ChatTurn[] = [{ role: 'user', text: question }]
  let used = question.length
  for (let i = pairs.length - 1; i >= 0; i--) {
    const [q, a] = pairs[i]
    used += q.text.length + a.text.length
    if (used > maxChars) break
    out.unshift(q, a)
  }
  return out
}
