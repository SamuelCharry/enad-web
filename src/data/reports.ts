import { collection, collectionGroup, doc, getDoc, getDocs, query, where, type Query } from 'firebase/firestore'
import type { AttendanceMark, Evaluation, Group, HoursEntry, Moment, ReportFilters, School, Student, Subject, UserProfile } from '../domain/types'
import { MOMENTS, SUBJECTS, subjectLabel } from '../domain/levels'
import { colombiaToday, weeksElapsed } from '../domain/weeks'
import { api, caller, chunks, compare, configOf, fail, recordOf, reportCache, requireDate, requireSchool, schoolsOf } from './core'
import { db } from './firebase'
import { useSchools } from './scope'
import { getStudentHistory } from './students'
import { attendanceReport, exportReport, hoursReport, levels, submissions, summary, type SchoolData, type ReportData } from './reportMath'

async function rows<T>(q: Query) { return (await getDocs(q)).docs.map(d => recordOf<T>(d)) }
type ReportCaller = UserProfile & { visibleSchools?: School[] }
type Report = 'summary' | 'submissions' | 'levels' | 'attendance' | 'hours' | 'export'
function matchesSchool(s: School, f: ReportFilters) {
  return (!f.projectId || s.projectId === f.projectId) && (!f.department || s.department === f.department) &&
    (!f.municipality || s.municipality === f.municipality) && (!f.schoolId || s.id === f.schoolId)
}
async function inputs(p: ReportCaller, f: ReportFilters, report: Report, subject?: Subject): Promise<ReportData> {
  if (f.schoolId) await requireSchool(p, f.schoolId)
  const [configSnap, visible] = await Promise.all([getDoc(doc(db, 'program', 'config')), p.visibleSchools ?? schoolsOf(p)])
  const config = configOf(configSnap), from = f.from ? requireDate(f.from, 'fecha inicial') : config.implementationStartDate
  const to = f.to ? requireDate(f.to, 'fecha final') : colombiaToday(), schools: SchoolData[] = []
  const need = (...reports: Report[]) => report === 'export' || reports.includes(report)
  for (const school of visible.filter(s => matchesSchool(s, f))) {
    const scoped = where('schoolId', '==', school.id)
    const campusOk = (r: { campus: string }) => !f.campus || r.campus === f.campus
    const [allStudents, allGroups, allMarks, allHours, teacherDocs, evalPages] = await Promise.all([
      need('summary', 'levels') || (f.campus && need('submissions', 'attendance')) ? rows<Student>(query(collection(db, 'students'), scoped)) : [],
      need('summary', 'attendance') ? rows<Group>(query(collection(db, 'groups'), scoped)) : [],
      need('summary', 'submissions', 'attendance') ? rows<AttendanceMark>(query(collectionGroup(db, 'attendance'), scoped, where('date', '>=', from), where('date', '<=', to))) : [],
      need('summary', 'submissions', 'hours') ? rows<HoursEntry>(query(collection(db, 'hours'), scoped)) : [],
      report !== 'levels' ? rows<{ uid?: string; fullName: string }>(collection(db, 'schools', school.id, 'teachers')) : [],
      need('levels') ? Promise.all((subject ? [subject] : SUBJECTS).map(s => rows<Evaluation>(query(collectionGroup(db, 'evaluations'), scoped, where('subject', '==', s))))) : [],
    ])
    const students = allStudents.filter(campusOk), ids = new Set(students.map(r => r.id))
    const member = (r: { studentId: string }) => !f.campus || ids.has(r.studentId)
    schools.push({
      school,
      students,
      groups: allGroups.filter(campusOk),
      attendance: allMarks.filter(member),
      hours: allHours.filter(h => h.date >= from && h.date <= to),
      evaluations: evalPages.flat().filter(member),
      teachers: teacherDocs.map(t => ({ uid: t.uid ?? t.id, fullName: t.fullName ?? '' })).sort((a, b) => compare(a.fullName, b.fullName))
    })
  }
  return { schools, config, from, to, campus: f.campus, dateFiltered: !!(f.from || f.to) }
}
function cached<T>(name: string, filters: object, read: (p: ReportCaller) => Promise<T>) {
  return api(async () => {
    const p: ReportCaller = await caller(), now = Date.now()
    // Region membership is stored on schools and can change without a profile update.
    if (p.rol === 'coordinador') p.visibleSchools = await schoolsOf(p)
    for (const [k, v] of reportCache) if (v.expires <= now) reportCache.delete(k)
    const key = JSON.stringify([
      p.uid,
      p.rol,
      p.schoolIds,
      p.regions,
      p.visibleSchools?.map(s => s.id),
      name,
      Object.entries(filters).sort(([a], [b]) => compare(a, b))
    ])
    const prior = reportCache.get(key)
    if (prior) return prior.value as Promise<T>
    const value = read(p)
    reportCache.set(key, { expires: now + 300_000, value })
    try { return await value } catch (error) {
      if (reportCache.get(key)?.value === value) reportCache.delete(key);
      throw error
    }
  })
}
/** Program summary for the selected school and calendar scope. */
export function getSummary(f: ReportFilters) { return cached('summary', f, async p => summary(await inputs(p, f, 'summary'))) }
/** Weekly submission follow-up, defaulting to the last completed implementation week. */
export function getSubmissions(f: ReportFilters, week?: number) {
  return cached('submissions', { ...f, week }, async p => {
    const data = await inputs(p, f, 'submissions')
    const n = week ?? Math.max(1, weeksElapsed(data.config, colombiaToday()) - 1)
    if (!Number.isInteger(n) || n < 1) fail(400, 'La semana debe ser 1 o mayor.')
    return submissions(data, n)
  })
}
/** Level distributions, demographics and rezago by school, subject and moment. */
export function getLevels(f: ReportFilters, subject: Subject = 'lectura', moments: Moment[] = MOMENTS.slice(0, 4)) {
  return cached('levels', { ...f, subject, moments }, async p => {
    if (!SUBJECTS.includes(subject)) fail(400, 'La materia debe ser lectura o matemáticas.')
    return levels(await inputs(p, f, 'levels', subject), subject, moments.length ? moments.filter(m => MOMENTS.includes(m)) : MOMENTS.slice(0, 4))
  })
}
/** Attendance rates by school, group and teacher. */
export function getAttendanceReport(f: ReportFilters) { return cached('attendance', f, async p => attendanceReport(await inputs(p, f, 'attendance'))) }
/** Hours by school and teacher, with weekly and cumulative totals. */
export function getHoursReport(f: ReportFilters) { return cached('hours', f, async p => hoursReport(await inputs(p, f, 'hours'))) }
/** Loads one school at a time and joins raw export rows with scoped crosses. */
export function getExport(f: ReportFilters) { return cached('export', f, async p => exportReport(await inputs(p, f, 'export'))) }
/** Mis datos attendance indicators and the teacher's chronological activity. */
export function getTeacherMetrics(uid: string) {
  return cached('metrics', { uid }, async p => {
    if (p.rol === 'docente' && uid !== p.uid) fail(403, 'No tienes permiso para consultar estos datos.')
    const schools = p.visibleSchools ?? await schoolsOf(p), groups = new Map<string, Group>()
    for (const school of schools) {
      for (const g of await rows<Group>(query(collection(db, 'groups'), where('schoolId', '==', school.id)))) if (g.teacherId === uid) groups.set(g.id, g)
    }
    const students = new Set([...groups.values()].flatMap(g => g.studentIds))
    let recorded = 0, present = 0
    const history: { label: string; date: string; pending: boolean }[] = []
    for (const page of chunks([...students], 5)) {
      const histories = await Promise.all(page.map(sid => getStudentHistory(sid)))
      for (const h of histories) {
        for (const m of h.attendance) {
          const group = groups.get(m.groupId)
          if (!group) continue
          if (m.status === 'vino' || m.status === 'no_vino') {
            recorded++;
            if (m.status === 'vino') present++
          }
          if (m.teacherId === uid) history.push({ label: 'Asistencia · ' + group.name, date: m.date, pending: m.syncState === 'pending' })
        }
        for (const e of h.evaluations) if (e.teacherId === uid) history.push({ label: 'Evaluación · ' + subjectLabel(e.subject), date: e.date, pending: e.syncState === 'pending' })
      }
    }
    return { recorded, present, history: history.sort((a, b) => compare(b.date, a.date)) }
  })
}
/** Cascading filter choices derived from live accessible school documents. */
export function useFilterOptions(filters: ReportFilters) {
  const { schools: all, loading, error } = useSchools()
  const unique = (values: string[]) => [...new Set(values.filter(Boolean))].sort(compare)
  const projectSchools = all.filter(s => !filters.projectId || s.projectId === filters.projectId)
  const departmentSchools = projectSchools.filter(s => !filters.department || s.department === filters.department)
  const schools = departmentSchools.filter(s => !filters.municipality || s.municipality === filters.municipality)
  const campuses = schools.filter(s => !filters.schoolId || s.id === filters.schoolId).flatMap(s => s.campuses ?? [])
  return {
    projects: unique(all.map(s => s.projectId)), departments: unique(projectSchools.map(s => s.department)),
    municipalities: unique(departmentSchools.map(s => s.municipality)), schools, campuses, loading, error
  }
}
