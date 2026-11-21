import * as XLSX from 'xlsx'
import { LEVELS, MOMENTS, SUBJECTS } from '../levels'
import { importColumns, type ImportKind } from './schema'

type SchoolOption = { id: string; name: string; campuses?: { id: string; name: string }[] }
/** Parsed spreadsheet row, with source coordinates and review messages. */
export interface ImportRow {
  number: number;
  data: Record<string, unknown>;
  errors: string[];
  cells: Record<string, string>
}
type Options = {
  kind: ImportKind;
  filename: string;
  bytes: Uint8Array | ArrayBuffer | number[];
  schools: readonly SchoolOption[];
  existingStudents?: Iterable<{ schoolId: string; code: string }>
}
const str = (v: unknown) => String(v ?? '').trim()
const fold = (v: unknown) => str(v).toLowerCase().normalize('NFD').replace(/\p{M}/gu, '').replace(/[^a-z0-9]/g, '')
const codeKey = (v: unknown) => str(v).toUpperCase().replace(/[^A-Z0-9]/g, '')
function grid(options: Options) {
  const ext = options.filename.split('.').at(-1)?.toLowerCase()
  const bytes = options.bytes instanceof ArrayBuffer ? new Uint8Array(options.bytes) : Uint8Array.from(options.bytes)
  let book: XLSX.WorkBook
  if (ext === 'csv') {
    let csv: string
    try { csv = new TextDecoder('utf-8', { fatal: true }).decode(bytes) }
    catch { throw new Error('Guarda el archivo CSV con codificación UTF-8.') }
    book = XLSX.read(csv, { type: 'string', raw: true })
  } else if (ext === 'xlsx') {
    if (bytes[0] !== 0x50 || bytes[1] !== 0x4b) throw new Error('No se pudo leer el libro de Excel.')
    try { book = XLSX.read(bytes, { type: 'array', cellNF: true }) }
    catch { throw new Error('No se pudo leer el libro de Excel.') }
  } else throw new Error('Selecciona un archivo .xlsx o .csv.')
  const sheet = book.Sheets.Plantilla ?? book.Sheets[book.SheetNames[0]]
  // A formatted but empty column or row at the edge of a sheet can make
  // !ref span millions of cells. Only visit populated coordinates.
  const populated = new Map<number, Map<number, { text: string; formula: boolean }>>()
  for (const [address, raw] of Object.entries(sheet ?? {})) {
    if (address.startsWith('!')) continue
    const cell = raw as XLSX.CellObject
    let text = str(cell.v)
    if (cell.f) text = '=' + cell.f
    else if (cell.t === 'n' && cell.z && XLSX.SSF.is_date(String(cell.z))) {
      const dt = XLSX.SSF.parse_date_code(Number(cell.v), { date1904: book.Workbook?.WBProps?.date1904 })
      if (dt) text = [String(dt.y).padStart(4, '0'), String(dt.m).padStart(2, '0'), String(dt.d).padStart(2, '0')].join('-')
    }
    if (!text) continue
    const { r, c } = XLSX.utils.decode_cell(address)
    const row = populated.get(r) ?? new Map<number, { text: string; formula: boolean }>()
    row.set(c, { text, formula: !!cell.f })
    populated.set(r, row)
  }
  return [...populated].sort(([a], [b]) => a - b)
}
function resolve<T extends { id: string; name: string }>(v: unknown, options: readonly T[]) {
  const exact = options.find(i => i.id === v)
  if (exact) return exact
  const matches = options.filter(i => fold(i.name) === fold(v))
  return matches.length === 1 ? matches[0] : undefined
}
function validate(kind: ImportKind, data: Record<string, unknown>, errors: string[], schools: readonly SchoolOption[], codes: Set<string>) {
  function integer(key: string, label: string, min: number, max: number) {
    if (data[key] == null) return
    const n = Number(str(data[key]).replace(',', '.'))
    if (!Number.isInteger(n) || n < min || n > max) errors.push(label + ' debe ser un número entero entre ' + min + ' y ' + max + '.')
    else data[key] = n
  }
  function choice(key: string, label: string, options: string[]) {
    if (data[key] == null) return
    const match = options.find(o => fold(o) === fold(data[key]))
    if (match) data[key] = match
    else errors.push(label + ' debe ser uno de estos valores: ' + options.join(', ') + '.')
  }
  const school = data.schoolId ? resolve(data.schoolId, schools) : undefined
  if (data.schoolId && !school) errors.push('Institución desconocida o ambigua. Usa su ID.')
  if (school) {
    data.schoolId = school.id
    if (data.campus) {
      const campus = resolve(data.campus, school.campuses ?? [])
      if (campus) data.campus = campus.id
      else errors.push('La sede no pertenece a la institución o su nombre es ambiguo.')
    }
  }
  if (data.code && !codeKey(data.code)) errors.push('El código debe contener letras o números.')
  integer('sample', 'La muestra', 1, 4)
  choice('jornada', 'La jornada', ['mañana', 'tarde', 'única'])
  choice('subject', 'El área', SUBJECTS)
  if (kind === 'students') {
    integer('age', 'La edad', 5, 18)
    integer('grade', 'El grado', 3, 5)
    choice('gender', 'El sexo', ['F', 'M'])
    if (school && data.code) {
      const key = JSON.stringify([school.id, codeKey(data.code)])
      if (codes.has(key)) errors.push('Código duplicado en la institución.')
      else if (!errors.length) codes.add(key)
    }
  } else if (kind === 'teachers') {
    if (data.email && !/^[^\s@]+@[^\s@.]+(?:\.[^\s@.]+)+$/.test(str(data.email))) errors.push('Correo electrónico inválido.')
    data.schoolIds = data.schoolId ? [data.schoolId] : []
    data.campusIds = data.schoolId && data.campus ? { [str(data.schoolId)]: [data.campus] } : {}
    delete data.schoolId
    delete data.campus
    data.jornada ??= 'única'
  } else if (kind === 'schools') {
    choice('zone', 'La zona', ['urbana', 'rural'])
    const { campusId: id, campusName: name, jornada } = data
    if ((id || name || jornada) && !(id && name)) errors.push('Indica el ID y el nombre de la sede.')
    data.active = true
    data.campuses = id && name ? [{ id, name, jornada: jornada ?? 'única' }] : []
    delete data.campusId
    delete data.campusName
    delete data.jornada
  } else if (kind === 'evaluations') {
    choice('moment', 'El momento', MOMENTS)
    if (data.subject === 'matematicas' && ['1digito', '2digitos'].includes(fold(data.level))) data.level = fold(data.level) === '1digito' ? 'un_digito' : 'dos_digitos'
    if (data.subject === 'lectura' || data.subject === 'matematicas') choice('level', 'El nivel', LEVELS[data.subject])
    if (data.date) {
      const date = str(data.date), ms = Date.parse(date)
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(ms) || new Date(ms).toISOString().slice(0, 10) !== date)
        errors.push('La fecha debe ser válida y tener formato AAAA-MM-DD.')
    }
  }
}
/** Parses the preview without writing anything or evaluating workbook formulas. */
export function parseImport(options: Options) {
  const [header, ...records] = grid(options)
  if (!header) throw new Error('El archivo está vacío.')
  const schema = importColumns[options.kind]
  const aliases = new Map(schema.flatMap(f => [f.key, f.label, ...f.aliases].map(a => [fold(a), f] as const)))
  const fields = new Map([...header[1]].map(([col, cell]) => [col, aliases.get(fold(cell.text))]))
  const lastColumn = Math.max(...fields.keys())
  const used = new Set<string>()
  for (const field of fields.values()) if (field) {
    if (used.has(field.key)) throw new Error('La columna «' + field.label + '» está repetida.')
    used.add(field.key)
  }
  const missing = schema.filter(f => f.required && !used.has(f.key))
  if (missing.length) throw new Error('Faltan columnas obligatorias: ' + missing.map(f => f.label).join(', ') + '.')
  const codes = new Set(Array.from(options.existingStudents ?? [], s => JSON.stringify([s.schoolId, codeKey(s.code)])))
  const rows: ImportRow[] = []
  for (const [i, line] of records) {
    const row: ImportRow = { number: i + 1, data: {}, cells: {}, errors: [] }
    if ([...line.keys()].some(col => col > lastColumn)) row.errors.push('Hay datos después de la última columna. Revisa el separador del archivo.')
    fields.forEach((field, j) => {
      if (!field) return
      const cell = line.get(j), value = cell?.text ?? ''
      row.cells[field.key] = value
      if (cell?.formula) row.errors.push('«' + field.label + '» contiene una fórmula. Pega el valor de la celda.')
      else if (value) row.data[field.key] = value
      else if (field.required) row.errors.push('Falta ' + field.label.toLowerCase() + '.')
    })
    validate(options.kind, row.data, row.errors, options.schools, codes)
    rows.push(row)
  }
  return { rows, validRows: rows.filter(r => !r.errors.length) }
}
