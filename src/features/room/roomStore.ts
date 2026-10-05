import { createStore } from '../../hooks/store'
import { ROOM_HASH_PARAM, roomHash, roomLink, type ActiveRoom, type RoomPayload } from './room'

/** La sala en la que está este navegador (solo se guarda aquí; no hay servidor). */
export const roomStore = createStore<ActiveRoom | null>('room', null)

/**
 * Lo último guardado, aunque lo haya escrito otra pestaña de LockIn hace un instante
 * (el aviso entre pestañas llega con retraso). Así dos pestañas no apuntan el mismo bloque.
 */
export function readFreshRoom(): unknown {
  try {
    const raw = localStorage.getItem(`student-app:${roomStore.key}`)
    return raw === null ? null : JSON.parse(raw)
  } catch {
    return roomStore.get()
  }
}

/** Pone el enlace de la sala en la barra de direcciones sin crear una entrada en el historial. */
export function showRoomInAddress(room: RoomPayload): void {
  try {
    window.history.replaceState(window.history.state, '', roomHash(room))
  } catch {
    /* sin acceso al historial (p. ej. en un iframe): no pasa nada */
  }
}

/** Quita la sala de la barra de direcciones (al salir), para que recargar no vuelva a unirte. */
export function clearRoomFromAddress(): void {
  const params = new URLSearchParams(window.location.hash.replace(/^#/, ''))
  if (!params.has(ROOM_HASH_PARAM)) return
  params.delete(ROOM_HASH_PARAM)
  const rest = params.toString()
  try {
    window.history.replaceState(window.history.state, '', `${window.location.pathname}${window.location.search}${rest ? `#${rest}` : ''}`)
  } catch {
    /* sin acceso al historial */
  }
}

export function currentRoomLink(room: RoomPayload): string {
  return roomLink(room, window.location.href)
}

/** Copia texto al portapapeles. Devuelve false si el navegador no lo permite. */
export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {
    /* permiso denegado: se prueba a la antigua */
  }
  const area = document.createElement('textarea')
  area.value = text
  area.setAttribute('readonly', '')
  area.style.position = 'fixed'
  area.style.opacity = '0'
  document.body.appendChild(area)
  area.select()
  let ok = false
  try {
    ok = document.execCommand('copy')
  } catch {
    ok = false
  }
  area.remove()
  return ok
}

/** Copia el enlace de la sala; si no se puede, lo muestra para copiarlo a mano. */
export async function copyRoomLink(room: RoomPayload): Promise<boolean> {
  const link = currentRoomLink(room)
  const ok = await copyText(link)
  if (!ok) window.prompt('Copia este enlace y compártelo:', link)
  return ok
}
