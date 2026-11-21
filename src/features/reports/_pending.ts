// Temporary Team B contracts. An unavailable source must never look like a saved
// profile, a downloadable report, or a measured zero. Tests supply scoped fixtures.
import type { UserProfile, AttendanceMark, Evaluation, Group, HoursEntry, Moment, ProgramConfig, ReportFilters, School, Student, Subject } from '../../domain/types'
import type { AttendanceReport, FilterOptions, HoursReport, LevelsReport, Submissions, Summary } from './model'
import { shiftDay } from './model'

const error = 'La fuente de datos aún no está disponible.'
function unavailable<T>(): Promise<T> { return Promise.reject(new Error(error)) }
const offline: { loading: boolean; error?: string } = { loading: false, error }
function fallbackUseSchools() { return { ...offline, schools: [] as School[] } }
function fallbackUseProgramConfig() { return { ...offline, config: null as ProgramConfig | null } }
function fallbackUseGroups(_schoolId?: string, _opts?: { mine?: boolean }) { return { ...offline, groups: [] as Group[] } }
function fallbackUseStudents(_schoolId: string) { return { ...offline, students: [] as Student[] } }
function fallbackUseMyHours(_from: string, _to: string) { return { ...offline, hours: [] as HoursEntry[] } }
function fallbackUseFilterOptions(_filters: ReportFilters): FilterOptions {
  return { ...offline, projects: [], departments: [], municipalities: [], schools: [], campuses: [] }
}
function fallbackUpdateMyName(_fullName: string) { return unavailable<UserProfile & { syncState: string }>() }
function fallbackGetStudentHistory(_id: string) { return unavailable<{ attendance: AttendanceMark[]; evaluations: Evaluation[] }>() }
function fallbackGetTeacherMetrics(_uid: string) {
  return unavailable<{ present: number; recorded: number; history: { label: string; date: string; pending: boolean }[] }>()
}
function fallbackGetSummary(_f: ReportFilters) { return unavailable<Summary>() }
function fallbackGetSubmissions(_f: ReportFilters, _week?: number) { return unavailable<Submissions>() }
function fallbackGetLevels(_f: ReportFilters, _subject: Subject, _moments: Moment[]) { return unavailable<LevelsReport>() }
function fallbackGetAttendanceReport(_f: ReportFilters) { return unavailable<AttendanceReport>() }
function fallbackGetHoursReport(_f: ReportFilters) { return unavailable<HoursReport>() }
interface ExportData { raw: Record<string, unknown>[]; crosses: Record<string, unknown> }
function fallbackGetExport(_f: ReportFilters) { return unavailable<ExportData>() }
function fallbackBuildExcelExport(_exportData: ExportData): Blob { throw new Error(error) }

const fallbackSUBJECTS: Subject[] = ['lectura', 'matematicas']
const fallbackMOMENTS: Moment[] = ['linea_base', 'linea_media_1', 'linea_media_2', 'linea_final', 'verificacion']
const fallbackLEVELS: Record<Subject, string[]> = {
  lectura: ['principiante', 'letra', 'palabra', 'parrafo', 'cuento', 'comprension'],
  matematicas: ['principiante', 'un_digito', 'dos_digitos', 'resta', 'division', 'problema_escrito'],
}
function fallbackSubjectLabel(subject: Subject) { return subject === 'lectura' ? 'Lectura' : 'Matemáticas' }
function fallbackMomentLabel(moment: Moment) {
  return { linea_base: 'Línea base', linea_media_1: 'Línea media 1', linea_media_2: 'Línea media 2', linea_final: 'Línea final', verificacion: 'Verificación' }[moment]
}
function fallbackLevelLabel(subject: Subject, level: string) {
  const names = subject === 'lectura' ? ['Principiante', 'Letra', 'Palabra', 'Párrafo', 'Cuento', 'Comprensión']
    : ['Principiante', '1 dígito', '2 dígitos', 'Resta', 'División', 'Problema escrito']
  return names[fallbackLEVELS[subject].indexOf(level)] ?? 'Sin nivel'
}
function fallbackLevelColor(index: number) {
  return { bg: ['#B72619', '#CC6B68', '#F0BC40', '#F9D876', '#9BC184', '#56A359'][index] ?? '#E9E9E6', fg: index === 0 ? '#fff' : '#1D1D1B' }
}
function fallbackColombiaToday() { return new Date(Date.now() - 5 * 3600_000).toISOString().slice(0, 10) }
function fallbackWeeksElapsed(cfg: ProgramConfig, today: string) {
  const weekday = new Date(cfg.implementationStartDate + 'T00:00:00Z').getUTCDay()
  const firstMonday = shiftDay(cfg.implementationStartDate, -((weekday + 6) % 7))
  let count = 0
  for (let monday = firstMonday; monday <= today; monday = shiftDay(monday, 7)) {
    const sunday = shiftDay(monday, 6)
    if (!cfg.breaks.some(b => b.from <= sunday && b.to >= monday)) count++
  }
  return count
}

// Vite resolves each exact path at build time. When the shared modules land,
// the same feature entry points use them without a runtime request or a switch.
const scopeFallback = {
  useSchools: fallbackUseSchools,
  useProgramConfig: fallbackUseProgramConfig,
}
export const { useSchools, useProgramConfig } =
  Object.values(import.meta.glob<typeof scopeFallback>('../../data/scope.ts', { eager: true }))[0] ?? scopeFallback
const groupsFallback = {
  useGroups: fallbackUseGroups,
}
export const { useGroups } =
  Object.values(import.meta.glob<typeof groupsFallback>('../../data/groups.ts', { eager: true }))[0] ?? groupsFallback
const studentsFallback = {
  useStudents: fallbackUseStudents,
  getStudentHistory: fallbackGetStudentHistory,
}
export const { useStudents, getStudentHistory } =
  Object.values(import.meta.glob<typeof studentsFallback>('../../data/students.ts', { eager: true }))[0] ?? studentsFallback
const hoursFallback = {
  useMyHours: fallbackUseMyHours,
}
export const { useMyHours } =
  Object.values(import.meta.glob<typeof hoursFallback>('../../data/hours.ts', { eager: true }))[0] ?? hoursFallback
const profileFallback = {
  updateMyName: fallbackUpdateMyName,
}
export const { updateMyName } =
  Object.values(import.meta.glob<typeof profileFallback>('../../data/profile.ts', { eager: true }))[0] ?? profileFallback
const reportsFallback = {
  getSummary: fallbackGetSummary,
  getSubmissions: fallbackGetSubmissions,
  getLevels: fallbackGetLevels,
  getAttendanceReport: fallbackGetAttendanceReport,
  getHoursReport: fallbackGetHoursReport,
  getExport: fallbackGetExport,
  getTeacherMetrics: fallbackGetTeacherMetrics,
  useFilterOptions: fallbackUseFilterOptions,
}
export const { getSummary, getSubmissions, getLevels, getAttendanceReport, getHoursReport, getExport, getTeacherMetrics, useFilterOptions } =
  Object.values(import.meta.glob<typeof reportsFallback>('../../data/reports.ts', { eager: true }))[0] ?? reportsFallback
const excelFallback = {
  buildExcelExport: fallbackBuildExcelExport,
}
export const { buildExcelExport } =
  Object.values(import.meta.glob<typeof excelFallback>('../../domain/export/excel.ts', { eager: true }))[0] ?? excelFallback
const levelsFallback = {
  SUBJECTS: fallbackSUBJECTS,
  MOMENTS: fallbackMOMENTS,
  LEVELS: fallbackLEVELS,
  levelLabel: fallbackLevelLabel,
  subjectLabel: fallbackSubjectLabel,
  momentLabel: fallbackMomentLabel,
}
export const { SUBJECTS, MOMENTS, LEVELS, levelLabel, subjectLabel, momentLabel } =
  Object.values(import.meta.glob<typeof levelsFallback>('../../domain/levels.ts', { eager: true }))[0] ?? levelsFallback
const paletteFallback = {
  levelColor: fallbackLevelColor,
}
export const { levelColor } =
  Object.values(import.meta.glob<typeof paletteFallback>('../../domain/levelPalette.ts', { eager: true }))[0] ?? paletteFallback
const weeksFallback = {
  colombiaToday: fallbackColombiaToday,
  weeksElapsed: fallbackWeeksElapsed,
}
export const { colombiaToday, weeksElapsed } =
  Object.values(import.meta.glob<typeof weeksFallback>('../../domain/weeks.ts', { eager: true }))[0] ?? weeksFallback
