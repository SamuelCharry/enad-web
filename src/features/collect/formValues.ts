import { validCalendarDay } from '../../domain/weeks'
import { fold } from '../../domain/nameKey'

export function matches(query: string, ...parts: (string | number)[]) {
  const haystack = fold(parts.join(' '))
  return fold(query).trim().split(/\s+/).every(token => haystack.includes(token))
}
export function validDay(day: string, today: string) { return validCalendarDay(day) && day >= today.slice(0, 4) + '-01-01' && day <= today }
export const genders = [{ id: 'F', name: 'Femenino' }, { id: 'M', name: 'Masculino' }] as const
export function numbers(min: number, max: number) { return Array.from({ length: max - min + 1 }, (_, i) => ({ id: String(min + i), name: String(min + i) })) }

export function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
