import { foldOcrConfusions, nameKey } from '../nameKey'
/** Jaro–Winkler similarity, including the mobile 0.7 prefix threshold. */
export function jaroWinkler(a: string, b: string) {
  if (a === b) return 1
  const radius = Math.max(0, Math.floor(Math.max(a.length, b.length) / 2) - 1)
  const used = new Set<number>(), matched: string[] = []
  for (let i = 0; i < a.length; i++) {
    for (let j = Math.max(0, i - radius); j < Math.min(b.length, i + radius + 1); j++) {
      if (!used.has(j) && a[i] === b[j]) {
        used.add(j);
        matched.push(a[i]);
        break
      }
    }
  }
  const n = matched.length
  if (!n) return 0
  const other = [...used].sort((x, y) => x - y)
  const differences = matched.filter((c, i) => c !== b[other[i]]).length
  const jaro = (n / a.length + n / b.length + (n - differences / 2) / n) / 3
  let prefix = 0
  while (prefix < Math.min(4, a.length, b.length) && a[prefix] === b[prefix]) prefix++
  return jaro < .7 ? jaro : jaro + prefix * .1 * (1 - jaro)
}
/** Levenshtein similarity divided by the longer string length. */
export function normalizedLevenshtein(a: string, b: string) {
  if (a === b) return 1
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    const next = [i]
    for (let j = 1; j <= b.length; j++) next.push(Math.min(prev[j - 1] + Number(a[i - 1] !== b[j - 1]), 1 + Math.min(prev[j], next[j - 1])))
    prev = next
  }
  return 1 - prev[b.length] / Math.max(a.length, b.length)
}
function compare(a: string, b: string) {
  const left = new Set(a.split(' ')), right = new Set(b.split(' '))
  const shared = [...left].filter(t => right.has(t)).sort().join(' ')
  function combined(side: Set<string>, other: Set<string>) {
    return [shared, ...[...side].filter(t => !other.has(t)).sort()].filter(Boolean).join(' ')
  }
  const x = combined(left, right), y = combined(right, left)
  return Math.max(jaroWinkler(a, b), normalizedLevenshtein(x, y), normalizedLevenshtein(shared, x), normalizedLevenshtein(shared, y))
}
/** Compares token order, token subsets and rn/m OCR confusions. */
export function nameSimilarity(a: string, b: string) {
  const left = nameKey(foldOcrConfusions(a, false)), right = nameKey(foldOcrConfusions(b, false))
  if (!left || !right) return 0
  const score = compare(left, right)
  if (score === 1 || !(left.includes('rn') || right.includes('rn'))) return score
  return Math.max(score, compare(nameKey(left.replaceAll('rn', 'm')), nameKey(right.replaceAll('rn', 'm'))))
}
