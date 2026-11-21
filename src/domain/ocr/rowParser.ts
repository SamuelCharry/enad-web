import { foldOcrConfusions, tokens } from '../nameKey'
import { validateRows } from './rowValidator'

/** One word in page coordinates with optional confidence in [0,1]. */
export interface OcrElement { text: string; left: number; right: number; confidence?: number | null }
/** Recognized horizontal line before merging overlapping baselines. */
export interface OcrLine { top: number; bottom: number; elements: OcrElement[] }
/** Transcribed student and the evidence worth reviewing with the photo. */
export interface ParsedRow {
  rawText: string;
  name: string;
  code?: string | null;
  age?: number | null;
  grade?: number | null;
  sex?: string | null
  confidence: Record<string, number>;
  readingIssues: string[];
  issues: string[]
}
type Field = 'name' | 'code' | 'age' | 'grade' | 'sex' | 'female' | 'male' | 'ignored'
type Anchor = { field: Field; left: number; right: number }
const headers: Record<string, Field> = {
  nombre: 'name',
  nombres: 'name',
  codigo: 'code',
  edad: 'age',
  grado: 'grade',
  sexo: 'sex',
  genero: 'sex',
  serie: 'ignored',
  muestra: 'ignored',
  nivel: 'ignored',
  lectura: 'ignored',
  matematicas: 'ignored',
  f: 'female',
  m: 'male'
}
function anchors(cells: OcrElement[]) {
  const result: Anchor[] = []
  cells.forEach((cell, i) => {
    const words = tokens(cell.text)
    const field = headers[words[0]] ?? (words[0] === 'l' ? 'ignored' : undefined)
    if (field) result.push({ field, left: cells[i - 1]?.text.trim() === '#' ? cells[i - 1].left : cell.left, right: cell.right })
    else if (result.length && words.length && words.every(w => ['del', 'de', 'la', 'estudiante', 'estudiantes', 'base'].includes(w))) result[result.length - 1].right = cell.right
  })
  return result.some(a => a.field === 'name') && result.some(a => ['code', 'age', 'grade', 'sex', 'ignored'].includes(a.field)) ? result : []
}
function bands(source: OcrLine[]) {
  const center = (l: OcrLine) => (l.top + l.bottom) / 2
  const lines = source.filter(l => Number.isFinite(l.top) && Number.isFinite(l.bottom) && l.bottom > l.top && l.elements.length)
    .sort((a, b) => center(a) - center(b))
  const heights = lines.map(l => l.bottom - l.top).sort((a, b) => a - b)
  const median = (heights[Math.floor((lines.length - 1) / 2)] + heights[Math.floor(lines.length / 2)]) / 2
  const rows: OcrElement[][] = []
  let mid = 0, count = 0
  for (const line of lines) {
    if (!rows.length || center(line) - mid > median * .6) {
      rows.push([]);
      mid = center(line);
      count = 0
    }
    mid += (center(line) - mid) / ++count
    rows[rows.length - 1].push(...line.elements.filter(e => Number.isFinite(e.left) && Number.isFinite(e.right) && e.right > e.left && e.text.trim()))
  }
  return rows.map(r => r.sort((a, b) => a.left - b.left))
}
const boundary = (a: Anchor, b: Anchor) => b.left - Math.max(0, Math.min((b.left - a.right) / 2, (b.right - b.left) / 2))
const footer = (cells: OcrElement[]) => cells.some(c => ['total', 'totales', 'porcentaje'].includes(tokens(c.text)[0]))
function blank(cells: OcrElement[]): ParsedRow {
  return {
    rawText: cells.map(c => c.text.trim()).join(' '),
    name: '',
    code: null,
    age: null,
    grade: null,
    sex: null,
    confidence: {},
    readingIssues: [],
    issues: []
  }
}
function observe(row: ParsedRow, key: string, value?: number | null) {
  if (value != null && Number.isFinite(value)) row.confidence[key] = Math.min(row.confidence[key] ?? Infinity, value)
}
function table(cells: OcrElement[], layout: Anchor[]) {
  const row = blank(cells), issues = new Set<string>()
  const values: Partial<Record<Field, string>> = {}
  for (const cell of cells) {
    let best = 0, field: Field = 'ignored'
    for (const [i, a] of layout.entries()) {
      const left = i ? boundary(layout[i - 1], a) : -Infinity
      const right = i + 1 < layout.length ? boundary(a, layout[i + 1]) : Infinity
      const overlap = Math.min(cell.right, right) - Math.max(cell.left, left)
      if (overlap > best) {
        best = overlap;
        field = a.field
      }
    }
    if (field === 'ignored') continue
    if (best < (cell.right - cell.left) * .6) issues.add('Hay texto entre dos columnas. Verifica los campos.')
    values[field] = [values[field], cell.text.trim()].filter(Boolean).join(' ')
    observe(row, field, cell.confidence)
  }
  function number(field: Field, label: string) {
    const s = values[field]
    if (!s) return null
    const digits = foldOcrConfusions(s)
    if (/^\d+$/.test(digits)) return Number(digits)
    issues.add('No se pudo leer ' + label + ' («' + s + '»).')
    return null
  }
  row.name = values.name ?? ''
  row.code = values.code ? foldOcrConfusions(values.code) : null
  row.age = number('age', 'la edad')
  row.grade = number('grade', 'el grado')
  const sex = values.sex ? [values.sex.toUpperCase()] : []
  for (const field of ['female', 'male'] as const) {
    const mark = values[field], letter = field === 'female' ? 'F' : 'M'
    if (mark) sex.push(['X', '✓', '✔', letter].includes(mark.toUpperCase()) ? letter : 'Marca «' + mark + '»')
  }
  row.sex = sex.join('/') || null
  row.readingIssues = [...issues]
  return row
}
function panels(cells: OcrElement[], layout: Anchor[]) {
  const names = layout.flatMap((a, i) => a.field === 'name' ? [i] : [])
  let start = 0
  const rows: ParsedRow[] = []
  for (const [i, name] of names.entries()) {
    let end = names[i + 1] ?? layout.length
    const repeat = end - names[0]
    if (i + 1 < names.length && repeat > name && layout[repeat].field === layout[0].field) end = repeat
    const left = start ? boundary(layout[start - 1], layout[start]) : -Infinity
    const right = end < layout.length ? boundary(layout[end - 1], layout[end]) : Infinity
    const region = cells.filter(c => (c.left + c.right) / 2 >= left && (c.left + c.right) / 2 < right)
    if (region.length && !footer(region)) rows.push(table(region, layout.slice(start, end)))
    start = end
  }
  return rows
}
function plain(cells: OcrElement[]) {
  const row = blank(cells)
  const words = row.rawText.split(/[\s,;]+/).filter(Boolean)
  if (/^\d{1,3}[.)-]$/.test(words[0])) words.shift()
  const names: string[] = [], issues = new Set<string>()
  const grades: Record<string, number> = { tercero: 3, tercer: 3, cuarto: 4, quinto: 5 }
  const numeric = (w: string) => /\d/.test(w) && /^\d{1,10}$/.test(foldOcrConfusions(w))
  words.forEach((w, i) => {
    if (grades[w.toLowerCase()] && names.length >= 2) row.grade = grades[w.toLowerCase()]
    else if (numeric(w)) {
      const digits = foldOcrConfusions(w), n = Number(digits)
      if (!i && words.length > 1 && numeric(words[1]) && w.length <= 2) issues.add('Verifica el número de serie y el código.')
      else if (row.code == null && (!i || digits.length >= 3)) {
        row.code = digits
        if (!i && digits.length <= 2) issues.add('Verifica si el primer número es el código.')
      } else if (row.age == null && n >= 5 && n <= 18) row.age = n
      else if (row.grade == null && n >= 3 && n <= 5) row.grade = n
      else if (row.code != null && row.age == null && names.length >= 2 && digits.length <= 2) row.age = n
      else if (row.code == null) {
        row.code = digits;
        issues.add('Verifica la columna del número «' + w + '».')
      }
      else issues.add('No se identificó la columna del número «' + w + '».')
    } else if (/^[fm]$/i.test(w) && (i === words.length - 1 || i > 1)) {
      if (row.sex) issues.add('Verifica el sexo en la foto.')
      row.sex = w.toUpperCase()
    } else if (i === words.length - 1 && row.age != null && /^[a-z]$/i.test(w)) row.sex = w.toUpperCase()
    else if (w !== '|' && w !== '-') {
      if ((row.age != null || row.sex) && names.length) issues.add('Hay texto después de los datos. Verifica el nombre.')
      names.push(w)
    }
  })
  for (const [i, cell] of cells.entries()) {
    observe(row, 'row', cell.confidence)
    if (i && row.code == null && row.age == null && row.sex == null) {
      const prev = cells[i - 1], width = (prev.right - prev.left) / Math.max(1, prev.text.length)
      const tokenCount = (part: OcrElement[]) => tokens(part.map(c => c.text).join(' ')).length
      if (cell.left - prev.right > 6 * width && tokenCount(cells.slice(0, i)) >= 2 && tokenCount(cells.slice(i)) >= 2)
        issues.add('Podría haber dos estudiantes en esta línea. Verifica la foto.')
    }
  }
  return { ...row, name: names.join(' '), readingIssues: [...issues] }
}
/** Parses plain rosters and multi-panel compilation forms in page coordinates. */
export function parseRows(lines: OcrLine[]): ParsedRow[] {
  let layout: Anchor[] = []
  const rows: ParsedRow[] = []
  for (const cells of bands(lines)) {
    if (!cells.length) continue
    const found = anchors(cells)
    if (found.length) {
      layout = found;
      continue
    }
    const raw = cells.map(c => c.text.trim()).join(' ')
    if (!layout.length && footer(cells)) continue
    if (/^(?:formato de compilaci[oó]n|lista de (?:clase|estudiantes|asistencia)|listado de estudiantes|instituci[oó]n educativa|sede[: ]|jornada[: ]|docente:|colegio:)\b/i.test(raw)) continue
    const markers = cells.filter(c => /^[fm]$/i.test(c.text.trim()))
    if (markers.length === 2 && new Set(markers.map(c => c.text.trim().toUpperCase())).size === 2 && layout.some(a => a.field === 'sex')
      && !/\d/.test(raw) && tokens(raw).every(w => ['f', 'm', 'del', 'estudiante', 'base', 'nivel'].includes(w))) {
      layout = layout.filter(a => !['sex', 'female', 'male'].includes(a.field))
      for (const c of markers) layout.push({ ...c, field: c.text.trim().toUpperCase() === 'F' ? 'female' : 'male' })
      layout.sort((a, b) => a.left - b.left)
    } else if (layout.length) rows.push(...panels(cells, layout))
    else if (/\d/.test(raw) || !tokens(raw).every(w => headers[w] || ['del', 'estudiante', 'estudiantes'].includes(w))) rows.push(plain(cells))
  }
  return validateRows(rows)
}
