import { useMemo } from 'react'
import { createStore, useStore } from '../../hooks/store'

/**
 * Modo foco: durante un bloque de concentración se oculta todo menos el reloj y el navegador.
 * Se apaga solo al acabar o terminar el bloque (lo hace TimerProvider).
 */
export const focusModeStore = createStore<boolean>('focus-mode', false)

/** Clase que App.tsx pone en `.layout` mientras el modo foco está activo (estilos en focus.css). */
export const FOCUS_MODE_CLASS = 'is-focus-mode'

export function setFocusMode(on: boolean): void {
  if (focusModeStore.get() !== on) focusModeStore.set(on)
}

export function useFocusMode(): { on: boolean; toggle: () => void; set: (on: boolean) => void } {
  const [value, setValue] = useStore(focusModeStore)
  const on = value === true
  return useMemo(
    () => ({
      on,
      toggle: () => setValue((v) => v !== true),
      set: (next: boolean) => setValue(next),
    }),
    [on, setValue],
  )
}
