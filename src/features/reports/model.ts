import type { AttendanceMark, Campus, Moment, ReportFilters, School, Subject } from '../../domain/types'

export const geography = ['projectId', 'department', 'municipality', 'schoolId', 'campus'] as const
export type Geography = typeof geography[number]
export type Option = { value: string; label: string }
export interface FilterOptions {
  projects: string[]; departments: string[]; municipalities: string[]; schools: School[]; campuses: Campus[]
  loading: boolean; error?: string
}
export function filterChoices(options: FilterOptions): Record<Geography, Option[]> {
  const values = (items: string[]) => items.map(value => ({ value, label: value }))
  return {
    projectId: values(options.projects), department: values(options.departments), municipality: values(options.municipalities),
    schoolId: options.schools.map(s => ({ value: s.id, label: s.name })),
    campus: options.campuses.map(c => ({ value: c.id, label: c.name })),
  }
}

export function changeFilter(filters: ReportFilters, field: Geography, value: string): ReportFilters {
  const next = { ...filters }
  for (const key of geography.slice(geography.indexOf(field))) delete next[key]
  if (value) next[field] = value
  return next
}

export function matchesSchool(school: School, filters: ReportFilters) {
  return (!filters.projectId || school.projectId === filters.projectId)
    && (!filters.department || school.department === filters.department)
    && (!filters.municipality || school.municipality === filters.municipality)
    && (!filters.schoolId || school.id === filters.schoolId)
    && (!filters.campus || school.id === filters.schoolId || school.campuses.some(c => c.id === filters.campus))
}

const decimal = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 1 })
export const number = (value: number) => decimal.format(value)
export const percent = (value?: number | null) => value == null ? 'Sin datos' : number(value) + ' %'
export const ratio = (part: number, total: number) => total > 0 ? 100 * part / total : null

export function shiftDay(date: string, offset: number) {
  const day = new Date(date + 'T00:00:00Z')
  day.setUTCDate(day.getUTCDate() + offset)
  return day.toISOString().slice(0, 10)
}

export interface WeeklyHours { week: number; planned: number; worked: number }
export function hoursRows(weeks: WeeklyHours[]) {
  let cumulative = 0
  return [...weeks].sort((a, b) => a.week - b.week).map(week => {
    cumulative += week.worked
    return { ...week, cumulative, compliance: ratio(week.worked, week.planned) }
  })
}

export interface Summary {
  students: number; teachers: number; schools: number; campuses: number
  groupsBySubject: Record<Subject, number>; hoursPlanned: number; hoursWorked: number
  attendanceRate: number | null; studentsOverTime: { week: number; count: number }[]
}
export interface Submissions {
  week: number; range: { from: string; to: string }; total: number; attendanceSent: number; hoursSent: number
  teachers: { uid: string; fullName: string; schoolId: string; schoolName?: string; attendanceSent: boolean; hoursSent: boolean }[]
}
export interface LevelBlock {
  n: number; rezago: Partial<Record<Moment, number | null>>
  distribution: Partial<Record<Moment, Record<string, number>>>
}
export interface LevelsReport {
  overall: LevelBlock; bySchool: (LevelBlock & { schoolId: string; name: string })[]
  gender: Record<string, number>; age: Record<string, number>
}
interface Rate { rate: number | null; sessions: number }
export interface AttendanceReport {
  bySchool: (Rate & { schoolId: string; name: string })[]
  byGroup: (Rate & { groupId: string; name: string; teacherName: string })[]
  byTeacher: (Rate & { uid: string; fullName: string })[]
}
export interface HoursReport {
  byTeacher: { uid: string; fullName: string; weekly: WeeklyHours[]; cumulative: { planned: number; worked: number; rate: number | null } }[]
  bySchool: { schoolId: string; name: string; planned: number; worked: number; weekly: WeeklyHours[] }[]
}

export function studentRate(marks: AttendanceMark[], groupId: string, filters: ReportFilters) {
  const valid = marks.filter(m => m.groupId === groupId && (m.status === 'vino' || m.status === 'no_vino')
    && (!filters.from || m.date >= filters.from) && (!filters.to || m.date <= filters.to))
  return ratio(valid.filter(m => m.status === 'vino').length, valid.length)
}
