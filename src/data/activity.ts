import type { AttendanceMark, Evaluation, Group, HoursEntry, School, Student } from '../domain/types'
import { compare } from './core'
import type { SchoolData } from './reportMath'

export function activityFeed(schools: SchoolData[]) {
  type Event = { key: string; kind: string; author: string; school: string; savedAt: string; detail: string }
  const events = new Map<string, Event>()
  for (const s of schools) {
    const teachers = new Map(s.teachers.map(t => [t.uid, t.fullName]))
    const groups = new Map(s.groups.map(g => [g.id, g]))
    const students = new Map(s.students.map(v => [v.id, v.fullName]))
    function add(key: string[], kind: string, record: AttendanceMark | Evaluation | HoursEntry, detail: string) {
      if (!record.savedAt || !Number.isFinite(Date.parse(record.savedAt))) return
      const id = JSON.stringify([s.school.id, kind, ...key])
      const prior = events.get(id)
      if (prior && Date.parse(prior.savedAt) >= Date.parse(record.savedAt)) return
      events.set(id, { key: id, kind, author: teachers.get(record.teacherId) || record.teacherId, school: s.school.name, savedAt: record.savedAt, detail })
    }
    for (const m of s.attendance) add([m.groupId, m.date, m.teacherId], 'Asistencia', m, groups.get(m.groupId)?.name || m.groupId)
    for (const e of s.evaluations) add([e.studentId, e.id], 'Evaluación', e, students.get(e.studentId) || e.studentId)
    for (const h of s.hours) add([h.teacherId, h.date], 'Horas', h, h.date)
  }
  return [...events.values()].sort((a, b) => Date.parse(b.savedAt) - Date.parse(a.savedAt) || compare(a.key, b.key)).slice(0, 12)
}

export function campusId(s: School, value: string) {
  return s.campuses.find(c => c.id === value || c.name === value)?.id ?? value
}
export function inGroup(e: Evaluation, g: Group) {
  return e.subject === g.subject && (e.groupId ? e.groupId === g.id : g.studentIds.includes(e.studentId))
}
export const enrolled = (s: Student) => !s.retired && s.active !== false
