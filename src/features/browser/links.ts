import {
  Atom,
  BookOpen,
  Calculator,
  CalendarDays,
  ClipboardList,
  FileText,
  FlaskConical,
  FolderOpen,
  GraduationCap,
  Languages,
  Library,
  Mail,
  Presentation,
  Shapes,
  Sheet,
  StickyNote,
  Video,
  type LucideIcon,
} from 'lucide-react'

export interface QuickLink {
  label: string
  url: string
  icon: LucideIcon
  tint: string
}

/** Suite de Google (gratis con una cuenta de Google o la del centro educativo). */
export const GOOGLE_APPS: QuickLink[] = [
  { label: 'Drive', url: 'https://drive.google.com/', icon: FolderOpen, tint: '#1a73e8' },
  { label: 'Docs', url: 'https://docs.google.com/document/', icon: FileText, tint: '#4285f4' },
  { label: 'Hojas de cálculo', url: 'https://docs.google.com/spreadsheets/', icon: Sheet, tint: '#0f9d58' },
  { label: 'Presentaciones', url: 'https://docs.google.com/presentation/', icon: Presentation, tint: '#f4b400' },
  { label: 'Classroom', url: 'https://classroom.google.com/', icon: GraduationCap, tint: '#0f9d58' },
  { label: 'Calendar', url: 'https://calendar.google.com/', icon: CalendarDays, tint: '#4285f4' },
  { label: 'Gmail', url: 'https://mail.google.com/', icon: Mail, tint: '#ea4335' },
  { label: 'Keep', url: 'https://keep.google.com/', icon: StickyNote, tint: '#f4b400' },
  { label: 'Meet', url: 'https://meet.google.com/', icon: Video, tint: '#00897b' },
  { label: 'Formularios', url: 'https://docs.google.com/forms/', icon: ClipboardList, tint: '#7248b9' },
  { label: 'Traductor', url: 'https://translate.google.com/', icon: Languages, tint: '#4285f4' },
  { label: 'Académico', url: 'https://scholar.google.com/', icon: Library, tint: '#4285f4' },
]

export const GOOGLE_CREATE: QuickLink[] = [
  { label: 'Documento', url: 'https://docs.new', icon: FileText, tint: '#4285f4' },
  { label: 'Hoja de cálculo', url: 'https://sheets.new', icon: Sheet, tint: '#0f9d58' },
  { label: 'Presentación', url: 'https://slides.new', icon: Presentation, tint: '#f4b400' },
  { label: 'Formulario', url: 'https://forms.new', icon: ClipboardList, tint: '#7248b9' },
]

export const STUDY_TOOLS: QuickLink[] = [
  { label: 'Wikipedia', url: 'https://es.wikipedia.org/', icon: BookOpen, tint: '#64748b' },
  { label: 'Calculadora Desmos', url: 'https://www.desmos.com/calculator?lang=es', icon: Calculator, tint: '#2f9e44' },
  { label: 'GeoGebra', url: 'https://www.geogebra.org/classic?lang=es', icon: Shapes, tint: '#6741d9' },
  { label: 'Simulaciones PhET', url: 'https://phet.colorado.edu/es/simulations/browse', icon: Atom, tint: '#1c7ed6' },
  { label: 'Khan Academy', url: 'https://es.khanacademy.org/', icon: GraduationCap, tint: '#0ca678' },
  { label: 'Diccionario RAE', url: 'https://dle.rae.es/', icon: BookOpen, tint: '#c92a2a' },
  { label: 'WordReference', url: 'https://www.wordreference.com/es/', icon: Languages, tint: '#1971c2' },
  { label: 'Tabla periódica', url: 'https://ptable.com/?lang=es', icon: FlaskConical, tint: '#e8590c' },
]
