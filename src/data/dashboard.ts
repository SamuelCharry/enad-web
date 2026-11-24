import { cachedResult } from './reportCache'
import { collection, collectionGroup, documentId, getDocsFromCache, limit, orderBy, query, where } from 'firebase/firestore'
import { LEVELS, SUBJECTS } from '../domain/levels'
import type { AttendanceMark, Evaluation, Group, HoursEntry, Moment, ProgramConfig, School, Student, Subject, UserProfile } from '../domain/types'
import { rangeOf, weekOf } from '../domain/weeks'
import { chunks, recordOf } from './core'
import { db } from './firebase'
import { attendanceTotals, enrollment, dates, equal, hoursTotal, rows, scoped, total } from './reads'
import { activityFeed, campusId } from './activity'
import { alertThreshold, latestLevels, milestones, ratio } from './managementMetrics'

type Alert = { category: string; label: string; path: string; count: number; subject?: Subject; schoolId: string }
const mids: Moment[] = ['linea_media_1', 'linea_media_2']
function beginners(schoolId: string, subject: Subject, moment: Moment) {
  const moments = mids.filter(m => milestones.indexOf(m) <= milestones.indexOf(moment))
  return moments.length ? scoped('students', schoolId, equal('active', true), equal('retired', false),
    equal('levels.' + subject + '.level', 'principiante'), where('levels.' + subject + '.moment', 'in', moments)) : undefined
}
export async function beginnerList(schoolId: string, subject: Subject, moment: Moment) {
  const q = beginners(schoolId, subject, moment)
  return q ? rows<Student>(q) : []
}
// A decline compares two documents. Load that historical join only on request.
export async function decliningStudents(schoolId: string, subject: Subject, moment: Moment, from: string, to: string) {
  const eligible = milestones.slice(0, milestones.indexOf(moment) + 1)
  if (eligible.length < 2) return []
  const [students, events] = await Promise.all([
    rows<Student>(scoped('students', schoolId, equal('active', true), equal('retired', false))),
    rows<Evaluation>(scoped('evaluations', schoolId, equal('subject', subject), where('moment', 'in', eligible), ...dates(from, to)))
  ])
  const history = latestLevels(events, subject)
  return students.filter(s => {
    const marks = eligible.flatMap(m => history.get(s.id)?.get(m) ?? [])
    return marks.length > 1 && LEVELS[subject].indexOf(marks.at(-1)!.level) < LEVELS[subject].indexOf(marks.at(-2)!.level)
  })
}
async function feedNames(schoolId: string, ids: string[]) {
  const q = scoped('students', schoolId, where(documentId(), 'in', ids))
  // These labels decorate events already authorized by the server. A partial
  // local query can never establish a roster, an absence, or a KPI.
  const cached = await getDocsFromCache(q)
  if (cached.docs.length === ids.length) return cached.docs.map(d => recordOf<Student>(d))
  return rows<Student>(q)
}
async function recent<T>(path: string, ids: string[]) {
  const source = path === 'hours' ? collection(db, path) : collectionGroup(db, path)
  const pages = await Promise.all(chunks(ids, 10).map(page => rows<T>(query(source, where('schoolId', 'in', page), orderBy('savedAt', 'desc'), limit(15)))))
  return pages.flat()
}
async function missingGroup(g: Group, moment: Moment, from: string, to: string) {
  const base = scoped('evaluations', g.schoolId, equal('subject', g.subject), equal('moment', moment), ...dates(from, to))
  if (await total(query(base, equal('groupId', g.id)))) return false
  // Historical imports omit groupId. Subtract records that have that field.
  for (const ids of chunks([...new Set(g.studentIds)], 30)) {
    const members = query(base, where('studentId', 'in', ids))
    const all = await total(members)
    if (all && all > await total(query(members, orderBy('date'), orderBy('groupId')))) return false
  }
  return true
}
async function dashboard(schools: School[], cfg: ProgramConfig | null, today: string, selected?: Moment) {
  const ids = schools.map(s => s.id)
  const [marks, evaluations, hours, directories] = await Promise.all([
    recent<AttendanceMark>('attendance', ids), recent<Evaluation>('evaluations', ids), recent<HoursEntry>('hours', ids),
    Promise.all(schools.map(async school => {
      const [teachers, groups, active] = await Promise.all([
        rows<{ uid: string; fullName: string }>(collection(db, 'schools', school.id, 'teachers')),
        rows<Group>(scoped('groups', school.id)), enrollment(scoped('students', school.id))
      ])
      return { school, teachers: teachers.map(t => ({ ...t, uid: t.uid || t.id })), groups, active }
    }))
  ])
  const students = (await Promise.all(chunks([...new Set(evaluations.map(e => e.studentId))], 30).flatMap(page =>
    schools.flatMap(s => {
      const ids = page.filter(id => evaluations.some(e => e.studentId === id && e.schoolId === s.id))
      return ids.length ? [feedNames(s.id, ids)] : []
    })))).flat()
  const feed = activityFeed(directories.map(d => ({
    ...d, students,
    attendance: marks.filter(r => r.schoolId === d.school.id), evaluations: evaluations.filter(r => r.schoolId === d.school.id), hours: hours.filter(r => r.schoolId === d.school.id)
  })))
  let moment = selected ?? milestones[0]
  if (!selected && cfg && cfg.implementationStartDate <= today && ids.length) {
    for (const m of milestones.slice(1).reverse()) {
      const counts = await Promise.all(ids.map(id => total(scoped('evaluations', id, equal('moment', m), ...dates(cfg.implementationStartDate, today)))))
      if (counts.some(Boolean)) { moment = m; break }
    }
  }
  const reporters = new Set<string>()
  let worked = 0, planned = 0
  const totals = [{present:0,absent:0},{present:0,absent:0}]
  const day = new Date(today + 'T12:00:00Z')
  const offset = (day.getUTCDay()+6)%7
  const relative = (delta:number) => new Date(day.getTime()+delta*86400000).toISOString().slice(0,10)
  await Promise.all(ids.flatMap(id => totals.map(async (sum,i) => {
    const range = dates(relative(-offset-7*i),relative(-7*i))
    const n = await attendanceTotals(scoped('attendance',id,...range))
    sum.present += n.present
    sum.absent += n.absent
  })))
  const alerts = (await Promise.all(directories.map(async ({ school, groups, teachers }) => {
    const list: Alert[] = [], schoolId = school.id
    function add(category: string, label: string, route: string, params: Record<string, string>, count = 1, subject?: Subject) {
      list.push({ category, label, path: '/portal/reportes/' + route + '?' + new URLSearchParams({ schoolId, ...params }), count, schoolId, subject })
    }
    for (const g of groups) if (!g.teacherId) list.push({category:'Grupos sin docente',label:g.name,path:'/portal/grupos?buscar='+encodeURIComponent(g.name),count:1,schoolId})
    const hours = await hoursTotal(scoped('hours',schoolId,...dates(relative(-offset),today)))
    worked += hours.worked
    planned += hours.planned
    if (!cfg || today < cfg.implementationStartDate) return list
    const week = weekOf(today, cfg)
    if (week) {
      const from = rangeOf(week, cfg).from
      await Promise.all(teachers.map(async t => {
        const filters = [equal('teacherId', t.uid), ...dates(from, today)]
        const [sent, h] = await Promise.all([total(scoped('attendance', schoolId, ...filters)), hoursTotal(scoped('hours', schoolId, ...filters))])
        if (sent) reporters.add(t.uid)
        if (!sent) add('Sin asistencia esta semana', t.fullName, 'seguimiento', { week: String(week), teacher: t.uid })
        if ((ratio(h.worked, h.planned) ?? 100) < alertThreshold) add('Horas por debajo del 80 %', t.fullName, 'docentes', { teacher: t.uid, from, to: today })
      }))
      await Promise.all(school.campuses.map(async c => {
        const ids = groups.filter(g => campusId(school, g.campus) === c.id).map(g => g.id)
        const counts = await Promise.all(chunks(ids, 30).map(page => attendanceTotals(scoped('attendance', schoolId, where('groupId', 'in', page), ...dates(from, today)))))
        const present = counts.reduce((n, v) => n + v.present, 0), absent = counts.reduce((n, v) => n + v.absent, 0)
        if ((ratio(present, present + absent) ?? 100) < alertThreshold) add('Asistencia por debajo del 80 %', c.name, 'comparacion', { campus: c.id, from, to: today })
      }))
    }
    await Promise.all(groups.map(async g => {
      if (await missingGroup(g, moment, cfg.implementationStartDate, today)) add('Grupos sin evaluación', g.name, 'instituciones', { campus: campusId(school, g.campus), group: g.id, moment, from: cfg.implementationStartDate, to: today })
    }))
    await Promise.all(SUBJECTS.map(async subject => {
      const q = beginners(schoolId, subject, moment), count = q ? await total(q) : 0
      if (count) add('Principiante en línea media', school.name, 'estudiante', {}, count, subject)
    }))
    return list
  }))).flat().sort((a, b) => a.category.localeCompare(b.category, 'es') || a.label.localeCompare(b.label, 'es'))
  const insights = {attendance:totals.map(n => ratio(n.present,n.present+n.absent)),worked,planned,reporters:reporters.size}
  return { insights, feed, alerts, moment, students: directories.reduce((n, d) => n + d.active, 0), teachers: new Set(directories.flatMap(d => d.teachers.map(t => t.uid))).size }
}

export function readDashboard(profile: UserProfile, schools: School[], config: ProgramConfig | null, today: string, selected?: Moment) {
  const key = JSON.stringify([profile.uid, profile.rol, 'dashboard', schools, config, today, selected])
  return cachedResult(key, () => dashboard(schools, config, today, selected))
}
