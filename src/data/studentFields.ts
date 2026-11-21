import type { Student } from '../domain/types'
import { nameKey } from '../domain/nameKey'
import { fail, str } from './core'

/** Mutable student fields accepted by the gateway from forms and import rows. */
export interface StudentFields {
  fullName?: unknown;
  grade?: unknown;
  gender?: unknown;
  age?: unknown;
  sample?: unknown;
  retired?: unknown;
  campus?: unknown
}
/** Validates and whitelists student demographics and provisional identity fields. */
export function studentFields(b: StudentFields) {
  const out: Partial<Student> = {}
  if ('gender' in b) {
    const gender = str(b.gender).toUpperCase()
    if (gender !== '' && gender !== 'F' && gender !== 'M') fail(400, 'El sexo debe ser F o M.')
    out.gender = gender
  }
  for (const key of ['age', 'sample', 'grade'] as const) {
    if (!(key in b)) continue
    const limits = { age: [5, 18], sample: [1, 4], grade: [3, 5] }[key]
    const errors = {
      age: 'Escribe una edad entre 5 y 18 años.',
      sample: 'La muestra debe ser de 1 a 4.',
      grade: 'El grado debe ser 3, 4 o 5.'
    }
    const value = str(b[key])
    if (!value && key !== 'grade') {
      out[key] = null;
      continue
    }
    const n = Number(value)
    if (!Number.isInteger(n) || n < limits[0] || n > limits[1]) fail(400, errors[key])
    out[key] = n
  }
  if ('fullName' in b) {
    out.fullName = str(b.fullName).replace(/\s+/g, ' ')
    if (!out.fullName) fail(400, 'Escribe el nombre del estudiante.')
    out.nameKey = nameKey(out.fullName)
  }
  if ('campus' in b) out.campus = str(b.campus)
  if ('retired' in b) out.retired = b.retired === true
  return out
}
/** Builds a complete new Firestore student document. */
export function newStudent(input: StudentFields, code: string, schoolId: string, uid: string, provisional: boolean, timestamp: string) {
  const fields = studentFields({ ...input, fullName: input.fullName, grade: input.grade })
  return {
    fullName: '',
    nameKey: '',
    grade: 0,
    campus: '',
    gender: '' as const,
    age: null,
    sample: null,
    ...fields,
    schoolId,
    code,
    active: true,
    retired: false,
    provisional,
    levels: {},
    createdAt: timestamp,
    updatedAt: timestamp,
    createdBy: uid
  }
}
