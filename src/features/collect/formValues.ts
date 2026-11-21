export function matches(query: string, ...parts: (string | number)[]) {
  return parts.join(' ').toLocaleLowerCase('es-CO').includes(query.trim().toLocaleLowerCase('es-CO'))
}
export function validDay(day: string, today: string) { return day >= today.slice(0, 4) + '-01-01' && day <= today }
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
