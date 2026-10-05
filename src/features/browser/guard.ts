import { distractionHosts, getDistraction, getMessagingApp, messagingHosts } from '../../lib/web'
import { distractionPolicy, type DistractionAction, type DistractionKind, type ModeId } from '../profile/profile'

/** Lo que hace falta saber para decidir si una web se abre, se avisa o se bloquea. */
export interface GuardContext {
  mode: ModeId
  /** Lista propia del estudiante («Mis distracciones»). */
  extraDistractions: readonly string[]
  /** Bloque de concentración corriendo (no en pausa ni esperando respuesta). */
  focusRunning: boolean
  /** Descanso corriendo. */
  onBreak: boolean
}

export interface GuardVerdict {
  action: DistractionAction
  /** null = web normal de estudio. */
  kind: DistractionKind | null
  /** Nombre de la distracción o de la app de mensajería. */
  label: string | null
  /** Está en «Mis distracciones», no en la lista de serie. */
  own: boolean
}

/** Saca del temporizador si se está concentrando o descansando ahora mismo. */
export function timerFlags(timer: { phase: string; status: string }): Pick<GuardContext, 'focusRunning' | 'onBreak'> {
  const running = timer.status === 'running'
  return { focusRunning: running && timer.phase === 'focus', onBreak: running && timer.phase === 'break' }
}

/** Decide qué hacer al abrir una web según el modo de estudio y el momento del temporizador. */
export function checkSite(url: URL, ctx: GuardContext): GuardVerdict {
  const timer = { focusRunning: ctx.focusRunning, onBreak: ctx.onBreak }
  const distraction = getDistraction(url, ctx.extraDistractions)
  if (distraction) {
    return {
      action: distractionPolicy(ctx.mode, 'distraction', timer),
      kind: 'distraction',
      label: distraction,
      own: getDistraction(url) === null,
    }
  }
  const messaging = getMessagingApp(url)
  if (messaging) {
    return { action: distractionPolicy(ctx.mode, 'messaging', timer), kind: 'messaging', label: messaging, own: false }
  }
  return { action: 'allow', kind: null, label: null, own: false }
}

/**
 * Dominios bloqueados ahora mismo (modo Estricto con un bloque en marcha). La versión de escritorio
 * los usa para impedir también los enlaces pulsados dentro de una página. Vacío = nada bloqueado.
 */
export function blockedSites(ctx: GuardContext): string[] {
  const timer = { focusRunning: ctx.focusRunning, onBreak: ctx.onBreak }
  const hosts: string[] = []
  if (distractionPolicy(ctx.mode, 'distraction', timer) === 'block') hosts.push(...distractionHosts(ctx.extraDistractions))
  if (distractionPolicy(ctx.mode, 'messaging', timer) === 'block') hosts.push(...messagingHosts())
  return [...new Set(hosts)].sort()
}
