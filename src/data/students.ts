import { useMemo } from 'react'
import { collection, doc, getDoc, getDocs, query, updateDoc, where } from 'firebase/firestore'
import { SUBJECTS } from '../domain/levels'
import { cleanName, validateName } from '../domain/text/studentNameRules'
import { nameKey } from '../domain/nameKey'
import type { AttendanceMark, Evaluation, LevelMark, Student, UserProfile } from '../domain/types'
import { db } from './firebase'
import { api, caller, chunks, commit, compare, fail, isOffline, normalizeCode, now, recordOf, requireSchool, str } from './core'
import { scopedRows } from './scope'
import { useLive, type Stream } from './live'
import { insertPage } from './inserts'
import { newStudent, studentFields, type StudentFields } from './studentFields'

/** Loads a student and verifies the caller's access to the stored school. */
export async function studentDoc(p: UserProfile, id: string) {
  const d = await getDoc(doc(db, 'students', id))
  if (!d.exists() || d.data().mergedInto != null) fail(404, 'No encontramos al estudiante.')
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
  return scopedRows<Student>('students', schoolId)(rows => cb(rows.filter(s => !('mergedInto' in s && s.mergedInto != null)).map(studentView).sort((a, b) => compare(a.fullName, b.fullName))), error, reset)
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
  source?: 'ocr' | 'manual';
  reviewReasons?: readonly string[];
  ocrConfidence?: number | null;
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
    if (!clientKey) fail(400, 'El identificador del registro es inválido.')
    if (str(input.code) && !normalizeCode(code)) fail(400, 'El código debe contener letras o números.')
    if (typeof input.fullName !== 'string') fail(400, 'Escribe el nombre del estudiante.')
    if (input.reviewReasons != null && !Array.isArray(input.reviewReasons)) fail(400, 'Revisa las alertas del nombre.')
    const source = input.source ?? 'manual'
    const confidence = input.ocrConfidence ?? null
    if (!['ocr', 'manual'].includes(source)) fail(400, 'Origen de registro inválido.')
    if (confidence !== null && (source !== 'ocr' || !Number.isFinite(confidence) || confidence < 0 || confidence > 1)) {
      fail(400, 'La confianza de lectura es inválida.')
    }
    const reviewReasons = [...new Set([
      ...(p.rol === 'docente' ? ['nuevo_docente'] : []), ...validateName(input.fullName, confidence),
      ...(input.reviewReasons ?? []).filter(r => /^(?:posible_duplicado:[^/]+|formato_nombre|solo_iniciales|mayusculas|ocr_baja_confianza)$/.test(r))
    ])]
    const fullName = cleanName(input.fullName)
    const assigned = p.campusIds?.[schoolId] ?? []
    const campus = str(input.campus) || (p.rol === 'docente' && assigned.length === 1 ? assigned[0] : '')
    const data = { ...newStudent({ ...input, fullName, campus }, code, schoolId, p.uid, provisional, now(),p.rol === 'docente'),
      needsReview: p.rol === 'docente' || reviewReasons.length > 0, source, reviewReasons, ocrConfidence: confidence, mergedInto: null }
    const existing = await getDoc(ref).catch(error => {
      if (p.rol === 'docente' && isOffline(error)) return null
      throw error
    })
    if (existing?.exists()) {
      if (provisional && existing.data().createdBy === p.uid) {
        const target = existing.data().mergedInto
        return studentView(recordOf<Student>(target ? await studentDoc(p,target) : existing))
      }
      fail(409, 'Ya existe un estudiante con ese código.')
    }
    const { created, syncState } = await insertPage([{ref,data}], existing !== null)
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
    const p = await caller('writer'), d = await studentDoc(p, id)
    const rename = p.rol === 'docente' && typeof fields.fullName === 'string'
    const changes = studentFields(fields, rename)
    if (!Object.keys(changes).length) fail(400, 'No hay cambios para guardar.')
    if (p.rol === 'docente' && ['fullName', 'grade', 'campus'].some(k => k in changes)
      && !(d.data().provisional === true && d.data().createdBy === p.uid)) fail(403, 'Pide a coordinación que cambie el nombre, el grado o la sede.')
    const oldReasons: unknown = d.data().reviewReasons
    const review = rename ? {needsReview:true,reviewReasons:[...new Set([
      'nuevo_docente',...(Array.isArray(oldReasons) ? oldReasons.filter(r => typeof r === 'string' &&
        (r === 'ocr_baja_confianza' || r.startsWith('posible_duplicado:'))) : []),...validateName(String(fields.fullName))
    ])]} : {}
    const syncState = await commit(updateDoc(d.ref, { ...changes, ...review, updatedAt: now() }))
    return studentView({ ...recordOf<Student>(d), ...changes, ...review, syncState })
  })
}
/** Imports a school roster after validation, skipping duplicate normalized codes. */
export function importStudents(schoolId: string, rows: readonly (StudentFields & { code?: unknown })[]) {
  return api(async () => {
    const p = await caller('writer')
    await requireSchool(p, schoolId)
    if (p.rol === 'docente') fail(403, 'Usa Añadir estudiante.')
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
      return [{ id, code, data: { ...newStudent(row, code, schoolId, p.uid, false, timestamp), source: 'import', needsReview: false, reviewReasons: [], mergedInto: null, ocrConfidence: null } }]
    })
    let syncState: 'pending' | 'synced' = 'synced'
    const created: { id: string; code: string }[] = []
    for (const page of chunks(writes, 400)) {
      const receipt = await insertPage(page.map(w => ({ ref: doc(db, 'students', w.id), data: w.data })), p.rol === 'fundacion')
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
