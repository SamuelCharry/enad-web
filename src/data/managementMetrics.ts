import { LEVELS, MOMENTS } from '../domain/levels'
import { rangeOf, weekOf, weeksElapsed } from '../domain/weeks'
import type { Evaluation, Moment, ProgramConfig, Subject } from '../domain/types'
import type { SchoolData } from './reportMath'
import { campusId, enrolled, inGroup } from './activity'

export const milestones: Moment[] = MOMENTS.filter(m => m !== 'verificacion')
export const alertThreshold = 80
export const ratio = (n: number, total: number) => total > 0 ? n * 100 / total : null
export function latestLevels(events: Evaluation[], subject: Subject) {
  const marks = new Map<string, Map<Moment, Evaluation>>()
  for (const e of events) {
    if (e.subject !== subject || !LEVELS[subject].includes(e.level) || !milestones.includes(e.moment)) continue
    const history = marks.get(e.studentId) ?? new Map<Moment, Evaluation>()
    const prior = history.get(e.moment)
    if (!prior || e.savedAt > prior.savedAt || (e.savedAt === prior.savedAt && e.id > prior.id)) history.set(e.moment, e)
    marks.set(e.studentId, history)
  }
  return marks
}
export function movement(events: Evaluation[], subject: Subject, from: Moment, to: Moment) {
  let up = 0, stable = 0, down = 0
  for (const history of latestLevels(events, subject).values()) {
    const first = history.get(from), last = history.get(to)
    if (!first || !last) continue
    const diff = LEVELS[subject].indexOf(last.level) - LEVELS[subject].indexOf(first.level)
    if (diff > 0) up++
    else if (diff < 0) down++
    else stable++
  }
  return { up, stable, down, total: up + stable + down }
}
export function observedMoment(schools: SchoolData[], from: string, to: string) {
  let index = 0
  for (const s of schools) for (const e of s.evaluations) {
    if (e.date >= from && e.date <= to) index = Math.max(index, milestones.indexOf(e.moment))
  }
  return milestones[index]
}
export function teacherFollowup(s: SchoolData, cfg: ProgramConfig, from: string, to: string, moment: Moment) {
  const inside = (r: { date: string }) => r.date >= from && r.date <= to
  const here = new Set(s.students.filter(enrolled).map(v => v.id))
  const endWeek = weeksElapsed(cfg, to), startWeek = weeksElapsed(cfg, from)
  const expected = Math.max(0, endWeek - startWeek + (weekOf(from, cfg) ? 1 : 0))
  const evaluations = s.evaluations.filter(inside)
  const marks = s.attendance.filter(inside), hours = s.hours.filter(inside)
  const weekCache = new Map<string, number | null>()
  return s.teachers.map(t => {
    const groups = s.groups.filter(g => g.teacherId === t.uid)
    const attendance = marks.filter(m => m.teacherId === t.uid)
    const weeks = new Set<number>()
    for (const m of attendance) {
      if (!weekCache.has(m.date)) weekCache.set(m.date, weekOf(m.date, cfg))
      const week = weekCache.get(m.date)
      if (week) weeks.add(week)
    }
    const planned = new Set<string>(), measured = new Set<string>()
    for (const g of groups) {
      for (const id of g.studentIds) if (here.has(id)) planned.add(JSON.stringify([id, g.subject]))
      for (const e of evaluations) if (e.moment === moment && inGroup(e, g) && here.has(e.studentId) && g.studentIds.includes(e.studentId)) {
        measured.add(JSON.stringify([e.studentId, e.subject]))
      }
    }
    const log = hours.filter(h => h.teacherId === t.uid)
    const activity = [...attendance, ...log, ...evaluations.filter(e => e.teacherId === t.uid)]
    const last = activity.reduce((v, e) => e.savedAt && (!v || Date.parse(e.savedAt) > Date.parse(v)) ? e.savedAt : v, '')
    return {
      ...t, school: s.school, groups, last, weeks: weeks.size, expected, attendanceRate: ratio(weeks.size, expected),
      worked: log.reduce((n, h) => n + h.workedHours, 0), planned: log.reduce((n, h) => n + h.plannedHours, 0),
      evaluated: measured.size, members: planned.size, coverage: ratio(measured.size, planned.size)
    }
  })
}
export function comparison(s: SchoolData, campus?: string) {
  const students = s.students.filter(v => campus === undefined || campusId(s.school, v.campus) === campus)
  const ids = new Set(students.map(v => v.id))
  const groups = new Set(s.groups.filter(g => campus === undefined || campusId(s.school, g.campus) === campus).map(g => g.id))
  const marks = s.attendance.filter(m => (campus === undefined || groups.has(m.groupId)) && (m.status === 'vino' || m.status === 'no_vino'))
  const tested = new Set(s.evaluations.filter(e => ids.has(e.studentId)).map(e => e.studentId))
  return {
    students: students.filter(enrolled).length, groups: groups.size, evaluated: tested.size,
    attendance: ratio(marks.filter(m => m.status === 'vino').length, marks.length)
  }
}
export function dashboardAlerts(schools: SchoolData[], cfg: ProgramConfig, today: string, moment: Moment) {
  type Alert = { category: string; label: string; path: string }
  const alerts: Alert[] = []
  if (today < cfg.implementationStartDate) return alerts
  const week = weekOf(today, cfg)
  const from = week ? rangeOf(week, cfg).from : ''
  for (const s of schools) {
    const schoolId = s.school.id
    function add(category: string, label: string, route: string, params: Record<string, string>) {
      alerts.push({ category, label, path: '/visualizacion/' + route + '?' + new URLSearchParams({ schoolId, ...params }) })
    }
    const period = s.evaluations.filter(e => e.date >= cfg.implementationStartDate && e.date <= today)
    if (week) {
      const recent = s.attendance.filter(e => e.date >= from && e.date <= today)
      const senders = new Set(recent.map(m => m.teacherId))
      for (const t of s.teachers) {
        if (!senders.has(t.uid)) add('Sin asistencia esta semana', t.fullName, 'seguimiento', { week: String(week), teacher: t.uid })
        const hours = s.hours.filter(h => h.teacherId === t.uid && h.date >= from && h.date <= today)
        const rate = ratio(hours.reduce((n, h) => n + h.workedHours, 0), hours.reduce((n, h) => n + h.plannedHours, 0))
        if (rate !== null && rate < alertThreshold) add('Horas por debajo del ' + alertThreshold + ' %', t.fullName, 'docentes', { teacher: t.uid, from, to: today })
      }
      for (const c of s.school.campuses) {
        const { attendance } = comparison({ ...s, attendance: recent }, c.id)
        if (attendance !== null && attendance < alertThreshold) add('Asistencia por debajo del ' + alertThreshold + ' %', c.name, 'comparacion', { campus: c.id, from, to: today })
      }
    }
    for (const g of s.groups) if (!period.some(e => e.moment === moment && inGroup(e, g))) {
      add('Grupos sin evaluación', g.name, 'instituciones', { campus: campusId(s.school, g.campus), group: g.id, moment, from: cfg.implementationStartDate, to: today })
    }
    for (const subject of ['lectura', 'matematicas'] as const) {
      const students = new Map(s.students.filter(enrolled).map(v => [v.id, v]))
      for (const [id, history] of latestLevels(period, subject)) {
        const marks = milestones.slice(0, milestones.indexOf(moment) + 1).flatMap(m => history.get(m) ?? [])
        const current = marks.at(-1), previous = marks.at(-2), student = students.get(id)
        if (!current || !student) continue
        const scale = LEVELS[subject]
        const dropped = previous && scale.indexOf(previous.level) > scale.indexOf(current.level)
        const low = current.moment.startsWith('linea_media') && current.level === scale[0]
        if (dropped || low) add(dropped ? 'Descenso de nivel' : 'Principiante en línea media', student.fullName + ' · ' + subject, 'estudiante', { student: id, subject })
      }
    }
  }
  return alerts
}
