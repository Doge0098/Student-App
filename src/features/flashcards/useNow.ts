import { useEffect, useState } from 'react'

/** La hora actual, refrescada cada minuto (para que «hoy», «para hoy» o «hace 5 min» cambien solos con la app abierta). */
export function useNow(everyMs = 60_000): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), everyMs)
    return () => window.clearInterval(id)
  }, [everyMs])
  return now
}
