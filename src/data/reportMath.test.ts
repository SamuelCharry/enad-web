import { expect, it } from 'vitest'
import { attendanceReport, exportReport, hoursReport, levels, submissions, summary, type SchoolData, type ReportData } from './reportMath'
import type { AttendanceMark, HoursEntry, Student, Subject } from '../domain/types'

function institution(id: string, name: string): SchoolData {
  return {
    school: {
      id, name, projectId: 'p1', region: id, department: id, municipality: id, zone: 'urbana', active: true,
      campuses: [{ id: id + '-principal', name: 'Principal', jornada: 'única' }]
    }, students: [], groups: [], teachers: [], attendance: [], hours: [], evaluations: []
  }
}
function student(id: string, schoolId: string, fullName: string, age: number, gender: Student['gender']): Student {
  return { id, schoolId, fullName, age, gender, campus: 'Principal', code: id.split('_')[1], nameKey: '', grade: 3, sample: 1, retired: false, active: true, provisional: false, levels: {} }
}
function fixture(): ReportData {
  const first = institution('s1', 'IE Alpha'), second = institution('s2', 'IE Beta')
  first.school.campuses.push({ id: 's1-norte', name: 'Norte', jornada: 'tarde' })
  first.students = [student('s1_A1', 's1', 'Ana Gómez Ruiz', 8, 'F'), student('s1_A2', 's1', 'Luis Pérez Toro', 9, 'M'), student('s1_A3', 's1', 'Sara Díaz Mejía', 10, 'F')]
  second.students = [student('s2_B1', 's2', 'Juan Ríos Cano', 8, 'M')]
  function group(s: SchoolData, id: string, name: string, subject: Subject, uid: string, studentIds: string[]) {
    s.teachers.push({ uid, fullName: 'Usuario ' + uid })
    s.groups.push({ id, name, subject, teacherId: uid, teacherName: 'Usuario ' + uid, schoolId: s.school.id, campus: 'Principal', studentIds })
  }
  group(first, 'g1', 'Abejitas', 'lectura', 't1', ['s1_A1', 's1_A2'])
  group(first, 'g2', 'Fresas', 'matematicas', 't2', ['s1_A1', 's1_A3'])
  group(second, 'g3', 'Tucanes', 'lectura', 't3', ['s2_B1'])
  function mark(groupId: string, studentId: string, teacherId: string, date: string, status: AttendanceMark['status']): AttendanceMark {
    return { groupId, studentId, teacherId, date, status, schoolId: 's1', savedAt: date }
  }
  first.attendance = [mark('g1', 's1_A1', 't1', '2026-11-17', 'vino'), mark('g1', 's1_A2', 't1', '2026-11-17', 'no_vino'),
  mark('g2', 's1_A1', 't2', '2026-11-10', 'vino'), mark('g2', 's1_A3', 't2', '2026-11-10', 'vino')]
  function hours(teacherId: string, schoolId: string, date: string, plannedHours: number, workedHours: number): HoursEntry {
    return { teacherId, schoolId, date, week: 10, plannedHours, workedHours, reason: null, savedAt: date }
  }
  first.hours = [hours('t1', 's1', '2026-11-17', 4, 3)]
  second.hours = [hours('t3', 's2', '2026-11-18', 2, 2)]
  first.evaluations = first.students.slice(0, 2).map((s, i) => ({
    studentId: s.id, id: 'e' + i, subject: 'lectura', moment: 'linea_base', level: i ? 'cuento' : 'letra',
    sample: 1, teacherId: 't1', date: '2026-11-19', schoolId: 's1', savedAt: '2026-11-19'
  }))
  return {
    schools: [first, second], config: {
      year: 2026, projectName: 'ENAd Test', implementationStartDate: '2026-09-09',
      breaks: [{ from: '2026-10-06', to: '2026-10-09', label: 'Receso' }]
    }, from: '2026-09-09', to: '2026-11-19', dateFiltered: false
  }
}
it('reproduce los conteos del gateway y separa institución, docente y sesión', () => {
  const data = fixture()
  expect(summary(data)).toEqual({
    students: 4, teachers: 3, schools: 2, campuses: 3, groupsBySubject: { lectura: 2, matematicas: 1 }, hoursPlanned: 6, hoursWorked: 5, attendanceRate: 75,
    studentsOverTime: [{ week: 9, count: 2 }, { week: 10, count: 1 }], range: { from: data.from, to: data.to }
  })
  const att = attendanceReport(data)
  expect(att.bySchool[0]).toEqual({ schoolId: 's1', name: 'IE Alpha', rate: 75, sessions: 2, present: 3, absent: 1 })
  expect(att.byGroup).toHaveLength(2)
  expect(att.byTeacher).toHaveLength(2)
  expect(hoursReport(data).byTeacher[0]).toMatchObject({ uid: 't1', weekly: [{ week: 10, planned: 4, worked: 3 }], cumulative: { worked: 3, planned: 4, rate: 75 } })
  expect(summary({ ...data, schools: [data.schools[1]] }).students).toBe(1)
  expect(summary({ ...data, schools: [] }).attendanceRate).toBe(0)
})
it('cuenta cada docente una vez aunque figure en dos instituciones', () => {
  const data = fixture()
  data.schools[1].teachers.push(data.schools[0].teachers[0])
  const report = submissions(data, 10)
  expect(report).toMatchObject({ week: 10, range: { from: '2026-11-16', to: '2026-11-22' }, total: 3, attendanceSent: 1, hoursSent: 2 })
  expect(report.teachers).toHaveLength(4)
  expect(report.teachers.filter(t => t.uid === 't1').map(t => t.attendanceSent)).toEqual([true, false])
  expect(submissions({ ...data, schools: [data.schools[0]] }, 9).attendanceSent).toBe(1)
})
it('conserva el último evento por momento y los cruces demográficos', () => {
  const data = fixture(), s = data.schools[0]
  s.evaluations.push({ ...s.evaluations[0], id: 'old', savedAt: '2026-11-18', level: 'comprension' })
  const report = levels(data, 'lectura', ['linea_base', 'linea_media_1'])
  expect(report.overall).toMatchObject({ n: 2, counts: { linea_base: 2, linea_media_1: 0 }, rezago: { linea_base: 50, linea_media_1: 0 }, distribution: { linea_base: { letra: 1, cuento: 1, comprension: 0 } } })
  expect(report.gender).toEqual({ F: 1, M: 1 })
  expect(report.age).toEqual({ '8': 1, '9': 1 })
  expect(report.bySchool[1].n).toBe(0)
  const payload = exportReport({ ...data, schools: [s], from: '2026-11-20', dateFiltered: true })
  expect(payload.raw).toHaveLength(3)
  expect(payload.raw[0]).toMatchObject({ studentId: 's1_A1', lectura_linea_base: 'letra', group_lectura: 'Abejitas', group_matematicas: 'Fresas', present: 2, absent: 0 })
  expect(payload.crosses.levels.lectura.overall.n).toBe(0)
  expect(Object.keys(payload.crosses)).toEqual(['summary', 'levels', 'attendance', 'hours'])
})
it('cuenta sesiones retiradas pero excluye las marcas retiradas del denominador', () => {
  const data = fixture(), s = data.schools[0]
  s.students[0].retired = true
  s.attendance.push({ ...s.attendance[0], groupId: 'eliminado', status: 'retirado' })
  s.hours.push({ ...s.hours[0], week: null, date: '2026-10-06' })
  expect(summary(data)).toMatchObject({ students: 3, attendanceRate: 75, hoursPlanned: 10 })
  expect(attendanceReport(data).byGroup.find(g => g.groupId === 'eliminado')).toMatchObject({ name: 'Grupo eliminado', sessions: 1, rate: 0 })
  expect(hoursReport(data).bySchool[0]).toMatchObject({ planned: 8, weekly: [{ week: 10, planned: 4, worked: 3 }] })
})
