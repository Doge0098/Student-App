import {
  Atom,
  Blocks,
  BookA,
  BookOpen,
  Bot,
  Box,
  BrainCircuit,
  Brush,
  Calculator,
  CalendarDays,
  ClipboardList,
  Cloud,
  CodeXml,
  Cpu,
  FileText,
  FlaskConical,
  FolderOpen,
  GraduationCap,
  HardDrive,
  Image,
  Languages,
  Layers,
  Library,
  Mail,
  MessageCircle,
  Microscope,
  Monitor,
  NotebookPen,
  PenTool,
  Presentation,
  Search,
  Server,
  Shapes,
  Sheet,
  Sigma,
  Sparkles,
  StickyNote,
  Terminal,
  Video,
  Workflow,
  type LucideIcon,
} from 'lucide-react'

export type StoreCategory = 'google' | 'ia' | 'programacion' | 'maquinas' | 'ciencias' | 'apuntes' | 'idiomas' | 'diseno'

export const STORE_CATEGORIES: Record<StoreCategory, string> = {
  google: 'Google',
  ia: 'IA',
  programacion: 'Programación',
  maquinas: 'Máquinas virtuales',
  ciencias: 'Ciencias y mates',
  apuntes: 'Apuntes y memoria',
  idiomas: 'Idiomas y consulta',
  diseno: 'Diseño y ofimática',
}

export interface StoreApp {
  id: string
  name: string
  description: string
  category: StoreCategory
  icon: LucideIcon
  /** Versión web: se abre desde el navegador de la app. */
  webUrl?: string
  /** Página oficial de descarga del programa (la web no puede instalar nada por sí misma). */
  downloadUrl?: string
  price: 'gratis' | 'limites'
}

export const PRICE_LABELS: Record<StoreApp['price'], string> = {
  gratis: 'Gratis',
  limites: 'Gratis con límites',
}

export const STORE_APPS: StoreApp[] = [
  // Google
  { id: 'drive', name: 'Google Drive', description: 'Tus archivos y carpetas en la nube.', category: 'google', icon: FolderOpen, webUrl: 'https://drive.google.com/', downloadUrl: 'https://www.google.com/drive/download/', price: 'gratis' },
  { id: 'docs', name: 'Documentos', description: 'Escribe trabajos y apuntes, también en grupo.', category: 'google', icon: FileText, webUrl: 'https://docs.google.com/document/', price: 'gratis' },
  { id: 'sheets', name: 'Hojas de cálculo', description: 'Tablas, gráficas y cálculos.', category: 'google', icon: Sheet, webUrl: 'https://docs.google.com/spreadsheets/', price: 'gratis' },
  { id: 'slides', name: 'Presentaciones', description: 'Diapositivas para exponer en clase.', category: 'google', icon: Presentation, webUrl: 'https://docs.google.com/presentation/', price: 'gratis' },
  { id: 'classroom', name: 'Classroom', description: 'Las tareas y materiales de tus clases.', category: 'google', icon: GraduationCap, webUrl: 'https://classroom.google.com/', price: 'gratis' },
  { id: 'calendar', name: 'Calendar', description: 'Exámenes, entregas y horarios.', category: 'google', icon: CalendarDays, webUrl: 'https://calendar.google.com/', price: 'gratis' },
  { id: 'gmail', name: 'Gmail', description: 'Tu correo.', category: 'google', icon: Mail, webUrl: 'https://mail.google.com/', price: 'gratis' },
  { id: 'keep', name: 'Keep', description: 'Notas rápidas y listas.', category: 'google', icon: StickyNote, webUrl: 'https://keep.google.com/', price: 'gratis' },
  { id: 'meet', name: 'Meet', description: 'Videollamadas para estudiar en grupo.', category: 'google', icon: Video, webUrl: 'https://meet.google.com/', price: 'gratis' },
  { id: 'forms', name: 'Formularios', description: 'Encuestas y cuestionarios.', category: 'google', icon: ClipboardList, webUrl: 'https://docs.google.com/forms/', price: 'gratis' },
  { id: 'translate', name: 'Traductor', description: 'Traduce palabras, textos y documentos.', category: 'google', icon: Languages, webUrl: 'https://translate.google.com/', price: 'gratis' },
  { id: 'scholar', name: 'Google Académico', description: 'Busca artículos y trabajos científicos.', category: 'google', icon: Library, webUrl: 'https://scholar.google.com/', price: 'gratis' },

  // IA
  { id: 'chatgpt', name: 'ChatGPT', description: 'Asistente de IA de OpenAI para dudas y explicaciones.', category: 'ia', icon: MessageCircle, webUrl: 'https://chatgpt.com/', downloadUrl: 'https://openai.com/chatgpt/download/', price: 'limites' },
  { id: 'claude', name: 'Claude', description: 'Asistente de IA de Anthropic, bueno con textos largos.', category: 'ia', icon: Sparkles, webUrl: 'https://claude.ai/', downloadUrl: 'https://claude.com/download', price: 'limites' },
  { id: 'gemini', name: 'Gemini', description: 'Asistente de IA de Google.', category: 'ia', icon: Bot, webUrl: 'https://gemini.google.com/', price: 'limites' },
  { id: 'notebooklm', name: 'NotebookLM', description: 'Sube tus apuntes y te hace resúmenes y preguntas.', category: 'ia', icon: NotebookPen, webUrl: 'https://notebooklm.google.com/', price: 'limites' },
  { id: 'perplexity', name: 'Perplexity', description: 'Buscador con IA que cita sus fuentes.', category: 'ia', icon: Search, webUrl: 'https://www.perplexity.ai/', price: 'limites' },
  { id: 'copilot', name: 'Microsoft Copilot', description: 'Asistente de IA de Microsoft.', category: 'ia', icon: BrainCircuit, webUrl: 'https://copilot.microsoft.com/', price: 'limites' },

  // Programación
  { id: 'vscode', name: 'Visual Studio Code', description: 'El editor de código más usado. También en versión web.', category: 'programacion', icon: CodeXml, webUrl: 'https://vscode.dev/', downloadUrl: 'https://code.visualstudio.com/download', price: 'gratis' },
  { id: 'colab', name: 'Google Colab', description: 'Programa en Python sin instalar nada.', category: 'programacion', icon: Terminal, webUrl: 'https://colab.research.google.com/', price: 'gratis' },
  { id: 'replit', name: 'Replit', description: 'Programa en muchos lenguajes online.', category: 'programacion', icon: Cloud, webUrl: 'https://replit.com/', price: 'limites' },
  { id: 'scratch', name: 'Scratch', description: 'Aprende a programar con bloques.', category: 'programacion', icon: Blocks, webUrl: 'https://scratch.mit.edu/projects/editor/', downloadUrl: 'https://scratch.mit.edu/download', price: 'gratis' },
  { id: 'github', name: 'GitHub', description: 'Guarda tu código y colabora en proyectos.', category: 'programacion', icon: Layers, webUrl: 'https://github.com/', downloadUrl: 'https://desktop.github.com/', price: 'gratis' },

  // Máquinas virtuales
  { id: 'virtualbox', name: 'VirtualBox', description: 'Crea máquinas virtuales para probar Linux u otros sistemas.', category: 'maquinas', icon: Monitor, downloadUrl: 'https://www.virtualbox.org/wiki/Downloads', price: 'gratis' },
  { id: 'vmware', name: 'VMware Workstation / Fusion', description: 'Máquinas virtuales para Windows, Linux y Mac.', category: 'maquinas', icon: Server, downloadUrl: 'https://www.vmware.com/products/desktop-hypervisor/workstation-and-fusion', price: 'gratis' },
  { id: 'utm', name: 'UTM', description: 'Máquinas virtuales en Mac, también con chip Apple.', category: 'maquinas', icon: Cpu, downloadUrl: 'https://mac.getutm.app/', price: 'gratis' },
  { id: 'wsl', name: 'WSL (Linux en Windows)', description: 'Usa Linux dentro de Windows.', category: 'maquinas', icon: HardDrive, downloadUrl: 'https://learn.microsoft.com/es-es/windows/wsl/install', price: 'gratis' },
  { id: 'webvm', name: 'WebVM', description: 'Un Linux que funciona en el navegador.', category: 'maquinas', icon: Terminal, webUrl: 'https://webvm.io/', price: 'gratis' },
  { id: 'jslinux', name: 'JSLinux', description: 'Linux en el navegador para practicar comandos.', category: 'maquinas', icon: Terminal, webUrl: 'https://bellard.org/jslinux/', price: 'gratis' },
  { id: 'v86', name: 'v86', description: 'Emulador de PC en el navegador.', category: 'maquinas', icon: Cpu, webUrl: 'https://copy.sh/v86/', price: 'gratis' },

  // Ciencias y mates
  { id: 'desmos', name: 'Calculadora Desmos', description: 'Calculadora gráfica fácil de usar.', category: 'ciencias', icon: Calculator, webUrl: 'https://www.desmos.com/calculator?lang=es', price: 'gratis' },
  { id: 'geogebra', name: 'GeoGebra', description: 'Geometría, gráficas y álgebra interactivas.', category: 'ciencias', icon: Shapes, webUrl: 'https://www.geogebra.org/classic?lang=es', downloadUrl: 'https://www.geogebra.org/download', price: 'gratis' },
  { id: 'wolfram', name: 'Wolfram|Alpha', description: 'Resuelve cálculos y responde preguntas con datos.', category: 'ciencias', icon: Sigma, webUrl: 'https://www.wolframalpha.com/', price: 'limites' },
  { id: 'phet', name: 'Simulaciones PhET', description: 'Simulaciones de física, química y mates.', category: 'ciencias', icon: Atom, webUrl: 'https://phet.colorado.edu/es/simulations/browse', price: 'gratis' },
  { id: 'ptable', name: 'Tabla periódica', description: 'Tabla periódica interactiva.', category: 'ciencias', icon: FlaskConical, webUrl: 'https://ptable.com/?lang=es', price: 'gratis' },
  { id: 'khan', name: 'Khan Academy', description: 'Clases y ejercicios de casi todas las asignaturas.', category: 'ciencias', icon: GraduationCap, webUrl: 'https://es.khanacademy.org/', price: 'gratis' },
  { id: 'overleaf', name: 'Overleaf', description: 'Escribe documentos científicos en LaTeX.', category: 'ciencias', icon: Microscope, webUrl: 'https://www.overleaf.com/', price: 'limites' },

  // Apuntes y memoria
  { id: 'notion', name: 'Notion', description: 'Apuntes, listas y planificación en un mismo sitio.', category: 'apuntes', icon: NotebookPen, webUrl: 'https://www.notion.so/', downloadUrl: 'https://www.notion.com/desktop', price: 'limites' },
  { id: 'obsidian', name: 'Obsidian', description: 'Apuntes en tu ordenador enlazados entre sí.', category: 'apuntes', icon: Workflow, downloadUrl: 'https://obsidian.md/download', price: 'gratis' },
  { id: 'anki', name: 'Anki', description: 'Tarjetas para memorizar con repetición espaciada.', category: 'apuntes', icon: Layers, webUrl: 'https://ankiweb.net/', downloadUrl: 'https://apps.ankiweb.net/', price: 'gratis' },
  { id: 'quizlet', name: 'Quizlet', description: 'Tarjetas y tests para repasar.', category: 'apuntes', icon: ClipboardList, webUrl: 'https://quizlet.com/', price: 'limites' },
  { id: 'excalidraw', name: 'Excalidraw', description: 'Pizarra para esquemas a mano alzada.', category: 'apuntes', icon: PenTool, webUrl: 'https://excalidraw.com/', price: 'gratis' },
  { id: 'drawio', name: 'draw.io', description: 'Diagramas y mapas conceptuales.', category: 'apuntes', icon: Workflow, webUrl: 'https://app.diagrams.net/', downloadUrl: 'https://www.drawio.com/', price: 'gratis' },
  { id: 'zotero', name: 'Zotero', description: 'Organiza tus fuentes y crea la bibliografía.', category: 'apuntes', icon: Library, downloadUrl: 'https://www.zotero.org/download/', price: 'gratis' },

  // Idiomas y consulta
  { id: 'wikipedia', name: 'Wikipedia', description: 'La enciclopedia libre.', category: 'idiomas', icon: BookOpen, webUrl: 'https://es.wikipedia.org/', price: 'gratis' },
  { id: 'rae', name: 'Diccionario RAE', description: 'Significado y uso de las palabras en español.', category: 'idiomas', icon: BookA, webUrl: 'https://dle.rae.es/', price: 'gratis' },
  { id: 'wordreference', name: 'WordReference', description: 'Diccionarios de idiomas y foros de dudas.', category: 'idiomas', icon: Languages, webUrl: 'https://www.wordreference.com/es/', price: 'gratis' },
  { id: 'deepl', name: 'DeepL', description: 'Traductor muy preciso.', category: 'idiomas', icon: Languages, webUrl: 'https://www.deepl.com/translator', price: 'limites' },
  { id: 'duolingo', name: 'Duolingo', description: 'Aprende idiomas con lecciones cortas.', category: 'idiomas', icon: GraduationCap, webUrl: 'https://www.duolingo.com/', price: 'limites' },

  // Diseño y ofimática
  { id: 'libreoffice', name: 'LibreOffice', description: 'Textos, hojas de cálculo y presentaciones sin internet.', category: 'diseno', icon: FileText, downloadUrl: 'https://es.libreoffice.org/descarga/', price: 'gratis' },
  { id: 'canva', name: 'Canva', description: 'Pósters, presentaciones e infografías.', category: 'diseno', icon: Brush, webUrl: 'https://www.canva.com/', price: 'limites' },
  { id: 'photopea', name: 'Photopea', description: 'Editor de fotos en el navegador.', category: 'diseno', icon: Image, webUrl: 'https://www.photopea.com/', price: 'gratis' },
  { id: 'tinkercad', name: 'Tinkercad', description: 'Diseño 3D y circuitos para principiantes.', category: 'diseno', icon: Box, webUrl: 'https://www.tinkercad.com/', price: 'gratis' },
]

/** Apps que aparecen en «Mis apps» la primera vez. */
export const DEFAULT_MY_APPS = ['drive', 'docs', 'classroom', 'calendar', 'gmail', 'wikipedia', 'desmos', 'translate']

/** Atajos para crear archivos nuevos de Google. */
export const GOOGLE_CREATE = [
  { label: 'Documento', url: 'https://docs.new' },
  { label: 'Hoja', url: 'https://sheets.new' },
  { label: 'Presentación', url: 'https://slides.new' },
  { label: 'Formulario', url: 'https://forms.new' },
]

export function findApp(id: string): StoreApp | undefined {
  return STORE_APPS.find((app) => app.id === id)
}
