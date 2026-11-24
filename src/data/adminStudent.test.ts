import { beforeEach, expect, it, vi } from 'vitest'
import type { Student } from '../domain/types'
import { saveStudentAssignment } from './adminStudent'
const mock = vi.hoisted(() => ({
  caller: vi.fn(), docs: new Map<string, Record<string, unknown>>(), update: vi.fn(), transaction: vi.fn()
}))
vi.mock('./firebase', () => ({ db: {}, auth: {} }))
vi.mock('./core', async original => ({ ...await original<typeof import('./core')>(), caller: mock.caller }))
vi.mock('firebase/firestore', () => ({
  doc: (_db: unknown, ...parts: string[]) => parts.join('/'),
  arrayUnion: (id: string) => ({ add: id }), arrayRemove: (id: string) => ({ remove: id }),
  runTransaction: (_db: unknown, body: (tx: unknown) => Promise<unknown>) => {
    mock.transaction()
    return body({ update: mock.update, get: async (ref: string) => ({ id: ref.split('/')[1], ref, exists: () => mock.docs.has(ref), data: () => mock.docs.get(ref) }) })
  }
}))
const student: Student = { id: 'ie_001', schoolId: 'ie', campus: 'origen', code: '001', nameKey: 'ana', fullName: 'Ana', grade: 3, age: null, sample: null, gender: '', active: true, retired: false, provisional: false, levels: {} }
beforeEach(() => {
  vi.clearAllMocks()
  mock.caller.mockResolvedValue({ rol: 'fundacion' })
  mock.docs.set('schools/ie', { campuses: [{ id: 'destino', name: 'Destino' }] })
  mock.docs.set('students/ie_001', { ...student })
  mock.docs.set('groups/antes', { schoolId: 'ie', campus: 'origen' })
  mock.docs.set('groups/despues', { schoolId: 'ie', campus: 'destino' })
})
it('guarda campos móviles y deltas de pertenencia en una sola transacción sin cambiar el id', async () => {
  await saveStudentAssignment(student, { campus: 'destino', retired: false }, ['antes'], ['despues'])
  expect(mock.caller).toHaveBeenCalledWith('manager')
  expect(mock.transaction).toHaveBeenCalledTimes(1)
  expect(mock.update.mock.calls).toEqual([
    ['students/ie_001', { campus: 'destino', retired: false, updatedAt: expect.any(String) }],
    ['groups/antes', { studentIds: { remove: 'ie_001' }, updatedAt: expect.any(String) }],
    ['groups/despues', { studentIds: { add: 'ie_001' }, updatedAt: expect.any(String) }]
  ])
})
it('rechaza grupos externos, cambios concurrentes y perfiles de solo lectura antes de escribir', async () => {
  mock.docs.set('groups/despues', { schoolId: 'otra', campus: 'destino' })
  await expect(saveStudentAssignment(student, { campus: 'destino' }, [], ['despues'])).rejects.toMatchObject({ status: 400 })
  mock.docs.set('students/ie_001', { ...student, campus: 'nueva' })
  await expect(saveStudentAssignment(student, { campus: 'destino' }, [], [])).rejects.toMatchObject({ status: 409 })
  mock.caller.mockRejectedValue({ code: 'permission-denied' })
  await expect(saveStudentAssignment(student, {}, [], [])).rejects.toMatchObject({ status: 403 })
  expect(mock.update).not.toHaveBeenCalled()
})
