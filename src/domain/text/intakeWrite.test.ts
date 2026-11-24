import { beforeEach, expect, it, vi } from 'vitest'
import vector from '../../../../docs/name_rules_vectors.json'
import { createStudent, importStudents } from '../../data/students'
import { insertPage } from '../../data/inserts'
import { getDocs } from 'firebase/firestore'

vi.mock('../../data/firebase', () => ({ db: {}, auth: {} }))
vi.mock('../../data/inserts', () => ({ insertPage: vi.fn() }))
vi.mock('../../data/core', async load => ({
  ...await load<typeof import('../../data/core')>(),
  caller: async () => ({ uid: 'teacher', rol: 'docente', schoolIds: ['s1'] }), requireSchool: vi.fn()
}))
vi.mock('firebase/firestore', async load => ({
  ...await load<typeof import('firebase/firestore')>(),
  doc: vi.fn(), collection: vi.fn(), query: vi.fn(), getDocs: vi.fn(async () => ({ docs: [] }))
}))
beforeEach(() => { vi.clearAllMocks() })
it('escribe la misma identidad y los mismos campos de revisión que Flutter', async () => {
  vi.mocked(insertPage).mockResolvedValue({ created: new Set([vector.write.id]), syncState: 'pending' })
  const payload = { ...vector.write.input, source: 'ocr' as const }
  expect(await createStudent(payload)).toMatchObject({ id: vector.write.id, ...vector.write.fields, syncState: 'pending' })
  expect(vi.mocked(insertPage).mock.calls[0][0][0].data).toMatchObject(vector.write.fields)
  expect(getDocs).toHaveBeenCalledOnce()
})
it('rechaza una página sin letras, una confianza inválida y el alta docente por importación', async () => {
  const payload = { ...vector.write.input, source: 'ocr' as const }
  for (const fields of [{ fullName: '123' }, { ocrConfidence: 1.2 }, { grade: 3.3 }]) {
    await expect(createStudent({ ...payload, ...fields })).rejects.toMatchObject({ status: 400 })
  }
  await expect(importStudents('s1', [{ fullName: 'Ana Paz', code: 'c', grade: 3 }])).rejects.toMatchObject({ status: 403 })
  expect(insertPage).not.toHaveBeenCalled()
})
