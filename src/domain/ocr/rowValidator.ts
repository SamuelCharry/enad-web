import { foldOcrConfusions, nameKey, tokens } from '../nameKey'
import type { ParsedRow } from './rowParser'

const duplicateName = 'El nombre aparece más de una vez en la lista.'
const duplicateCode = 'El código aparece más de una vez en la lista.'
const codeKey = (r: ParsedRow) => foldOcrConfusions(r.code?.trim() ?? '')
function fields(row: ParsedRow) {
  const errors: string[] = []
  if (tokens(row.name).length < 2) errors.push('Escribe al menos dos palabras en el nombre.')
  if (/\d/.test(row.name)) errors.push('El nombre contiene números.')
  if (row.age != null && (row.age < 5 || row.age > 18)) errors.push('La edad debe estar entre 5 y 18 años.')
  if (row.grade != null && (row.grade < 3 || row.grade > 5)) errors.push('El grado debe estar entre 3 y 5.')
  if (row.sex && !['F', 'M'].includes(row.sex)) errors.push('El sexo debe ser F o M.')
  if (codeKey(row) && !/^\d{1,10}$/.test(codeKey(row))) errors.push('El código debe tener entre 1 y 10 dígitos.')
  return errors
}
/** Errors that prevent a roster match even when the code is exact. */
export function blockingIssues(row: ParsedRow) {
  return [...fields(row), ...row.issues.filter(i => i === duplicateName || i === duplicateCode)]
}
/** Revalidates all rows after editing, deleting or joining scanned pages. */
export function validateRows(rows: ParsedRow[]): ParsedRow[] {
  const names = new Map<string, number>(), codes = new Map<string, number>()
  for (const row of rows) {
    const key = nameKey(row.name), code = codeKey(row)
    if (key) names.set(key, (names.get(key) ?? 0) + 1)
    if (code) codes.set(code, (codes.get(code) ?? 0) + 1)
  }
  return rows.map(row => {
    const issues = new Set(fields(row))
    if ((names.get(nameKey(row.name)) ?? 0) > 1) issues.add(duplicateName)
    if ((codes.get(codeKey(row)) ?? 0) > 1) issues.add(duplicateCode)
    row.readingIssues.forEach(i => issues.add(i))
    if (Object.values(row.confidence).some(v => v < .6)) issues.add('El reconocimiento tiene baja confianza. Compara con la foto.')
    return { ...row, issues: [...issues] }
  })
}
