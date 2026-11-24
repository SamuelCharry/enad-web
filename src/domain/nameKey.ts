const special: Record<string, string> = { đ: 'd', ħ: 'h', ı: 'i', ł: 'l', ø: 'o', ŧ: 't' }
/** Accent-insensitive name tokens in their original order. */
export function fold(value: string) {
  return value.toLowerCase().normalize("NFD").replace(/[đħıłøŧ]/g, c => special[c]).replace(/\p{M}/gu, "")
}
export function tokens(value: string) {
  const normalized = fold(value).replace(/[^\p{L}\s]/gu, '').trim()
  return normalized ? normalized.split(/\s+/) : []
}
/** Canonical identity key shared by rosters, OCR and imports. */
export function nameKey(fullName: string) { return tokens(fullName).sort().join(' ') }
/** Repairs ambiguous glyphs only in the relevant numeric or name context. */
export function foldOcrConfusions(value: string, numeric = true) {
  const repairs: Record<string, string> = numeric ? { O: '0', o: '0', l: '1', I: '1', '|': '1', S: '5', B: '8', Z: '2', G: '6' } : { '0': 'o', '1': 'l', '5': 's' }
  return Array.from(value, ch => repairs[ch] ?? ch).join('')
}
