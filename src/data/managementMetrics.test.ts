import { describe, expect, it, vi } from 'vitest'
import type { AttendanceMark, Evaluation, Group, ProgramConfig, School, Student } from '../domain/types'
import type { SchoolData } from './reportMath'
import { activityFeed } from './activity'
import { comparison, dashboardAlerts, movement, observedMoment, teacherFollowup } from './managementMetrics'

vi.mock('./firebase', () => ({ db: {}, auth: {} }))
const config: ProgramConfig = { implementationStartDate: '2026-04-06', breaks: [{ from: '2026-04-13', to: '2026-04-17', label: 'Pausa' }], projectName: 'Prueba', year: 2026 }
const school: School = { id: 'ie', name: 'Institución de prueba', active: true, zone: 'rural', projectId: 'p', department: 'Caldas', municipality: 'Neira', region: 'Centro', campuses: [{ id: 'c', name: 'Sede de prueba', jornada: 'única' }] }
const student: Student = { id: 'a', schoolId: 'ie', campus: 'c', code: '01', nameKey: 'ana', fullName: 'Ana', grade: 3, age: null, sample: null, gender: '', active: true, retired: false, provisional: false, levels: {} }
const group: Group = { id: 'g', schoolId: 'ie', campus: 'Sede de prueba', name: 'Lectores', subject: 'lectura', studentIds: ['a'], teacherId: 't', teacherName: 'Sol' }
const base: Evaluation = { id: '1', sample: null, schoolId: 'ie', subject: 'lectura', teacherId: 't', moment: 'linea_base', level: 'palabra', studentId: 'a', date: '2026-04-08', savedAt: '2026-04-08T12:30:00Z' }
const mid: Evaluation = { ...base, id: '2', moment: 'linea_media_1', date: '2026-04-21', savedAt: '2026-04-21T12:30:00Z', level: 'principiante' }
const mark: AttendanceMark = { groupId: 'g', date: '2026-04-22', savedAt: '2026-04-22T13:00:00Z', teacherId: 't', schoolId: 'ie', studentId: 'a', status: 'no_vino' }
const data: SchoolData = {
  school, students: [student], groups: [group], teachers: [{ uid: 't', fullName: 'Sol' }, { uid: 'u', fullName: 'Luz' }],
  attendance: [mark], evaluations: [base, mid], hours: [{ teacherId: 't', schoolId: 'ie', date: '2026-04-21', savedAt: mid.savedAt, week: 2, plannedHours: 5, workedHours: 3, reason: 'Capacitación' }]
}

describe('Indicadores de gestión', () => {
  it('compara estudiantes emparejados, deduplica correcciones y separa las áreas', () => {
    const improved = { ...mid, id: '3', savedAt: '2026-04-23T13:00:00Z', level: 'cuento' }
    const events = [improved, mid, base, { ...mid, studentId: 'b' }, { ...base, subject: 'matematicas' as const, level: 'un_digito' }]
    expect(movement(events, 'lectura', 'linea_base', 'linea_media_1')).toEqual({ up: 1, stable: 0, down: 0, total: 1 })
    expect(movement(events, 'matematicas', 'linea_base', 'linea_media_1').total).toBe(0)
  })
  it('calcula toma semanal sin recesos y cobertura por estudiante y área de sus grupos', () => {
    const [t, u] = teacherFollowup({ ...data, groups: [group, { ...group, id: 'otro' }], attendance: [mark, { ...mark, date: '2026-04-14' }] }, config, '2026-04-06', '2026-04-23', 'linea_media_1')
    expect(t).toMatchObject({ weeks: 1, expected: 2, attendanceRate: 50, worked: 3, planned: 5, coverage: 100, members: 1, last: mark.savedAt })
    expect(u).toMatchObject({ coverage: null, attendanceRate: 0, last: '' })
  })
  it('conserva el cero medido y muestra falta de datos en la sede sin sesiones válidas', () => {
    expect(comparison(data, 'c')).toEqual({ students: 1, groups: 1, evaluated: 1, attendance: 0 })
    expect(comparison({ ...data, attendance: [{ ...mark, status: 'retirado' }] }, 'c').attendance).toBeNull()
  })
  it('produce destinos con entidad, momento o semana y suspende las alertas semanales en receso', () => {
    const local = { ...data, groups: [group, { ...group, id: 'sin', subject: 'matematicas' as const }] }
    expect(observedMoment([local], config.implementationStartDate, '2026-04-20')).toBe('linea_base')
    const links = dashboardAlerts([local], config, '2026-04-23', 'linea_media_1').map(a => a.path)
    expect(links).toEqual(expect.arrayContaining([
      '/visualizacion/seguimiento?schoolId=ie&week=2&teacher=u',
      '/visualizacion/docentes?schoolId=ie&teacher=t&from=2026-04-20&to=2026-04-23',
      '/visualizacion/comparacion?schoolId=ie&campus=c&from=2026-04-20&to=2026-04-23',
      '/visualizacion/instituciones?schoolId=ie&campus=c&group=sin&moment=linea_media_1&from=2026-04-06&to=2026-04-23',
      '/visualizacion/estudiante?schoolId=ie&student=a&subject=lectura'
    ]))
    expect(dashboardAlerts([local], config, '2026-04-14', 'linea_base').some(a => a.path.includes('week='))).toBe(false)
  })
  it('presenta una toma de asistencia por guardado y conserva evaluaciones con el mismo id en distintos estudiantes', () => {
    const feed = activityFeed([{ ...data, attendance: [mark, { ...mark, studentId: 'b', savedAt: '2026-04-22T12:59:59Z' }], evaluations: [mid, { ...mid, studentId: 'b' }] }])
    expect(feed.map(v => v.kind)).toEqual(['Asistencia', 'Evaluación', 'Evaluación', 'Horas'])
    expect(feed[0]).toMatchObject({ author: 'Sol', detail: 'Lectores', savedAt: mark.savedAt })
  })
})
