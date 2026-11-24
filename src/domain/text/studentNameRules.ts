import { nameKey, tokens } from '../nameKey'
import { normalizedLevenshtein, nameSimilarity } from '../ocr/similarity'

const particles = new Set(['de', 'del', 'la', 'las', 'los', 'y'])
const letters = /\p{L}/gu

export function cleanName(input: string): string {
  return input.trim().split(/\s+/u).map(token => {
    const stripped = token.toLowerCase().replace(/’/g, "'").replace(/[^\p{L}\p{M}'-]/gu, '')
    const parts = stripped.match(/\p{L}[\p{L}\p{M}]*(?:['-]\p{L}[\p{L}\p{M}]*)*/gu) ?? []
    const word = parts.join('')
    if (particles.has(word)) return word
    return word.replace(/(^|['-])(\p{L})/gu, (_, prefix: string, letter: string) => prefix + letter.toUpperCase())
  }).filter(Boolean).join(' ')
}

export function validateName(input: string, confidence?: number | null): string[] {
  const words = cleanName(input).split(' ').filter(Boolean)
  const sizes = words.map(word => (word.match(letters) ?? []).length)
  const count = sizes.reduce((sum, n) => sum + n, 0)
  const initial = words.some((word, i) => sizes[i] === 1 && !particles.has(word))
  const flags = []
  if (words.length < 2 || words.length > 6 || count < 3 || count > 60 || initial) flags.push('formato_nombre')
  if (sizes.includes(1) || /(?:^|\s)\p{L}\.(?:\s|$)/u.test(input)) flags.push('solo_iniciales')
  if (input.toUpperCase() === input && input.toLowerCase() !== input) flags.push('mayusculas')
  if (confidence != null && confidence < .85) flags.push('ocr_baja_confianza')
  return flags
}

export function rosterMatches<T extends { id: string; fullName: string }>(input: string, roster: readonly T[]) {
  const name = cleanName(input)
  if (!name) return []
  const surnames = (value: string) => {
    const words = tokens(value).filter(t => !particles.has(t))
    return words.slice(words.length >= 4 ? -2 : -1).filter(t => t.length >= 2)
  }
  const last = surnames(name)
  return roster.filter(s => nameKey(name) === nameKey(s.fullName) ||
    tokens(name).length >= 2 && last.some(a => surnames(s.fullName).some(b => normalizedLevenshtein(a,b) >= .75))).map(student => ({ student, score: nameSimilarity(name, student.fullName) }))
    .filter(match => match.score >= .70)
    .sort((a, b) => b.score - a.score || a.student.id.localeCompare(b.student.id))
}

export function reasonLabel(reason: string): string {
  if (reason.startsWith('posible_duplicado:')) return 'Se parece a otro estudiante'
  return ({
    formato_nombre: '¿Es un nombre?', solo_iniciales: 'Tiene iniciales', mayusculas: 'Estaba en mayúsculas',
    ocr_baja_confianza: 'La foto no se lee bien'
  })[reason] ?? 'Revisar el nombre'
}
