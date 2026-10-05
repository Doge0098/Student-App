import { hostMatches, normalize } from './text'

export type SubjectId =
  | 'matematicas'
  | 'fisica'
  | 'quimica'
  | 'biologia'
  | 'historia'
  | 'geografia'
  | 'lengua'
  | 'idiomas'
  | 'informatica'
  | 'filosofia'
  | 'economia'
  | 'arte'
  | 'general'

interface SubjectInfo {
  label: string
  color: string
  /** Palabras clave sin tildes. Las de 5+ letras también cuentan como prefijo ("derivada" → "derivadas"). */
  keywords: string[]
  /** Webs que pertenecen claramente a la asignatura. */
  domains?: string[]
}

export const SUBJECTS: Record<SubjectId, SubjectInfo> = {
  matematicas: {
    label: 'Matemáticas',
    color: '#4f7cff',
    keywords: [
      'matematica', 'matematicas', 'math', 'maths', 'algebra', 'ecuacion', 'inecuacion', 'derivada',
      'integral', 'calculo', 'calculus', 'geometria', 'trigonometria', 'seno', 'coseno', 'tangente',
      'fraccion', 'polinomio', 'matriz', 'matrices', 'vector', 'probabilidad', 'estadistica',
      'logaritmo', 'funcion', 'limite', 'limites', 'teorema', 'pitagoras', 'porcentaje',
      'aritmetica', 'divisibilidad', 'factorizacion', 'binomio', 'sucesion', 'progresion',
    ],
    domains: ['desmos.com', 'geogebra.org', 'wolframalpha.com', 'symbolab.com', 'mathway.com'],
  },
  fisica: {
    label: 'Física',
    color: '#8b5cf6',
    keywords: [
      'fisica', 'physics', 'newton', 'velocidad', 'aceleracion', 'fuerza', 'fuerzas', 'energia',
      'cinematica', 'dinamica', 'electricidad', 'magnetismo', 'electromagnetismo', 'optica',
      'termodinamica', 'gravedad', 'gravitacion', 'onda', 'ondas', 'cuantica', 'relatividad',
      'movimiento', 'momento', 'presion', 'circuito', 'voltaje', 'friccion',
    ],
    domains: ['phet.colorado.edu'],
  },
  quimica: {
    label: 'Química',
    color: '#14b8a6',
    keywords: [
      'quimica', 'chemistry', 'atomo', 'atomos', 'molecula', 'enlace', 'periodica', 'reaccion',
      'reacciones', 'estequiometria', 'mol', 'moles', 'acido', 'acidos', 'oxidacion', 'reduccion',
      'organica', 'inorganica', 'formulacion', 'compuesto', 'compuestos', 'isotopo', 'electron',
      'electrones', 'valencia', 'disolucion',
    ],
    domains: ['ptable.com'],
  },
  biologia: {
    label: 'Biología',
    color: '#22c55e',
    keywords: [
      'biologia', 'biology', 'celula', 'celulas', 'adn', 'arn', 'dna', 'genetica', 'evolucion',
      'fotosintesis', 'ecosistema', 'anatomia', 'organismo', 'mitosis', 'meiosis', 'bacteria',
      'bacterias', 'virus', 'proteina', 'proteinas', 'nervioso', 'digestivo', 'respiratorio',
      'mendel', 'darwin', 'especie', 'especies', 'tejido', 'tejidos', 'enzima', 'cromosoma',
    ],
  },
  historia: {
    label: 'Historia',
    color: '#f59e0b',
    keywords: [
      'historia', 'history', 'guerra', 'revolucion', 'imperio', 'medieval', 'renacimiento', 'siglo',
      'romano', 'romanos', 'roma', 'griego', 'griegos', 'grecia', 'egipto', 'franquismo',
      'ilustracion', 'napoleon', 'colon', 'mundial', 'reconquista', 'prehistoria', 'independencia',
      'monarquia', 'republica', 'dictadura', 'feudalismo', 'antiguo', 'contemporanea',
      'edad media', 'guerra civil', 'segunda republica', 'guerra fria',
    ],
  },
  geografia: {
    label: 'Geografía',
    color: '#0ea5e9',
    keywords: [
      'geografia', 'geography', 'mapa', 'mapas', 'clima', 'climas', 'continente', 'continentes',
      'pais', 'paises', 'rio', 'rios', 'relieve', 'poblacion', 'capital', 'capitales', 'demografia',
      'atlas', 'oceano', 'oceanos', 'montana', 'montanas', 'cordillera', 'comunidades autonomas',
      'provincias', 'latitud', 'longitud',
    ],
  },
  lengua: {
    label: 'Lengua y Literatura',
    color: '#ef4444',
    keywords: [
      'lengua', 'literatura', 'gramatica', 'sintaxis', 'sintactico', 'ortografia', 'poema',
      'poemas', 'poesia', 'novela', 'cervantes', 'quijote', 'lorca', 'morfologia', 'verbo',
      'verbos', 'sujeto', 'predicado', 'metafora', 'narrativa', 'comentario de texto', 'oracion',
      'oraciones', 'generacion del 27', 'romanticismo', 'realismo', 'barroco literario', 'acentuacion',
    ],
    domains: ['rae.es'],
  },
  idiomas: {
    label: 'Idiomas',
    color: '#ec4899',
    keywords: [
      'ingles', 'english', 'frances', 'french', 'aleman', 'german', 'italiano', 'portugues',
      'vocabulario', 'vocabulary', 'grammar', 'traductor', 'translate', 'traduccion', 'idioma',
      'idiomas', 'phrasal', 'listening', 'speaking', 'pronunciation', 'pronunciacion', 'conjugation',
      'past simple', 'present perfect',
    ],
    domains: ['duolingo.com', 'deepl.com', 'wordreference.com', 'linguee.es', 'linguee.com', 'reverso.net', 'translate.google.com'],
  },
  informatica: {
    label: 'Informática',
    color: '#6366f1',
    keywords: [
      'programacion', 'programming', 'codigo', 'python', 'javascript', 'java', 'html', 'css',
      'algoritmo', 'algoritmos', 'informatica', 'sql', 'react', 'typescript', 'linux', 'scratch',
      'arduino', 'tecnologia', 'ordenador', 'computadora', 'software', 'hardware', 'variable',
      'bucle', 'compilador', 'base de datos',
    ],
    domains: [
      'github.com', 'stackoverflow.com', 'developer.mozilla.org', 'w3schools.com', 'replit.com',
      'codepen.io', 'geeksforgeeks.org', 'freecodecamp.org', 'python.org', 'scratch.mit.edu',
    ],
  },
  filosofia: {
    label: 'Filosofía',
    color: '#b45309',
    keywords: [
      'filosofia', 'philosophy', 'platon', 'aristoteles', 'kant', 'nietzsche', 'descartes', 'etica',
      'moral', 'socrates', 'marx', 'hume', 'ontologia', 'epistemologia', 'metafisica', 'logica',
      'ortega', 'existencialismo', 'empirismo', 'racionalismo',
    ],
  },
  economia: {
    label: 'Economía',
    color: '#84cc16',
    keywords: [
      'economia', 'economics', 'mercado', 'oferta', 'demanda', 'inflacion', 'pib', 'empresa',
      'contabilidad', 'finanzas', 'marketing', 'microeconomia', 'macroeconomia', 'impuestos',
      'balance', 'presupuesto', 'emprendimiento',
    ],
  },
  arte: {
    label: 'Arte y Música',
    color: '#f97316',
    keywords: [
      'arte', 'pintura', 'dibujo', 'escultura', 'barroco', 'picasso', 'velazquez', 'goya', 'solfeo',
      'partitura', 'plastica', 'musica', 'arquitectura', 'gotico', 'romanico', 'impresionismo',
      'cubismo', 'acorde', 'acordes', 'pentagrama',
    ],
  },
  general: {
    label: 'General',
    color: '#94a3b8',
    keywords: [],
  },
}

export const SUBJECT_IDS = Object.keys(SUBJECTS) as SubjectId[]

/**
 * Adivina la asignatura de un texto (búsqueda, título, enlace o tarea)
 * contando coincidencias con las palabras clave de cada asignatura.
 */
export function detectSubject(text: string, hostname = ''): SubjectId {
  const tokens = normalize(text).split(/[^a-z0-9]+/).filter(Boolean)
  const joined = ` ${tokens.join(' ')} `
  let best: SubjectId = 'general'
  let bestScore = 0

  for (const id of SUBJECT_IDS) {
    const info = SUBJECTS[id]
    let score = 0
    if (hostname && info.domains?.some((d) => hostMatches(hostname, d))) score += 3
    for (const keyword of info.keywords) {
      if (keyword.includes(' ')) {
        if (joined.includes(` ${keyword} `)) score += 2
      } else if (tokens.some((t) => t === keyword || (keyword.length >= 5 && t.startsWith(keyword)))) {
        score += 1
      }
    }
    if (score > bestScore) {
      best = id
      bestScore = score
    }
  }
  return best
}
