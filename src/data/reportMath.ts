import { LEVELS, MOMENTS, SUBJECTS } from '../domain/levels'
import { rangeOf, weekOf } from '../domain/weeks'
import type { AttendanceMark, Evaluation, Group, HoursEntry, Moment, ProgramConfig, School, Student, Subject } from '../domain/types'

/** One school's already scoped inputs for report calculations. */
export interface SchoolData {
  school: School;
  students: Student[];
  groups: Group[];
  teachers: { uid: string; fullName: string }[]
  attendance: (AttendanceMark & { present?: number; absent?: number })[];
  hours: HoursEntry[];
  evaluations: Evaluation[]
}
/** Shared report range and explicit evaluation-date filter indicator. */
export interface ReportData {
  schools: SchoolData[];
  config: ProgramConfig;
  from: string;
  to: string;
  campus?: string;
  dateFiltered: boolean
}
const pct = (part: number, total: number) => total ? Math.round(part * 1000 / total) / 10 : 0
const cmp = (a: string, b: string) => a < b ? -1 : Number(a > b)
const amount = (v: unknown) => Number(String(v ?? '').replace(',', '.')) || 0
function implWeek(date: string, config: ProgramConfig) {
  if (!/^\d{4}-\d{2}-\d{2}/.test(date) || !Number.isFinite(Date.parse(date))) return null
  return weekOf(date, config)
}
function grouped<K, T>(rows: T[], key: (r: T) => K) {
  const map = new Map<K, T[]>()
  for (const row of rows) {
    const k = key(row), bucket = map.get(k)
    if (bucket) bucket.push(row)
    else map.set(k, [row])
  }
  return map
}
function counted(marks: SchoolData['attendance']) {
  let present = 0, absent = 0
  for (const m of marks) {
    present += m.present ?? Number(m.status === 'vino')
    absent += m.absent ?? Number(m.status === 'no_vino')
  }
  return { present, absent, rate: pct(present, present + absent) }
}
/** Summary counts distinct teachers and students present in each implementation week. */
export function summary(data: ReportData) {
  const teachers = new Set<string>(), weeks = new Map<number, Set<string>>()
  const groupsBySubject = { lectura: 0, matematicas: 0 }
  let students = 0, campuses = 0, hoursPlanned = 0, hoursWorked = 0, present = 0, absent = 0
  for (const s of data.schools) {
    students += s.students.filter(r => !r.retired && r.active !== false).length
    campuses += (s.school.campuses ?? []).filter(c => !data.campus || c.id === data.campus || c.name === data.campus).length
    s.teachers.forEach(t => teachers.add(t.uid))
    for (const g of s.groups) if (SUBJECTS.includes(g.subject)) groupsBySubject[g.subject]++
    for (const h of s.hours) {
      hoursPlanned += amount(h.plannedHours);
      hoursWorked += amount(h.workedHours)
    }
    const counts = counted(s.attendance)
    present += counts.present
    absent += counts.absent
    for (const m of s.attendance) {
      if (m.status !== 'vino') continue
      const week = implWeek(m.date, data.config)
      if (week !== null) {
        const ids = weeks.get(week) ?? new Set<string>()
        ids.add(m.studentId)
        weeks.set(week, ids)
      }
    }
  }
  return {
    students,
    teachers: teachers.size,
    schools: data.schools.length,
    campuses,
    groupsBySubject,
    hoursPlanned,
    hoursWorked,
    attendanceRate: pct(present, present + absent),
    studentsOverTime: [...weeks].sort(([a], [b]) => a - b).map(([week, ids]) => ({ week, count: ids.size })),
    range: { from: data.from, to: data.to }
  }
}
/** Weekly submissions by school assignment, with distinct-UID totals. */
export function submissions(data: ReportData, week: number) {
  const range = rangeOf(week, data.config)
  const inside = (r: { date: string }) => r.date >= range.from && r.date <= range.to
  const teachers = data.schools.flatMap(s => {
    const attendance = new Set(s.attendance.filter(inside).map(m => m.teacherId))
    const hours = new Set(s.hours.filter(inside).map(h => h.teacherId))
    return s.teachers.map(t => ({
      uid: t.uid, fullName: t.fullName, schoolId: s.school.id, schoolName: s.school.name,
      attendanceSent: attendance.has(t.uid), hoursSent: hours.has(t.uid)
    }))
  })
  const unique = (rows: typeof teachers) => new Set(rows.map(t => t.uid)).size
  return {
    week,
    range,
    teachers,
    attendanceSent: unique(teachers.filter(t => t.attendanceSent)),
    hoursSent: unique(teachers.filter(t => t.hoursSent)),
    total: unique(teachers)
  }
}
function latest(rows: Evaluation[], subject: Subject, moments: Moment[], range?: { from: string; to: string }) {
  const map = new Map<string, Map<Moment, Evaluation>>()
  for (const e of rows) {
    if (e.subject !== subject || !moments.includes(e.moment) || (range && (e.date < range.from || e.date > range.to))) continue
    const marks = map.get(e.studentId) ?? new Map<Moment, Evaluation>()
    if ((marks.get(e.moment)?.savedAt ?? '') <= e.savedAt) marks.set(e.moment, e)
    map.set(e.studentId, marks)
  }
  return map
}
const zeroCounts = (keys: string[]): Record<string, number> => Object.fromEntries(keys.map(k => [k, 0]))
/** Counts the latest evaluation per student and moment, including rezago in the first three levels. */
export function levels(data: ReportData, subject: Subject, moments: Moment[] = MOMENTS.slice(0, 4)) {
  const order = LEVELS[subject]
  function block() {
    return {
      n: 0, rezago: zeroCounts(moments), counts: zeroCounts(moments),
      distribution: Object.fromEntries(moments.map(m => [m, zeroCounts(order)]))
    }
  }
  function add(b: ReturnType<typeof block>, marks: Map<Moment, { level: string }>) {
    b.n++
    for (const [m, e] of marks) {
      if (order.includes(e.level)) b.distribution[m][e.level]++
      b.counts[m]++
    }
  }
  function finish(b: ReturnType<typeof block>) {
    for (const m of moments) b.rezago[m] = pct(order.slice(0, 3).reduce((n, l) => n + b.distribution[m][l], 0), b.counts[m])
    return b
  }
  const overall = block(), gender = { F: 0, M: 0 }, age: Record<string, number> = {}
  const bySchool = data.schools.map(s => {
    const b = block(), students = new Map(s.students.map(r => [r.id, r]))
    for (const [sid, marks] of latest(s.evaluations, subject, moments, data.dateFiltered ? data : undefined)) {
      add(b, marks)
      add(overall, marks)
      const student = students.get(sid)
      if (student?.gender === 'F' || student?.gender === 'M') gender[student.gender]++
      if (student?.age != null) age[student.age] = (age[student.age] ?? 0) + 1
    }
    return { schoolId: s.school.id, name: s.school.name, ...finish(b) }
  })
  return { subject, moments, bySchool, overall: finish(overall), gender, age }
}
/** Attendance rates and distinct sessions by institution, group and teacher. */
export function attendanceReport(data: ReportData) {
  const names = new Map<string, string>()
  const sessions = (rows: AttendanceMark[]) => new Set(rows.map(m => m.groupId + '_' + m.date)).size
  const bySchool = data.schools.map(s => ({ schoolId: s.school.id, name: s.school.name, ...counted(s.attendance), sessions: sessions(s.attendance) }))
  const byGroup = data.schools.flatMap(s => {
    s.teachers.forEach(t => names.set(t.uid, t.fullName))
    const groups = new Map(s.groups.map(g => [g.id, g]))
    return [...grouped(s.attendance, m => m.groupId)].map(([groupId, rows]) => {
      const g = groups.get(groupId)
      if (g && !names.has(g.teacherId)) names.set(g.teacherId, g.teacherName)
      return {
        groupId,
        name: g?.name ?? 'Grupo eliminado',
        subject: g?.subject ?? '',
        schoolId: s.school.id,
        teacherId: g?.teacherId ?? '',
        teacherName: g?.teacherName ?? '',
        rate: counted(rows).rate,
        sessions: sessions(rows)
      }
    })
  }).sort((a, b) => cmp(a.name, b.name))
  const byTeacher = [...grouped(data.schools.flatMap(s => s.attendance), m => m.teacherId)].map(([uid, rows]) =>
    ({ uid, fullName: names.get(uid) ?? '', rate: counted(rows).rate, sessions: sessions(rows) })).sort((a, b) => cmp(a.fullName, b.fullName))
  return { bySchool, byGroup, byTeacher }
}
type Weeks = Map<number, { week: number; planned: number; worked: number }>
const weekly = (w: Weeks) => [...w.values()].sort((a, b) => a.week - b.week)
function addHours(weeks: Weeks, week: number, h: HoursEntry) {
  const entry = weeks.get(week) ?? { week, planned: 0, worked: 0 }
  entry.planned += amount(h.plannedHours)
  entry.worked += amount(h.workedHours)
  weeks.set(week, entry)
}
/** Aggregates weekly and cumulative hours, retaining teachers with no submissions. */
export function hoursReport(data: ReportData) {
  const teachers = new Map<string, { fullName: string; schoolIds: Set<string>; weeks: Weeks }>()
  function teacher(uid: string, id: string) {
    const t = teachers.get(uid) ?? { fullName: '', schoolIds: new Set<string>(), weeks: new Map() }
    t.schoolIds.add(id)
    teachers.set(uid, t)
    return t
  }
  const bySchool = data.schools.map(s => {
    const id = s.school.id, weeks: Weeks = new Map()
    let planned = 0, worked = 0
    for (const t of s.teachers) teacher(t.uid, id).fullName = t.fullName
    for (const h of s.hours) {
      planned += amount(h.plannedHours)
      worked += amount(h.workedHours)
      const week = h.week ?? implWeek(h.date, data.config)
      if (week == null) continue
      addHours(weeks, Number(week), h)
      addHours(teacher(h.teacherId, id).weeks, Number(week), h)
    }
    return { schoolId: id, name: s.school.name, planned, worked, weekly: weekly(weeks) }
  })
  const byTeacher = [...teachers].map(([uid, t]) => {
    const rows = weekly(t.weeks), planned = rows.reduce((n, w) => n + w.planned, 0), worked = rows.reduce((n, w) => n + w.worked, 0)
    return {
      uid,
      fullName: t.fullName,
      schoolIds: [...t.schoolIds],
      weekly: rows,
      cumulative: { planned, worked, rate: pct(worked, planned) }
    }
  }).sort((a, b) => cmp(a.fullName, b.fullName))
  return { byTeacher, bySchool }
}
/** Workbook raw roster includes all historical moments even when crosses are date-filtered. */
export function exportReport(data: ReportData) {
  const raw = data.schools.flatMap(s => {
    const evaluations = new Map(SUBJECTS.map(subject => [subject, latest(s.evaluations, subject, MOMENTS)]))
    const marks = grouped(s.attendance, m => m.studentId)
    return s.students.map(student => {
      const { id: schoolId, name: school, department, municipality, zone } = s.school
      const { campus, id: studentId, code, fullName, grade, gender, age, sample } = student
      const { present, absent, rate: attendanceRate } = counted(marks.get(studentId) ?? [])
      const columns: Record<string, string> = {}
      for (const subject of SUBJECTS) {
        const group = s.groups.find(g => g.subject === subject && g.studentIds?.includes(studentId))
        columns['group_' + subject] = group?.name ?? ''
        columns['teacher_' + subject] = group?.teacherName ?? ''
        for (const m of MOMENTS) columns[subject + '_' + m] = evaluations.get(subject)?.get(studentId)?.get(m)?.level ?? ''
      }
      return {
        schoolId,
        school,
        department,
        municipality,
        zone,
        campus,
        studentId,
        code,
        fullName,
        grade,
        gender,
        age,
        sample,
        retired: student.retired === true,
        provisional: student.provisional === true,
        present,
        absent,
        attendanceRate,
        ...columns
      }
    })
  }).sort((a, b) => cmp(a.school, b.school) || cmp(a.fullName, b.fullName))
  return {
    raw, crosses: {
      summary: summary(data), levels: { lectura: levels(data, 'lectura'), matematicas: levels(data, 'matematicas') },
      attendance: attendanceReport(data), hours: hoursReport(data)
    }
  }
}
