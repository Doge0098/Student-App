import type { SubjectId } from '../../lib/subjects'
import type { CategoryId, EmbedInfo } from '../../lib/web'

/** Una página que el estudiante ha abierto, clasificada para poder volver a ella. */
export interface HistoryItem {
  id: string
  /** Clave para no repetir la misma página (ver pageKey). */
  key: string
  url: string
  title: string
  category: CategoryId
  subject: SubjectId
  /** El estudiante ha cambiado la asignatura a mano: no se vuelve a adivinar. */
  subjectManual?: boolean
  pinned?: boolean
  visits: number
  lastVisited: number
}

/** Pestaña interna con una web mostrada dentro de la app. */
export interface BrowserTab {
  id: string
  key: string
  url: string
  src: string
  title: string
  hint?: EmbedInfo['hint']
  reloads: number
}
