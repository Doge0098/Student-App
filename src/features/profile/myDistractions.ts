import { getDistraction, normalizeDomain } from '../../lib/web'

/** Tope para que la lista no crezca sin control (se guarda en el navegador). */
export const MAX_DISTRACTIONS = 100

export type AddDistractionResult = { ok: true; list: string[]; domain: string } | { ok: false; error: string }

/** Añade una web a «Mis distracciones» o explica por qué no hace falta o no se puede. */
export function addDistraction(input: string, list: readonly string[]): AddDistractionResult {
  const domain = normalizeDomain(input)
  if (!domain) return { ok: false, error: 'Eso no parece una web. Prueba con algo como marca.com.' }
  if (list.includes(domain)) return { ok: false, error: 'Ya está en tu lista.' }
  const builtIn = getDistraction(new URL(`https://${domain}/`))
  if (builtIn) return { ok: false, error: `No hace falta: ya vigilo ${builtIn}.` }
  if (list.length >= MAX_DISTRACTIONS) {
    return { ok: false, error: `Tu lista está llena (${MAX_DISTRACTIONS} webs). Quita alguna antes.` }
  }
  return { ok: true, list: [...list, domain], domain }
}
