import { createStore, useStore } from '../../hooks/store'
import { SUBJECT_IDS, type SubjectId } from '../../lib/subjects'

/* ------------------------------------------------------------------ */
/* Curso                                                               */
/* ------------------------------------------------------------------ */

export type LevelId = 'primaria' | 'eso' | 'bachillerato' | 'fp' | 'universidad' | 'otro'

export const LEVELS: Record<LevelId, { label: string; hint: string }> = {
  primaria: { label: 'Primaria', hint: '6 a 12 años' },
  eso: { label: 'ESO', hint: '12 a 16 años' },
  bachillerato: { label: 'Bachillerato', hint: '16 a 18 años' },
  fp: { label: 'FP', hint: 'Formación Profesional' },
  universidad: { label: 'Universidad', hint: 'Grado, máster…' },
  otro: { label: 'Otro', hint: 'Oposiciones, idiomas, por libre…' },
}

export const LEVEL_IDS = Object.keys(LEVELS) as LevelId[]

/** Asignaturas que se ofrecen en cada curso (la asignatura ya elegida siempre se muestra). */
const LEVEL_SUBJECTS: Record<LevelId, SubjectId[]> = {
  primaria: ['matematicas', 'lengua', 'idiomas', 'biologia', 'historia', 'geografia', 'arte', 'general'],
  eso: SUBJECT_IDS,
  bachillerato: SUBJECT_IDS,
  fp: SUBJECT_IDS,
  universidad: SUBJECT_IDS,
  otro: SUBJECT_IDS,
}

export function subjectsForLevel(level: LevelId | null): SubjectId[] {
  return level ? LEVEL_SUBJECTS[level] : SUBJECT_IDS
}

/* ------------------------------------------------------------------ */
/* Modos de estudio                                                    */
/* ------------------------------------------------------------------ */

export type ModeId = 'suave' | 'normal' | 'estricto'

export const MODES: Record<ModeId, { label: string; description: string }> = {
  suave: {
    label: 'Suave',
    description: 'Solo te aviso de las distracciones mientras te concentras.',
  },
  normal: {
    label: 'Normal',
    description: 'Te aviso siempre de las distracciones (menos en el descanso) y de los mensajes al concentrarte.',
  },
  estricto: {
    label: 'Estricto',
    description: 'Mientras te concentras, las distracciones y los mensajes quedan bloqueados. Sin excusas.',
  },
}

export const MODE_IDS = Object.keys(MODES) as ModeId[]

export type DistractionKind = 'distraction' | 'messaging'
export type DistractionAction = 'allow' | 'warn' | 'block'

/**
 * Qué hacer al abrir una distracción (redes, reels, juegos…) o una app de mensajería,
 * según el modo y el momento del temporizador.
 */
export function distractionPolicy(
  mode: ModeId,
  kind: DistractionKind,
  timer: { focusRunning: boolean; onBreak: boolean },
): DistractionAction {
  const { focusRunning, onBreak } = timer
  if (kind === 'messaging') {
    if (!focusRunning) return 'allow'
    return mode === 'estricto' ? 'block' : 'warn'
  }
  if (focusRunning) return mode === 'estricto' ? 'block' : 'warn'
  if (onBreak || mode === 'suave') return 'allow'
  return 'warn'
}

/* ------------------------------------------------------------------ */
/* Perfil guardado                                                     */
/* ------------------------------------------------------------------ */

export interface Profile {
  /** null = aún no lo ha elegido (se pregunta en la guía de bienvenida). */
  level: LevelId | null
  mode: ModeId
  /** Webs que el estudiante marca como distracción (dominios, p. ej. "marca.com"). */
  extraDistractions: string[]
}

export const profileStore = createStore<Profile>('profile', {
  level: null,
  mode: 'normal',
  extraDistractions: [],
})

export function useProfile() {
  const [raw, setProfile] = useStore(profileStore)
  const stored: Partial<Profile> = raw && typeof raw === 'object' ? raw : {}
  // Datos de versiones anteriores o editados a mano: se sanean.
  const profile: Profile = {
    level: typeof stored.level === 'string' && stored.level in LEVELS ? stored.level : null,
    mode: typeof stored.mode === 'string' && stored.mode in MODES ? stored.mode : 'normal',
    extraDistractions: Array.isArray(stored.extraDistractions) ? stored.extraDistractions : [],
  }
  return {
    ...profile,
    setLevel: (level: LevelId) => setProfile((p) => ({ ...p, level })),
    setMode: (mode: ModeId) => setProfile((p) => ({ ...p, mode })),
    setExtraDistractions: (extraDistractions: string[]) => setProfile((p) => ({ ...p, extraDistractions })),
  }
}
