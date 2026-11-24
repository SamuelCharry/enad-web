import { colombiaToday, validCalendarDay } from './weeks'

export function validStoredHours(row:{date?:unknown; plannedHours?:unknown; workedHours?:unknown; reason?:unknown}) {
  return validCalendarDay(row.date) && row.date <= colombiaToday() &&
    [row.plannedHours,row.workedHours].every(n => typeof n === 'number' && Number.isFinite(n) && n >= 0 && n <= 24) &&
    (row.reason == null || typeof row.reason === 'string' && row.reason.length <= 600)
}

export const cleanDetail = (value:string) => value.replace(/(?:[0-9#*]\uFE0F?\u20E3|[\p{Extended_Pictographic}\p{Regional_Indicator}\p{Emoji_Modifier}]|\u200D|\uFE0F)/gu,'').replace(/ {2,}/g,' ')
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
  if (![planned,worked].every(n => Number.isInteger(n * 2))) return 'Usa horas enteras o medias horas.'
  if (worked === 0 && planned === 0) return 'Registra horas planeadas o realizadas.'
  if ((reason?.length ?? 0) > 600) return 'Usa hasta 600 caracteres para el motivo.'
  if (worked >= planned) return null
  const { category, detail } = parseReason(reason ?? '')
  if (!category) return 'Selecciona un motivo.'
  if (!detail.trim()) return 'Escribe el motivo.'
  if (formatReason(category, detail) !== reason?.trim()) return 'Selecciona un motivo.'
  return null
}
