import {
  BookOpen,
  Bot,
  Calculator,
  ClipboardList,
  Code,
  FileText,
  Globe,
  GraduationCap,
  LayoutGrid,
  Languages,
  MonitorPlay,
  Presentation,
  Search,
  Sheet,
  TriangleAlert,
  type LucideIcon,
} from 'lucide-react'
import { getGoogleFile, type CategoryId } from '../../lib/web'

const CATEGORY_ICONS: Record<CategoryId, LucideIcon> = {
  busqueda: Search,
  google: LayoutGrid,
  video: MonitorPlay,
  lectura: BookOpen,
  herramienta: Calculator,
  clase: GraduationCap,
  programacion: Code,
  idiomas: Languages,
  ia: Bot,
  distraccion: TriangleAlert,
  web: Globe,
}

const GOOGLE_FILE_ICONS: Record<string, LucideIcon> = {
  document: FileText,
  spreadsheets: Sheet,
  presentation: Presentation,
  forms: ClipboardList,
}

export function SiteIcon({ url, category, size = 16 }: { url: string; category: CategoryId; size?: number }) {
  let Icon = CATEGORY_ICONS[category] ?? Globe
  try {
    const file = getGoogleFile(new URL(url))
    if (file) Icon = GOOGLE_FILE_ICONS[file.type] ?? FileText
  } catch {
    /* enlace inválido: icono genérico */
  }
  return <Icon size={size} aria-hidden="true" />
}
