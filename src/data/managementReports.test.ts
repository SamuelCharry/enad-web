import { beforeEach, expect, it, vi } from 'vitest'
import { readCounter } from './testing/readCounter'
import type { School, UserProfile } from '../domain/types'
import { getLevels, getComparison, getMovement, refreshReports } from './reports'
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
