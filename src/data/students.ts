import { useMemo } from 'react'
import { collection, doc, documentId, getDoc, getDocs, query, updateDoc, where } from 'firebase/firestore'
import { SUBJECTS } from '../domain/levels'
import { nameKey } from '../domain/nameKey'
import type { AttendanceMark, Evaluation, LevelMark, Student, UserProfile } from '../domain/types'
import { db } from './firebase'
import { api, caller, chunks, commit, compare, fail, normalizeCode, now, recordOf, requireSchool, str } from './core'
import { scopedRows } from './scope'
import { useLive, type Stream } from './live'
import { insertPage } from './inserts'
import { newStudent, studentFields, type StudentFields } from './studentFields'

/** Loads a student and verifies the caller's access to the stored school. */
export async function studentDoc(p: UserProfile, id: string) {
  const d = await getDoc(doc(db, 'students', id))
  if (!d.exists()) fail(404, 'No encontramos al estudiante.')
  await requireSchool(p, d.data().schoolId)
  return d
}
function studentView<T extends Student>(student: T) {
  const levels: Student['levels'] = {}
  for (const subject of SUBJECTS) {
    const mark = student.levels?.[subject] as (LevelMark & { clave?: string }) | undefined
    if (mark) levels[subject] = { level: mark.clave ?? mark.level, date: mark.date, moment: mark.moment }
  }
  const fullName = student.fullName ?? ''
  return {
    ...student,
    fullName,
    nameKey: student.nameKey ?? nameKey(fullName),
    levels,
    code: student.code ?? '',
    campus: student.campus ?? '',
    gender: student.gender ?? '',
    age: student.age ?? null,
    sample: student.sample ?? null,
    active: student.active !== false,
    retired: student.retired === true,
    provisional: student.provisional === true
  }
}
/** Watches a school roster, including local writes and updates from mobile. */
export function watchStudents(schoolId: string, cb: (students: Student[]) => void, error: (e: unknown) => void = () => cb([]), reset?: () => void) {
  return scopedRows<Student>('students', schoolId)(rows => cb(rows.map(studentView).sort((a, b) => compare(a.fullName, b.fullName))), error, reset)
}
/** Live roster and loading state for one school. */
export function useStudents(schoolId: string) {
  const source = useMemo<Stream<Student[]>>(() => (next, error, reset) => watchStudents(schoolId, next, error, reset), [schoolId])
  const { data: students, loading, error } = useLive(source, [])
  return { students, loading, error }
}
type Input = StudentFields & {
  schoolId: string;
  fullName: string;
  grade: number;
  code?: string;
  clientId?: string;
  provisional?: boolean
}
/** Creates a deterministic coded or client-identified provisional student. */
export function createStudent(input: Input) {
  return api(async () => {
    const p = await caller('writer'), schoolId = str(input.schoolId)
    await requireSchool(p, schoolId)
    const provisional = p.rol === 'docente' || input.provisional === true
    const clientKey = normalizeCode(input.clientId || crypto.randomUUID())
    const code = str(input.code) || 'P-' + clientKey.slice(0, 5).padStart(5, '0')
    const id = schoolId + '_' + (!str(input.code) || provisional ? 'P_' + clientKey : normalizeCode(code))
    const ref = doc(db, 'students', id)
    const data = newStudent(input, code, schoolId, p.uid, provisional, now())
    // A missing student's document has no schoolId for the teacher read rule.
    const existing = (await getDocs(query(collection(db, 'students'), where('schoolId', '==', schoolId), where(documentId(), '==', id)))).docs[0]
    if (existing) {
      if (provisional && existing.data().createdBy === p.uid) return studentView(recordOf<Student>(existing))
      fail(409, 'Ya existe un estudiante con ese código.')
    }
    const { created, syncState } = await insertPage([{ ref, data }], p.rol === 'admin')
    if (!created.has(id)) {
      const concurrent = await studentDoc(p, id)
      if (provisional && concurrent.data().createdBy === p.uid) return studentView(recordOf<Student>(concurrent))
      fail(409, 'Ya existe un estudiante con ese código.')
    }
    return { ...data, id, syncState }
  })
}
/** Updates permitted demographics and provisional identity fields. */
export function patchStudent(id: string, fields: StudentFields) {
  return api(async () => {
    const p = await caller('writer'), d = await studentDoc(p, id), changes = studentFields(fields)
    if (!Object.keys(changes).length) fail(400, 'No hay cambios para guardar.')
    if (p.rol === 'docente' && ['fullName', 'grade', 'campus'].some(k => k in changes)
      && !(d.data().provisional === true && d.data().createdBy === p.uid)) fail(403, 'Solo el administrador puede cambiar nombre, grado o sede.')
    const syncState = await commit(updateDoc(d.ref, { ...changes, updatedAt: now() }))
    return studentView({ ...recordOf<Student>(d), ...changes, syncState })
  })
}
/** Imports a school roster after validation, skipping duplicate normalized codes. */
export function importStudents(schoolId: string, rows: readonly (StudentFields & { code?: unknown })[]) {
  return api(async () => {
    const p = await caller('writer')
    await requireSchool(p, schoolId)
    if (!rows.length) fail(400, 'La lista de estudiantes está vacía.')
    const existing = new Set((await getDocs(query(collection(db, 'students'), where('schoolId', '==', schoolId)))).docs.map(d => d.id))
    const skipped: string[] = [], timestamp = now()
    const writes = rows.flatMap(row => {
      const code = str(row.code), norm = normalizeCode(code)
      if (!norm) fail(400, 'Cada estudiante necesita un código.')
      const id = schoolId + '_' + norm
      if (existing.has(id)) {
        skipped.push(code);
        return []
      }
      existing.add(id)
      return [{ id, code, data: newStudent(row, code, schoolId, p.uid, false, timestamp) }]
    })
    let syncState: 'pending' | 'synced' = 'synced'
    const created: { id: string; code: string }[] = []
    for (const page of chunks(writes, 400)) {
      const receipt = await insertPage(page.map(w => ({ ref: doc(db, 'students', w.id), data: w.data })), p.rol === 'admin')
      if (receipt.syncState === 'pending') syncState = 'pending'
      for (const { id, code } of page) {
        if (receipt.created.has(id)) created.push({ id, code })
        else skipped.push(code)
      }
    }
    return { created, skipped, syncState }
  })
}
/** Returns chronological attendance and evaluation history of an accessible student. */
export function getStudentHistory(id: string, filters: { evaluationsOnly?:boolean } = {}) {
  return api(async () => {
    const d = await studentDoc(await caller(), id)
    async function rows<T extends AttendanceMark | Evaluation>(path: string) {
      const snap = await getDocs(query(collection(d.ref, path), where('schoolId', '==', d.data().schoolId)))
      return snap.docs.map(s => recordOf<T>(s)).sort((a, b) => compare(a.date, b.date) || compare(a.savedAt, b.savedAt))
    }
    const [attendance, evaluations] = await Promise.all([filters.evaluationsOnly ? [] : rows<AttendanceMark>('attendance'), rows<Evaluation>('evaluations')])
    return { attendance, evaluations }
  })
}
