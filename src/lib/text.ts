/** Pasa a minúsculas y quita tildes para comparar textos sin importar acentos. */
export function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
}

export function uid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return Math.random().toString(36).slice(2) + Date.now().toString(36)
}

export function hostMatches(host: string, domain: string): boolean {
  const h = host.toLowerCase()
  return h === domain || h.endsWith(`.${domain}`)
}
