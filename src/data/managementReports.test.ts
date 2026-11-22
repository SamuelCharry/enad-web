import { beforeEach, expect, it, vi } from 'vitest'
import { readCounter } from './testing/readCounter'
import type { School, UserProfile } from '../domain/types'
import { getAttendanceReport, getLevels, getComparison, getMovement, getSummary, refreshReports } from './reports'
const source = vi.hoisted(() => ({
  profile: { uid: 'p', rol: 'coordinador', activo: true, regions: ['Centro'], schoolIds: [], campusIds: {}, fullName: 'Sol', email: 's@example.test', jornada: 'única' } as UserProfile,
 }))
let store:ReturnType<typeof readCounter>
const school: School = { id: 'ie', name: 'Escuela', campuses: [{ id: 'c', name: 'Central', jornada: 'única' }], zone: 'rural', region: 'Centro', projectId: 'p', municipality: 'Neira', department: 'Caldas', active: true }
vi.mock('./firebase', () => ({ db: {path:''}, auth: {} }))
vi.mock('./core', async original => ({
  ...await original<typeof import('./core')>(), caller: async () => ({...source.profile}), schoolsOf: async () => [school],
  requireSchool: async (_p: UserProfile, id: string) => { if (id !== school.id) throw { code: 'permission-denied' } }
}))
vi.mock('firebase/firestore',async () => {
  const {readCounter} = await import('./testing/readCounter')
  return Object.fromEntries(Object.keys(readCounter().sdk).map(key => [key,(...args:never[]) =>
    (store.sdk[key as keyof typeof store.sdk] as (...a:never[])=>unknown)(...args)]))
})
beforeEach(() => {
  refreshReports()
  store = readCounter()
  store.put('schools/ie',{...school})
  store.put('program/config',{projectName:'Programa',year:2026,breaks:[],implementationStartDate:'2026-04-01'})
  source.profile.rol = 'coordinador'
  const base = { schoolId: 'ie', studentId: 's', subject: 'lectura', moment: 'linea_base', level: 'letra', date: '2026-04-02', savedAt: '2026-04-02T12:00:00Z' }
  store.put('students/s',{campus:'Central', schoolId:'ie', levels:{lectura:{moment:'linea_media_1',date:'2026-04-22',level:'cuento'}}})
  store.put('students/s/evaluations/base',base)
  store.put('students/s/evaluations/media',{...base,moment:'linea_media_1',date:'2026-04-22',level:'cuento'})
  store.put('students/privado/evaluations/base',{...base,schoolId:'otra',studentId:'privado'})
})
it('consulta niveles actuales y limita los movimientos a los dos momentos y al período elegidos', async () => {
  const f = { schoolId: 'ie', campus: 'c', from: '2026-04-01', to: '2026-04-30' }
  const levels = await getLevels(f, 'lectura')
  const moved = await getMovement(f, 'lectura')
  expect(levels.overall.n).toBe(1)
  expect(moved[0]).toMatchObject({ up: 1, total: 1 })
  expect(store.reads.requests.filter(q => q.path === 'evaluations')).toHaveLength(2)
  expect((await getMovement({ ...f, to: '2026-04-10' }, 'lectura'))[0].total).toBe(0)
})
it('bloquea la comparación fuera del ámbito y las cuentas docentes', async () => {
  await expect(getComparison({schoolId:'otra'},false)).rejects.toMatchObject({status:403})
  source.profile.rol='docente'
  await expect(getComparison({},false)).rejects.toMatchObject({status:403})
})

it('cuenta una sesión por grupo y día y conserva al suplente y al grupo eliminado', async () => {
  const date = '2026-04-02'
  for (const groupId of ['g2', 'g1']) store.put('groups/' + groupId, { schoolId: school.id, name: groupId })
  const marks = [['g1', 'a', 'vino'], ['g1', 'b', 'no_vino'], ['g2', 'a', 'vino'], ['eliminado', 'b', 'vino']]
  marks.forEach(([groupId, teacherId, status], i) => store.put(`students/s${i}/attendance/m`, {
    schoolId: school.id, date, groupId, teacherId, status, savedAt: date
  }))
  const report = await getAttendanceReport({ schoolId: school.id, from: date, to: date })
  expect(report.bySchool[0]).toMatchObject({ sessions: 3, present: 3, absent: 1 })
  expect(report.byTeacher).toEqual(expect.arrayContaining([
    expect.objectContaining({ uid: 'a', sessions: 2, rate: 100 }),
    expect.objectContaining({ uid: 'b', sessions: 2, rate: 50 })
  ]))
  expect(report.byGroup.find(g => g.groupId === 'eliminado')).toMatchObject({ sessions: 1, name: 'Grupo eliminado' })
})

it('respeta las fechas parciales y el padrón de la sede al contar estudiantes distintos', async () => {
  const filters = { schoolId: school.id, from: '2026-04-02', to: '2026-04-03' }
  for (const [id, campus, date, status] of [
    ['s', 'Central', '2026-04-02', 'vino'], ['s', 'Central', '2026-04-03', 'vino'],
    ['otra', 'Sur', '2026-04-02', 'vino'], ['antes', 'Central', '2026-04-01', 'vino'],
    ['ausente', 'Central', '2026-04-02', 'no_vino']
  ]) {
    if (id !== 's') store.put('students/' + id, { schoolId: school.id, campus })
    store.put(`students/${id}/attendance/${date}`, { schoolId: school.id, studentId: id, date, status })
  }
  expect((await getSummary(filters)).studentsOverTime).toEqual([{ week: 1, count: 2 }])
  expect((await getSummary({ ...filters, campus: 'c' })).studentsOverTime).toEqual([{ week: 1, count: 1 }])
})
