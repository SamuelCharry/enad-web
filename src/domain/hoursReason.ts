/** Categories available when worked hours fall short. */
export const REASON_CATEGORIES = ['Familiar', 'Personal', 'Salud', 'Transporte', 'Institucional', 'Otro']
/** Serializes a category and detail in the mobile storage format. */
export function formatReason(cat: string | null, detail: string) { return cat ? [cat, detail.trim()].filter(Boolean).join(': ') : '' }
/** Decodes current and legacy free-text reasons. */
export function parseReason(s: string | null) {
  for (const category of REASON_CATEGORIES) {
    if (s === category || s?.startsWith(category + ': ')) return { category, detail: s.slice(category.length + 2) }
  }
  return s?.trim() ? { category: 'Otro', detail: s } : { category: null, detail: '' }
}
/** Returns a validation message for a teacher's hours form, or null. */
export function validateHours({ planned, worked, reason }: { planned: number; worked: number; reason?: string | null }) {
  if (![planned, worked].every(n => Number.isFinite(n) && n >= 0 && n <= 24)) return 'Escribe horas entre 0 y 24.'
  if (worked === 0 && planned === 0) return 'Registra horas planeadas o realizadas.'
  if (worked >= planned) return null
  const { category, detail } = parseReason(reason ?? '')
  if (!category) return 'Selecciona un motivo.'
  if (!detail.trim()) return 'Escribe el motivo.'
  if (formatReason(category, detail) !== reason?.trim()) return 'Selecciona un motivo.'
  return formatReason(category, detail).length > 500 ? 'Acorta el detalle a 480 caracteres.' : null
}
