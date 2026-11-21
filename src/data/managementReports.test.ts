import { beforeEach, expect, it, vi } from 'vitest'
import type { School, UserProfile } from '../domain/types'
import { getLevels, getManagement, getMovement, refreshReports } from './reports'
const source = vi.hoisted(() => ({
  profile: { uid: 'p', rol: 'coordinador', activo: true, regions: ['Centro'], schoolIds: [], campusIds: {}, fullName: 'Sol', email: 's@example.test', jornada: 'única' } as UserProfile,
  rows: new Map<string, Record<string, unknown>[]>(),
  reads: [] as { path: string; filters: { field: string; op: string; value: unknown }[] }[]
}))
const school: School = { id: 'ie', name: 'Escuela', campuses: [{ id: 'c', name: 'Central', jornada: 'única' }], zone: 'rural', region: 'Centro', projectId: 'p', municipality: 'Neira', department: 'Caldas', active: true }
vi.mock('./firebase', () => ({ db: {}, auth: {} }))
vi.mock('./core', async original => ({
  ...await original<typeof import('./core')>(), caller: async () => ({...source.profile}), schoolsOf: async () => [school],
  requireSchool: async (_p: UserProfile, id: string) => { if (id !== school.id) throw { code: 'permission-denied' } }
}))
vi.mock('firebase/firestore', async original => ({
  ...await original<typeof import('firebase/firestore')>(),
  collection: (_db: unknown, ...parts: string[]) => ({ path: parts.join('/'), filters: [] }),
  collectionGroup: (_db: unknown, path: string) => ({ path, filters: [] }), doc: () => ({}),
  where: (field: string, op: string, value: unknown) => ({ field, op, value }), query: (ref: object, ...filters: unknown[]) => ({ ...ref, filters }),
  getDoc: async () => ({ data: () => ({ projectName: 'Programa', year: 2026, breaks: [], implementationStartDate: '2026-04-01' }) }),
  getDocs: async (q: typeof source.reads[number]) => {
    source.reads.push(q)
    return {
      docs: (source.rows.get(q.path) ?? []).filter(r => q.filters.every(f => f.op === '==' ? r[f.field] === f.value : true)).map((r, i) => ({
        id: String(r.id ?? i), data: () => r, metadata: { hasPendingWrites: false }
      }))
    }
  }
}))
beforeEach(() => {
  refreshReports()
  source.rows.clear()
  source.reads.length = 0
  source.profile.rol = 'coordinador'
  const base = { schoolId: 'ie', studentId: 's', subject: 'lectura', moment: 'linea_base', level: 'letra', date: '2026-04-02', savedAt: '2026-04-02T12:00:00Z' }
  source.rows.set('students', [{ id: 's', campus: 'Central', schoolId: 'ie' }])
  source.rows.set('groups', [{ id: 'g', schoolId: 'ie', campus: 'c', teacherId: 't', studentIds: ['s'] }])
  source.rows.set('schools/ie/teachers', [{ id: 't', fullName: 'Sol' }])
  source.rows.set('evaluations', [base, { ...base, moment: 'linea_media_1', date: '2026-04-22', level: 'cuento' }, { ...base, schoolId: 'otra', studentId: 'privado' }])
})
it('usa la misma lectura por área para la distribución y el movimiento y respeta el periodo', async () => {
  const f = { schoolId: 'ie', campus: 'c', from: '2026-04-01', to: '2026-04-30' }
  const levels = await getLevels(f, 'lectura')
  const moved = await getMovement(f, 'lectura')
  expect(levels.overall.n).toBe(1)
  expect(moved[0]).toMatchObject({ up: 1, total: 1 })
  expect(source.reads.filter(q => q.path === 'evaluations')).toHaveLength(1)
  expect((await getMovement({ ...f, to: '2026-04-10' }, 'lectura'))[0].total).toBe(0)
})
it('limita las consultas al colegio autorizado y bloquea la lectura de gestión al docente', async () => {
  const data = await getManagement({ schoolId: 'ie', campus: 'c' })
  expect(data.schools[0].teachers).toEqual([{ uid: 't', fullName: 'Sol' }])
  expect(data.schools[0].evaluations).toHaveLength(2)
  for (const q of source.reads.filter(q => q.path !== 'schools/ie/teachers')) {
    expect(q.filters).toContainEqual({ field: 'schoolId', op: '==', value: 'ie' })
  }
  await expect(getManagement({ schoolId: 'otra' })).rejects.toMatchObject({ status: 403 })
  source.profile.rol = 'docente'
  await expect(getManagement({ schoolId: 'ie' })).rejects.toMatchObject({ status: 403 })
})
