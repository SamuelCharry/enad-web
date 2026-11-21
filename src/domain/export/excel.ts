import * as XLSX from 'xlsx'
import { MOMENTS, SUBJECTS, subjectLabel } from '../levels'
import { workbookBlob } from './workbook'
type Row = Record<string, unknown>
const moments: Record<string, string> = {
  linea_base: 'Línea base',
  linea_media_1: 'Línea media 1',
  linea_media_2: 'Línea media 2',
  linea_final: 'Línea final',
  verificacion: 'Verificación'
}
const rawLabels: Record<string, string> = {
  fullName: 'Estudiante',
  code: 'Código',
  gender: 'Sexo',
  age: 'Edad',
  grade: 'Grado',
  schoolName: 'IE',
  campus: 'Sede',
  municipality: 'Municipio',
  groupName: 'Grupo',
  subject: 'Área',
  teacherName: 'Docente',
  date: 'Fecha',
  attendance: 'Estado asistencia',
  ...Object.fromEntries(MOMENTS.map(m => [m, 'Nivel · ' + moments[m]]))
}
const gatewayLabels: Record<string, string> = {
  school: 'IE',
  schoolId: 'Código IE',
  department: 'Departamento',
  municipality: 'Municipio',
  zone: 'Zona',
  campus: 'Sede',
  studentId: 'ID estudiante',
  code: 'Código',
  fullName: 'Estudiante',
  grade: 'Grado',
  gender: 'Sexo',
  age: 'Edad',
  sample: 'Muestra',
  retired: 'Retirado',
  provisional: 'Provisional',
  present: 'Asistencias',
  absent: 'Inasistencias',
  attendanceRate: 'Tasa de asistencia (%)',
  group_lectura: 'Grupo lectura',
  teacher_lectura: 'Docente lectura',
  group_matematicas: 'Grupo matemáticas',
  teacher_matematicas: 'Docente matemáticas'
}
for (const s of SUBJECTS) for (const m of MOMENTS) gatewayLabels[s + '_' + m] = subjectLabel(s) + ' · ' + moments[m]
const labels: Record<string, string> = {
  ...gatewayLabels,
  ...rawLabels,
  week: 'Semana',
  rate: 'Tasa de asistencia (%)',
  planned: 'Horas planeadas',
  worked: 'Horas ejecutadas',
  moment: 'Momento',
  level: 'Nivel',
  count: 'Cantidad'
}
const sections: [string, string, string[]][] = [
  ['attendanceByGroup', 'Asistencia por grupo', ['groupName', 'teacherName', 'rate']],
  ['attendanceByTeacher', 'Asistencia por docente', ['teacherName', 'rate']],
  ['attendanceBySchool', 'Asistencia por institución', ['schoolName', 'rate']],
  ['weeklyHours', 'Horas por docente y semana', ['teacherName', 'week', 'planned', 'worked']],
  ['levels', 'Distribución de niveles', ['subject', 'moment', 'level', 'count']],
  ['gender', 'Distribución por género', ['gender', 'count']],
  ['age', 'Distribución por edad', ['age', 'count']],
]
const object = (v: unknown): Row => v && typeof v === 'object' && !Array.isArray(v) ? v as Row : {}
const rows = (v: unknown): Row[] => Array.isArray(v) ? v.map(object) : []
function flatten(crosses: Row): Row {
  if (sections.some(([key]) => Array.isArray(crosses[key]))) return crosses
  const attendance = object(crosses.attendance), levels = object(crosses.levels), first = object(Object.values(levels)[0])
  return {
    attendanceByGroup: rows(attendance.byGroup).map(r => ({ groupName: r.name, teacherName: r.teacherName, rate: r.rate })),
    attendanceByTeacher: rows(attendance.byTeacher).map(r => ({ teacherName: r.fullName, rate: r.rate })),
    attendanceBySchool: rows(attendance.bySchool).map(r => ({ schoolName: r.name, rate: r.rate })),
    weeklyHours: rows(object(crosses.hours).byTeacher).flatMap(t => rows(t.weekly).map(w => ({ ...w, teacherName: t.fullName }))),
    levels: Object.entries(levels).flatMap(([subject, s]) => Object.entries(object(object(object(s).overall).distribution)).flatMap(([m, dist]) =>
      Object.entries(object(dist)).map(([level, count]) => ({ subject, moment: moments[m] ?? m, level, count })))),
    gender: Object.entries(object(first.gender)).map(([gender, count]) => ({ gender, count })),
    age: Object.entries(object(first.age)).map(([age, count]) => ({ age, count })),
  }
}
function table(columns: string[], list: Row[]) {
  return [columns.map(k => labels[k] ?? k), ...list.map(r => columns.map(k => {
    const v = r[k]
    return typeof v === 'string' && /^[=+@-]/.test(v) ? "'" + v : v
  }))]
}
/** Builds Datos and Cruces from a scoped gateway export or a legacy flat payload. */
export function buildExcelExport(exportData: { raw: Row[]; crosses: Row }): Blob {
  const { raw, crosses } = exportData, book = XLSX.utils.book_new()
  const columns = [...new Set([...Object.keys(raw.some(r => 'studentId' in r) ? gatewayLabels : rawLabels), ...raw.flatMap(Object.keys)])]
  const data = XLSX.utils.aoa_to_sheet(table(columns, raw))
  data['!cols'] = columns.map(() => ({ wch: 27 }))
  XLSX.utils.book_append_sheet(book, data, 'Datos')
  const flat = flatten(crosses), grid: unknown[][] = [], headings: number[] = []
  for (const [key, title, cols] of sections) {
    headings.push(grid.length + 1, grid.length + 2)
    grid.push([title], ...table(cols, rows(flat[key])))
  }
  const sheet = XLSX.utils.aoa_to_sheet(grid)
  sheet['!cols'] = Array.from({ length: 4 }, () => ({ wch: 27 }))
  XLSX.utils.book_append_sheet(book, sheet, 'Cruces')
  return workbookBlob(book, [[1], headings])
}
