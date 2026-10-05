import { useEffect, useState } from 'react'

const PREFIX = 'student-app:'

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(PREFIX + key)
    return raw === null ? fallback : (JSON.parse(raw) as T)
  } catch {
    return fallback
  }
}

/** Igual que useState, pero se guarda en el navegador y sobrevive a recargar la página. */
export function usePersistentState<T>(key: string, initial: T | (() => T)) {
  const [fallback] = useState<T>(() => (typeof initial === 'function' ? (initial as () => T)() : initial))
  const [value, setValue] = useState<T>(() => read(key, fallback))

  // Otra pestaña de LockIn ha cambiado este dato (o lo ha borrado todo): se adopta su valor,
  // para no volver a escribir encima una copia vieja.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== null && e.key !== PREFIX + key) return
      setValue(read(key, fallback))
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [key, fallback])

  useEffect(() => {
    try {
      localStorage.setItem(PREFIX + key, JSON.stringify(value))
    } catch {
      /* almacenamiento lleno o bloqueado: la app sigue funcionando sin guardar */
    }
  }, [key, value])

  return [value, setValue] as const
}
