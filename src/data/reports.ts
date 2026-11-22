import { qualityIssues } from './quality'
import { reportRange, submissionWindow } from './reportRange'
import { collection, doc, documentId, getDoc, getDocs, limit, orderBy, query, where } from 'firebase/firestore'
import type { AttendanceMark, Evaluation, Group, HoursEntry, Moment, ReportFilters, School, Student, Subject, UserProfile } from '../domain/types'
import { LEVELS, MOMENTS, SUBJECTS, subjectLabel } from '../domain/levels'
import { colombiaToday, rangeOf, weekOf, weeksElapsed } from '../domain/weeks'
import { api, caller, chunks, compare, configOf, fail, recordOf, reportCache, requireDate, requireSchool, schoolsOf } from './core'
import { cachedResult } from './reportCache'
import { attendanceTotals, distinctPresent, distinctStudentRows, enrollment, dates, equal, hoursTotal, mapBatches, rows, scoped, sessions, total } from './reads'
import { db } from './firebase'
import { milestones, movement } from './managementMetrics'
import { useSchools } from './scope'
import { attendanceReport, exportReport, hoursReport, type ReportData } from './reportMath'

type ReportCaller = UserProfile & { visibleSchools?: School[] }
type Report = 'attendance' | 'hours' | 'export'
function matchesSchool(s: School, f: ReportFilters) {
  return (!f.projectId || s.projectId === f.projectId) && (!f.department || s.department === f.department) &&
    (!f.municipality || s.municipality === f.municipality) && (!f.schoolId || s.id === f.schoolId)
}
async function reportSchools(p: ReportCaller, id?: string) {
  if (!id) return schoolsOf(p)
  await requireSchool(p, id)
  const snap = await getDoc(doc(db, 'schools', id))
  return snap.exists() ? [recordOf<School>(snap)] : []
}
async function context(p: ReportCaller, f: ReportFilters, weeks = 1) {
  if (f.from) requireDate(f.from, 'fecha inicial')
  if (f.to) requireDate(f.to, 'fecha final')
  if (f.from && f.to && f.from > f.to) fail(400, 'La fecha final debe ser igual o posterior a la fecha inicial.')
  const [snap, visible] = await Promise.all([getDoc(doc(db, 'program', 'config')), p.visibleSchools ?? reportSchools(p, f.schoolId)])
  const config = configOf(snap)
  const { from, to } = reportRange(config, f, weeks)
  return { config, from, to, campus: f.campus, dateFiltered: true, visible: visible.filter(s => matchesSchool(s, f)) }
}
function campusFilter(s: School, campus?: string) {
  if (!campus) return []
  const c = s.campuses.find(c => c.id === campus || c.name === campus)
  return [where('campus', 'in', [...new Set(c ? [c.id, c.name] : [campus])])]
}
async function studentIdsInOrder(school: School, campus?: string) {
  const roster = scoped('students', school.id, ...campusFilter(school, campus), orderBy(documentId()))
  return (await getDocs(roster)).docs.map(s => s.id)
}
async function directory(school: School) {
  return (await rows<{ uid?: string; fullName: string }>(collection(db, 'schools', school.id, 'teachers')))
    .map(t => ({ uid: t.uid || t.id, fullName: t.fullName || '' })).sort((a, b) => compare(a.fullName, b.fullName))
}
async function inputs(p: ReportCaller, f: ReportFilters, report: Report, signal?: AbortSignal): Promise<ReportData> {
  const { visible, ...data } = await context(p, f)
  const schools = await Promise.all(visible.map(async school => {
    const id = school.id, site = campusFilter(school, f.campus), range = dates(data.from, data.to)
    const need = (...kinds: Report[]) => kinds.includes(report)
    const [students, groups, teachers] = await Promise.all([
      need('export') || (f.campus && need('attendance')) ? rows<Student>(scoped('students', id, ...site)) : [],
      need('attendance', 'export') || (f.campus) ? rows<Group>(scoped('groups', id, ...site, orderBy(documentId()))) : [],
      directory(school)
    ])
    const memberPages = f.campus ? chunks(students.map(s => s.id), 10).map(ids => [where('studentId', 'in', ids)]) : [[]]
    const groupIds = groups.map(g => g.id)
    const attendance = need('attendance') ? (await Promise.all(memberPages.map(page => sessions(scoped('attendance', id, ...page), data.from, data.to, groupIds, signal)))).flat() :
      need('export') ? (await Promise.all(memberPages.map(page => rows<AttendanceMark>(scoped('attendance', id, ...range, ...page))))).flat() : []
    const evaluations = need('export') ? (await Promise.all(memberPages.map(page => rows<Evaluation>(scoped('evaluations', id, ...page))))).flat() : []
    const hours = need('export') ? await rows<HoursEntry>(scoped('hours', id, ...range)) : []
    return { school, students, groups, teachers: teachers.filter(t => !f.campus || groups.some(g => g.teacherId === t.uid)), attendance, evaluations, hours }
  }))
  return { ...data, schools }
}
function cached<T>(name: string, filters: object, read: (p: ReportCaller, signal: AbortSignal) => Promise<T>) {
  return api(async () => {
    const p: ReportCaller = { ...await caller() }
    if (p.rol === 'coordinador') p.visibleSchools = await reportSchools(p, 'schoolId' in filters && typeof filters.schoolId === 'string' ? filters.schoolId : undefined)
    const key = JSON.stringify([p.uid, p.rol, p.schoolIds, p.regions, p.visibleSchools?.map(s => s.id).sort(), colombiaToday(), name,
    Object.entries(filters).sort(([a], [b]) => compare(a, b))])
    return cachedResult(key, signal => read(p, signal), name !== 'export')
  })
}
export function refreshReports() { reportCache.clear() }
const percent = (n: number, total: number) => total ? Math.round(n * 1000 / total) / 10 : 0
function weeksIn(config: ReportData['config'], from: string, to: string) {
  const weeks = []
  for (let w = Math.max(1, weeksElapsed(config, from)); w <= weeksElapsed(config, to); w++) {
    const range = rangeOf(w, config)
    if (range.to >= from && range.from <= to) weeks.push({ week: w, from: range.from < from ? from : range.from, to: range.to > to ? to : range.to })
  }
  return weeks
}
export function getSummary(f: ReportFilters) {
  return cached('summary', f, async (p, signal) => {
    const { config, from, to, visible } = await context(p, f, 4)
    const teachers = new Set<string>(), weeks = weeksIn(config, from, to), weeksPresent = new Map<number, number>()
    let students = 0, campuses = 0, present = 0, absent = 0, hoursPlanned = 0, hoursWorked = 0
    const groupsBySubject = { lectura: 0, matematicas: 0 }
    await Promise.all(visible.map(async school => {
      const id = school.id, site = campusFilter(school, f.campus)
      let rosterRead: Promise<string[]> | undefined
      const rosterIds = () => rosterRead ??= studentIdsInOrder(school, f.campus)
      const pages = f.campus ? chunks(await rosterIds(), 30).map(ids => [where('studentId', 'in', ids)]) : [[]]
      const enrolledStudents = enrollment(scoped('students', id, ...site))
      const trend = mapBatches(weeks, 4, async w => {
        const count = f.campus
          ? (await mapBatches(await rosterIds(), 30, sid => total(scoped('attendance', id, equal('status', 'vino'),
            equal('studentId', sid), ...dates(w.from, w.to), limit(1))), signal)).filter(Boolean).length
          : await distinctPresent(id, w.from, w.to, rosterIds, enrolledStudents, signal)
        weeksPresent.set(w.week, (weeksPresent.get(w.week) ?? 0) + count)
      }, signal)
      const [counts, h, groupCounts, enrolled, directoryRows, groups] = await Promise.all([
        Promise.all(pages.map(page => attendanceTotals(scoped('attendance', id, ...page, ...dates(from, to))))),
        hoursTotal(scoped('hours', id, ...dates(from, to))),
        Promise.all(SUBJECTS.map(s => total(scoped('groups', id, ...site, equal('subject', s))))),
        enrolledStudents, directory(school),
        f.campus ? rows<Group>(scoped('groups', id, ...site)) : [], trend
      ])
      directoryRows.filter(t => !f.campus || groups.some(g => g.teacherId === t.uid)).forEach(t => teachers.add(t.uid))
      students += enrolled
      campuses += school.campuses.filter(c => !f.campus || c.id === f.campus || c.name === f.campus).length
      counts.forEach(c => { present += c.present; absent += c.absent })
      hoursPlanned += h.planned; hoursWorked += h.worked
      SUBJECTS.forEach((s, i) => { groupsBySubject[s] += groupCounts[i] })
    }))
    return {
      students, teachers: teachers.size, schools: visible.length, campuses, groupsBySubject, hoursPlanned, hoursWorked, attendanceRate: percent(present, present + absent),
      studentsOverTime: [...weeksPresent].filter(([, count]) => count > 0).sort(([a], [b]) => a - b).map(([week, count]) => ({ week, count })), range: { from, to }
    }
  })
}
export function getSubmissions(f: ReportFilters, week?: number) {
  return cached('submissions', { ...f, week }, async p => {
    const { visible, config } = await context(p, f)
    const n = week ?? Math.max(1, weeksElapsed(config, colombiaToday()))
    if (!Number.isSafeInteger(n) || n < 1 || n > Math.max(1, weeksElapsed(config, colombiaToday()))) fail(400, 'Selecciona una semana de implementación válida.')
    const { range } = submissionWindow(config, f, n)
    const { from, to } = range
    if (from > to) fail(400, 'El rango de fechas no coincide con la semana seleccionada.')
    const teachers = (await Promise.all(visible.map(async school => {
      const groups = f.campus ? await rows<Group>(scoped('groups', school.id, ...campusFilter(school, f.campus))) : []
      const roster = f.campus ? await rows<Student>(scoped('students', school.id, ...campusFilter(school, f.campus))) : []
      return Promise.all((await directory(school)).filter(t => !f.campus || groups.some(g => g.teacherId === t.uid)).map(async t => {
        const q = [equal('teacherId', t.uid), ...dates(from, to)]
        const pages = f.campus ? chunks(roster.map(s => s.id), 30).map(ids => [where('studentId', 'in', ids)]) : [[]]
        const [attendance, hours] = await Promise.all([Promise.all(pages.map(page => total(scoped('attendance', school.id, ...q, ...page, limit(1))))), total(scoped('hours', school.id, ...q, limit(1)))])
        return { ...t, schoolId: school.id, schoolName: school.name, attendanceSent: attendance.some(Boolean), hoursSent: hours > 0 }
      }))
    }))).flat()
    const distinct = (list: typeof teachers) => new Set(list.map(t => t.uid)).size
    return { week: n, range, teachers, total: distinct(teachers), attendanceSent: distinct(teachers.filter(t => t.attendanceSent)), hoursSent: distinct(teachers.filter(t => t.hoursSent)) }
  })
}
export function getLevels(f: ReportFilters, subject: Subject = 'lectura', moments: Moment[] = MOMENTS.slice(0, 4)) {
  return cached('levels', { ...f, subject, moments }, async p => {
    if (!SUBJECTS.includes(subject)) fail(400, 'Selecciona un área válida.')
    const selected = [...new Set((moments.length ? moments : MOMENTS.slice(0, 4)).filter(m => MOMENTS.includes(m)))]
    const { visible, from, to } = await context(p, f)
    const scale = LEVELS[subject], field = 'levels.' + subject + '.'
    function block() {
      const zero = (keys: string[]): Record<string, number> => Object.fromEntries(keys.map(k => [k, 0]))
      return { n: 0, counts: zero(selected), rezago: zero(selected), distribution: Object.fromEntries(selected.map(m => [m, zero(scale)])) }
    }
    const overall = block(), gender = { F: 0, M: 0 }, age: Record<string, number> = {}
    const bySchool = await Promise.all(visible.map(async school => {
      const local = block(), base = scoped('students', school.id, ...campusFilter(school, f.campus),
        where(field + 'date', '>=', from), where(field + 'date', '<=', to))
      await Promise.all(selected.map(async m => {
        const q = query(base, equal(field + 'moment', m))
        const n = await total(q)
        local.n += n; overall.n += n; local.counts[m] = n; overall.counts[m] += n
        if (!n) return
        await Promise.all(scale.map(async level => {
          const count = await total(query(q, equal(field + 'level', level)))
          local.distribution[m][level] = count
          overall.distribution[m][level] += count
        }))
        local.rezago[m] = percent(scale.slice(0, 3).reduce((n, l) => n + local.distribution[m][l], 0), n)
      }))
      if (local.n) {
        const cohort = query(base, where(field + 'moment', 'in', selected))
        await Promise.all((['F', 'M'] as const).map(async k => {
          const count = await total(query(cohort, equal('gender', k)))
          gender[k] += count
        }))
        await Promise.all(Array.from({ length: 14 }, async (_, i) => {
          const years = i + 5, count = await total(query(cohort, equal('age', years)))
          if (count) age[years] = (age[years] ?? 0) + count
        }))
      }
      return { schoolId: school.id, name: school.name, ...local }
    }))
    for (const m of selected) overall.rezago[m] = percent(scale.slice(0, 3).reduce((n, l) => n + overall.distribution[m][l], 0), overall.counts[m])
    return { subject, moments: selected, bySchool, overall, gender, age }
  })
}
export function getMovement(f: ReportFilters, subject: Subject, from: Moment = milestones[0], to: Moment = milestones[1]) {
  return cached('movement', { ...f, subject, firstMoment: from, lastMoment: to }, async (p, signal) => {
    const scope = await context(p, f)
    const schools = await Promise.all(scope.visible.map(async school => {
      const base = scoped('evaluations', school.id, equal('subject', subject), where('moment', 'in', [from, to]), ...dates(scope.from, scope.to))
      const pages = f.campus ? chunks(await studentIdsInOrder(school, f.campus), 15) : [undefined]
      return (await Promise.all(pages.map(async ids => {
        const q = ids ? query(base, where('studentId', 'in', ids)) : base
        if (await total(q) <= 150) return rows<Evaluation>(q)
        const ordered = query(q, where('studentId', '>=', ''), orderBy('studentId'), orderBy('moment'), orderBy('savedAt', 'desc'), orderBy('date'), limit(1))
        return distinctStudentRows<Evaluation>(ordered, ids ?? await studentIdsInOrder(school), e => [e.studentId, e.moment], signal)
      }))).flat()
    }))
    return [{ from, to, ...movement(schools.flat(), subject, from, to) }]
  })
}
export function getAttendanceReport(f: ReportFilters) { return cached('attendance', f, async (p, signal) => attendanceReport(await inputs(p, f, 'attendance', signal))) }
export function getHoursReport(f: ReportFilters) {
  return cached('hours', f, async p => {
    const data = await inputs(p, f, 'hours')
    // Actual senders include teachers no longer in the directory. Discover the
    // stored implementation weeks inside the window before requesting their sums.
    const schools = await Promise.all(data.schools.map(async s => {
      const entries = await rows<HoursEntry>(scoped('hours', s.school.id, ...dates(data.from, data.to)))
      const buckets = new Map<string, HoursEntry[]>()
      for (const entry of entries) {
        const week = entry.week ?? weekOf(entry.date, data.config)
        const key = JSON.stringify([entry.teacherId, week])
        const list = buckets.get(key) ?? []
        list.push(entry)
        buckets.set(key, list)
      }
      const hours = await Promise.all([...buckets.values()].map(async entries => {
        const first = entries[0]
        const days = [...new Set(entries.map(e => e.date))]
        const sums = await Promise.all(chunks(days, 30).map(page => hoursTotal(scoped('hours', s.school.id,
          equal('teacherId', first.teacherId), where('date', 'in', page)))))
        return { ...first, plannedHours: sums.reduce((n, v) => n + v.planned, 0), workedHours: sums.reduce((n, v) => n + v.worked, 0) }
      }))
      return { ...s, hours }
    }))
    const result = hoursReport({ ...data, schools })
    return result
  })
}
export function getExport(f: ReportFilters) { return cached('export', f, async p => exportReport(await inputs(p, f, 'export'))) }
export function getTeacherMetrics(uid: string) {
  return cached('metrics', { uid }, async p => {
    if (p.rol === 'docente' && uid !== p.uid) fail(403, 'No tienes permiso para consultar estos datos.')
    const schools = p.visibleSchools ?? await schoolsOf(p)
    let present = 0, recorded = 0
    const history: { label: string; date: string; pending: boolean }[] = []
    await Promise.all(schools.map(async s => {
      const groups = await rows<Group>(scoped('groups', s.id, equal('teacherId', uid)))
      const counts = await Promise.all(groups.flatMap(g => chunks([...new Set(g.studentIds)], 30).map(ids =>
        attendanceTotals(scoped('attendance', s.id, equal('groupId', g.id), where('studentId', 'in', ids))))))
      counts.forEach(c => { present += c.present; recorded += c.present + c.absent })
      const recent = [equal('teacherId', uid), orderBy('savedAt', 'desc'), limit(15)]
      const [a, e] = await Promise.all([rows<AttendanceMark>(scoped('attendance', s.id, ...recent)), rows<Evaluation>(scoped('evaluations', s.id, ...recent))])
      for (const m of a) history.push({ label: 'Asistencia · ' + (groups.find(g => g.id === m.groupId)?.name || m.groupId), date: m.date, pending: m.syncState === 'pending' })
      for (const m of e) history.push({ label: 'Evaluación · ' + subjectLabel(m.subject), date: m.date, pending: m.syncState === 'pending' })
    }))
    return { present, recorded, history: history.sort((a, b) => compare(b.date, a.date)).slice(0, 30) }
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

export function getComparison(f: ReportFilters, sites: boolean) {
  return cached('comparison', { ...f, sites }, async (p, signal) => {
    if (p.rol === 'docente') fail(403, 'Necesitas un perfil de gestión.')
    const { visible, from, to } = await context(p, f)
    return (await Promise.all(visible.map(async school => {
      const sitesToRead = sites ? school.campuses.filter(c => !f.campus || c.id === f.campus || c.name === f.campus) : [undefined]
      return Promise.all(sitesToRead.map(async campus => {
        const site = campusFilter(school, campus?.id)
        const [students, groups, enrolled, groupCount] = await Promise.all([rows<Student>(scoped('students', school.id, ...site)),
        campus ? rows<Group>(scoped('groups', school.id, ...site)) : [], enrollment(scoped('students', school.id, ...site)), total(scoped('groups', school.id, ...site))])
        const hits = await mapBatches(students, 30, s =>
          total(scoped('evaluations', school.id, equal('studentId', s.id), ...dates(from, to), limit(1))), signal)
        const evaluated = hits.filter(Boolean).length
        const pages = campus ? chunks(groups.map(g => g.id), 30).map(ids => [where('groupId', 'in', ids)]) : [[]]
        const counts = await Promise.all(pages.map(page => attendanceTotals(scoped('attendance', school.id, ...page, ...dates(from, to)))))
        const present = counts.reduce((n, c) => n + c.present, 0), absent = counts.reduce((n, c) => n + c.absent, 0)
        return {
          school, campus, students: enrolled, groups: groupCount, evaluated,
          attendance: present + absent ? 100 * present / (present + absent) : null
        }
      }))
    }))).flat()
  })
}

async function coverageEvents(school: School, groups: Group[], students: Student[], moment: Moment, from: string, to: string, signal: AbortSignal) {
  const result = new Set<string>(), active = new Set(students.filter(s => s.active !== false && !s.retired).map(s => s.id))
  const key = (g: Group, id: string) => JSON.stringify([g.teacherId, g.subject, id])
  await Promise.all(SUBJECTS.map(async subject => {
    const local = groups.filter(g => g.subject === subject), members = [...new Set(local.flatMap(g => g.studentIds))].filter(id => active.has(id))
    await mapBatches(chunks(members, 30), 4, async ids => {
      const base = scoped('evaluations', school.id, equal('subject', subject), equal('moment', moment), ...dates(from, to))
      const q = query(base, where('studentId', 'in', ids))
      const count = await total(q)
      if (!count) return
      if (count <= ids.length) {
        for (const e of await rows<Evaluation>(q)) for (const g of local) {
          if (g.studentIds.includes(e.studentId) && (!e.groupId || e.groupId === g.id)) result.add(key(g, e.studentId))
        }
      } else {
        // A heavily corrected moment can have thousands of events for a single student.
        await Promise.all(ids.map(async id => {
          const member = query(base, equal('studentId', id))
          const [first] = await rows<Evaluation>(query(member, limit(1)))
          if (!first) return
          let historical: Promise<boolean> | undefined
          await Promise.all(local.filter(g => g.studentIds.includes(id)).map(async g => {
            if (!first.groupId || first.groupId === g.id || await total(query(member, equal('groupId', g.id), limit(1)))) {
              result.add(key(g, id))
              return
            }
            // Older evaluations omit groupId and apply to every matching group.
            historical ??= Promise.all([total(member), total(query(member, orderBy('date'), orderBy('groupId')))])
              .then(([all, withGroup]) => all > withGroup)
            if (await historical) result.add(key(g, id))
          }))
        }))
      }
    }, signal)
  }))
  return result
}
export function getFollowup(f: ReportFilters, selected?: Moment, uid?: string) {
  return cached('followup', { ...f, selected, uid }, async (p, signal) => {
    if (p.rol === 'docente') fail(403, 'Necesitas un perfil de gestión.')
    const { visible, config, from, to } = await context(p, f)
    const directories = await Promise.all(visible.map(async school => {
      const site = campusFilter(school, f.campus)
      const [allGroups, students, directoryRows] = await Promise.all([
        rows<Group>(scoped('groups', school.id, ...site)),
        rows<Student>(scoped('students', school.id, ...site)), directory(school)
      ])
      const memberPages = f.campus ? chunks(students.map(s => s.id), 30).map(ids => [where('studentId', 'in', ids)]) : [[]]
      return { school, allGroups, students, directoryRows, memberPages }
    }))
    let moment = selected ?? milestones[0]
    if (!selected) for (const candidate of milestones.slice(1).reverse()) {
      const counts = await Promise.all(directories.flatMap(({ school, memberPages }) => memberPages.map(page =>
        total(scoped('evaluations', school.id, ...page, equal('moment', candidate), ...dates(from, to))))))
      if (counts.some(Boolean)) { moment = candidate; break }
    }
    const weeks = weeksIn(config, from, to)
    const teachers = (await Promise.all(directories.map(async ({ school, allGroups, students, directoryRows, memberPages }) => {
      const evaluated = await coverageEvents(school, allGroups, students, moment, from, to, signal)
      const active = new Set(students.filter(s => s.active !== false && !s.retired).map(s => s.id))
      return Promise.all(directoryRows.filter(t => (!uid || t.uid === uid) && (!f.campus || allGroups.some(g => g.teacherId === t.uid))).map(async t => {
        const groups = allGroups.filter(g => g.teacherId === t.uid), teacher = equal('teacherId', t.uid)
        const pages = f.campus ? chunks(allGroups.map(g => g.id), 30).map(ids => [where('groupId', 'in', ids)]) : [[]]
        const hits = await Promise.all(weeks.map(async w => (await Promise.all(pages.map(page => total(scoped('attendance', school.id, teacher, ...page, ...dates(w.from, w.to), limit(1)))))).some(Boolean)))
        const h = await hoursTotal(scoped('hours', school.id, teacher, ...dates(from, to)))
        const recent = (path: string, extra: ReturnType<typeof equal>[]) => rows<{ savedAt: string }>(scoped(path, school.id, teacher, ...extra, ...dates(from, to),
          where('savedAt', '>=', ''), orderBy('savedAt', 'desc'), orderBy('date'), limit(1)))
        const last = (await Promise.all([recent('hours', []), ...pages.map(page => recent('attendance', page)), ...memberPages.map(page => recent('evaluations', page))]))
          .flat().map(r => r.savedAt).sort().at(-1) || ''
        const members = new Set(groups.flatMap(g => g.studentIds.filter(id => active.has(id)).map(id => JSON.stringify([t.uid, g.subject, id]))))
        const measured = [...members].filter(k => evaluated.has(k)).length, sent = hits.filter(Boolean).length
        return {
          ...t, school, groups, last, weeks: sent, expected: weeks.length, attendanceRate: weeks.length ? 100 * sent / weeks.length : null,
          ...h, evaluated: measured, members: members.size, coverage: members.size ? 100 * measured / members.size : null
        }
      }))
    }))).flat()
    return { from, to, moment, teachers }
  })
}

export function getGroupRoster(group: Group, f: ReportFilters, moment?: Moment) {
  return cached('group-roster', { ...f, group: group.id, members: group.studentIds, subject: group.subject, moment }, async p => {
    const { from, to } = await context(p, { ...f, schoolId: group.schoolId })
    const pages = chunks([...new Set(group.studentIds)], 30)
    const roster = (await Promise.all(pages.map(ids => rows<Student>(scoped('students', group.schoolId, where(documentId(), 'in', ids)))))).flat()
    return Promise.all(roster.map(async student => {
      const base = [equal('studentId', student.id), ...dates(from, to)]
      const [counts, events] = await Promise.all([
        attendanceTotals(scoped('attendance', group.schoolId, equal('groupId', group.id), ...base)),
        moment ? rows<Evaluation>(scoped('evaluations', group.schoolId, ...base, equal('subject', group.subject), equal('moment', moment))) : []
      ])
      const level = events.filter(e => !e.groupId || e.groupId === group.id).sort((a, b) => compare(b.savedAt, a.savedAt)).at(0)?.level
      const recorded = counts.present + counts.absent
      return { student, rate: recorded ? 100 * counts.present / recorded : null, level }
    }))
  })
}

export function getStudentReport(schoolId: string, id: string, f: ReportFilters) {
  return cached('student', { ...f, schoolId, id }, async p => {
    const { from, to } = await context(p, { ...f, schoolId })
    const [student] = await rows<Student>(scoped('students', schoolId, where(documentId(), '==', id)))
    if (!student) fail(404, 'El estudiante no está en esta institución. Revisa la selección.')
    const criteria = [equal('studentId', id), ...dates(from, to)]
    const [attendance, evaluations] = await Promise.all([
      rows<AttendanceMark>(scoped('attendance', schoolId, ...criteria)), rows<Evaluation>(scoped('evaluations', schoolId, ...criteria))])
    const newest = (a: { date: string; savedAt: string }, b: { date: string; savedAt: string }) => compare(b.date, a.date) || compare(b.savedAt, a.savedAt)
    return { student, attendance: attendance.sort(newest), evaluations: evaluations.sort(newest) }
  })
}

/** Older teacher submissions remain accessible without downloading the semester on entry. */
export function getTeacherDay(uid: string, date: string) {
  return cached('teacher-day', { uid, date }, async p => {
    requireDate(date)
    if (p.rol === 'docente' && p.uid !== uid) fail(403, 'No tienes permiso para consultar estos datos.')
    const schools = p.visibleSchools ?? await schoolsOf(p)
    const result = await Promise.all(schools.map(async school => {
      const scope = [equal('teacherId', uid), equal('date', date)]
      const [marks, events] = await Promise.all([
        rows<AttendanceMark>(scoped('attendance', school.id, ...scope)),
        rows<Evaluation>(scoped('evaluations', school.id, ...scope))])
      return [
        ...marks.map(r => ({ key: JSON.stringify([school.id, r.studentId, r.id, 'a']), label: 'Asistencia · ' + r.groupId, pending: r.syncState === 'pending', school: school.name })),
        ...events.map(r => ({ key: JSON.stringify([school.id, r.studentId, r.id, 'e']), label: 'Evaluación · ' + subjectLabel(r.subject), pending: r.syncState === 'pending', school: school.name }))
      ]
    }))
    return result.flat()
  })
}

export function getDataQuality() {
  return cached('quality', {}, async p => {
    if (p.rol !== 'admin') fail(403, 'Solo administración puede revisar los directorios.')
    const [students, groups, users, schools] = await Promise.all([
      rows<Student>(collection(db, 'students')), rows<Group>(collection(db, 'groups')),
      rows<UserProfile>(collection(db, 'users')), schoolsOf(p)])
    return qualityIssues(students, groups, users.map(u => ({ ...u, uid: u.id })), schools)
  })
}
