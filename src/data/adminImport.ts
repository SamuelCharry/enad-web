import { collection, doc, getDocs, query, runTransaction, setDoc, where, writeBatch, type DocumentData, type DocumentReference } from 'firebase/firestore'
import type { ImportKind } from '../domain/import/schema'
import { LEVELS, MOMENTS, SUBJECTS, shouldOverwriteLevel } from '../domain/levels'
import type { Moment, Subject, Campus, UserProfile } from '../domain/types'
import { colombiaToday } from '../domain/weeks'
import { api, apiError, caller, chunks, commit, fail, isOffline, normalizeCode, now, reportCache, requireDate, schoolsOf, slug, str } from './core'
import { db } from './firebase'
import { provisionTeacher, schoolFields, stringList } from './adminRecords'
import { insertPage, type Insert } from './inserts'
import { groupName } from './groups'
import { newStudent } from './studentFields'

type Row = Record<string, unknown>
type Outcome = {
  created: number;
  skipped: number;
  errors: { row: number; message: string }[];
  credentials: { username: string; password: string }[]
}
type AtomicWriter = {
  set(ref: DocumentReference, data: DocumentData): unknown;
  update(ref: DocumentReference, data: DocumentData): unknown
}
type Historical = {
  ref: DocumentReference;
  student: DocumentData;
  subject: Subject;
  moment: Moment;
  level: string;
  date: string;
  sample: number | null
}
const knownKinds: ImportKind[] = ['schools', 'groups', 'teachers', 'students', 'evaluations']

function subjectOf(value: unknown) {
  const subject = str(value).toLowerCase().replaceAll('á', 'a') as Subject
  if (!SUBJECTS.includes(subject)) fail(400, 'La materia debe ser lectura o matemáticas.')
  return subject
}
// A single scoped snapshot serves every row for this school. Import transactions
// recheck absence on the server before inserting, protecting existing records.
function roster(path: string) {
  const cache = new Map<string, Map<string, DocumentData>>()
  return async (schoolId: string) => {
    const prior = cache.get(schoolId)
    if (prior) return prior
    const snap = await getDocs(query(collection(db, path), where('schoolId', '==', schoolId)))
    const records = new Map(snap.docs.map(d => [d.id, d.data()]))
    cache.set(schoolId, records)
    return records
  }
}
function historical(row: Row, student: DocumentData, ref: DocumentReference): Historical {
  const subject = subjectOf(row.subject), moment = str(row.moment ?? row.type) as Moment, level = str(row.level)
  if (!MOMENTS.includes(moment)) fail(400, 'El momento de evaluación no es válido.')
  if (!LEVELS[subject].includes(level)) fail(400, 'El nivel no es válido para la materia.')
  const date = str(row.date) ? requireDate(str(row.date)) : colombiaToday()
  const sample = str(row.sample) && Number.isInteger(Number(row.sample)) ? Number(row.sample) : student.sample ?? null
  return { ref, student, subject, moment, level, date, sample }
}
async function saveHistory(events: Historical[], uid: string, savedAt: string) {
  // At most one event and one student update per row. All reads precede writes.
  for (const page of chunks(events, 200)) {
    const students = new Map(page.map(e => [e.ref.id, e]))
    function apply(batch: AtomicWriter, current: Map<string, DocumentData>) {
      const changes = new Map<string, DocumentData>()
      for (const e of page) {
        const { ref, subject, moment, level, date, sample } = e, studentId = ref.id, student = current.get(studentId)
        if (!student || student.schoolId !== e.student.schoolId) fail(400, 'No encontramos al estudiante con ese código.')
        batch.set(doc(ref, 'evaluations', 'imp_' + subject + '_' + moment), {
          subject, moment, level, date, sample, studentId,
          schoolId: student.schoolId, teacherId: uid, savedAt
        })
        const patch = changes.get(studentId) ?? {}, key = 'levels.' + subject
        if (shouldOverwriteLevel(patch[key]?.moment ?? student.levels?.[subject]?.moment, moment)) {
          patch[key] = { level, date, moment }
          changes.set(studentId, patch)
        }
      }
      for (const [id, patch] of changes) batch.update(students.get(id)!.ref, { ...patch, updatedAt: savedAt })
      return changes
    }
    let changes: Map<string, DocumentData>
    try {
      changes = await runTransaction(db, async tx => {
        const docs = await Promise.all([...students.values()].map(e => tx.get(e.ref)))
        return apply(tx, new Map(docs.filter(d => d.exists()).map(d => [d.id, d.data()!])))
      })
    } catch (e) {
      if (!isOffline(e)) throw e
      const batch = writeBatch(db)
      changes = apply(batch, new Map([...students].map(([id, s]) => [id, s.student])))
      await commit(batch.commit())
    }
    // Keep the scoped snapshot current across chunks during a disconnected import.
    for (const [id, patch] of changes) {
      const student = students.get(id)!.student
      student.levels = { ...student.levels }
      for (const subject of SUBJECTS) if (patch['levels.' + subject]) student.levels[subject] = patch['levels.' + subject]
    }
    reportCache.clear()
  }
}
function schoolRow(row: Row, known: Set<string>, pending: Map<string, { data: Row; campuses: Campus[] }>, p: UserProfile) {
  const id = str(row.id) || slug(str(row.name))
  if (!id) fail(400, 'Falta el nombre de la institución.')
  const campus = str(row.campus ?? row.sede)
  const campusInput = row.campuses ?? (campus ? [{ name: campus, jornada: row.jornada }] : [])
  const campuses = schoolFields({ campuses: campusInput }, id, false).campuses ?? []
  if (known.has(id)) return false
  if (!campuses.length) fail(400,'Añade al menos una sede.')
  const prior = pending.get(id)
  if (prior) {
    for (const c of campuses) if (!prior.campuses.some(x => x.id === c.id)) prior.campuses.push(c)
  } else pending.set(id, { data: schoolFields(row, id, true, p.projectId), campuses })
  return true
}
/** Bulk-imports validated rows and records the foundation's audit summary. */
export function adminImport(kind: ImportKind, rows: readonly Row[]) {
  return api(async () => {
    const p = await caller('fundacion')
    if (!Array.isArray(rows)) fail(400, 'Envía las filas a importar.')
    if (!knownKinds.includes(kind)) fail(400, 'El tipo de importación debe ser schools, teachers, students, groups o evaluations.')
    const known = new Set((await schoolsOf(p)).map(s => s.id))
    const users = kind === 'groups' || kind === 'teachers' ? (await getDocs(collection(db, 'users'))).docs : []
    const byEmail = new Map(users.map(u => [str(u.data().email).toLowerCase(), u]))
    const byId = new Map(users.map(u => [u.id, u])), emails = new Set(byEmail.keys())
    const pendingSchools = new Map<string, { data: Row; campuses: Campus[] }>()
    const students = roster('students'), groups = roster('groups'), inserts: Insert[] = [], events: Historical[] = [], timestamp = now()
    const result: Outcome = { created: 0, skipped: 0, errors: [], credentials: [] }
    for (const [index, row] of rows.entries()) {
      try {
        const schoolId = str(row.schoolId), campus = str(row.campus ?? row.sede)
        if (kind === 'schools') {
          if (!schoolRow(row, known, pendingSchools, p)) result.skipped++
          continue
        }
        if (kind === 'teachers') {
          const email = str(row.email || (row.username ? str(row.username) + '@enad.app' : '')).toLowerCase()
          if (email && emails.has(email)) {
            result.skipped++;
            continue
          }
          const schoolIds = stringList(row.schoolIds ?? schoolId)
          const campusIds = row.campusIds ?? (campus ? Object.fromEntries(schoolIds.map(s => [s, [campus]])) : {})
          result.credentials.push(await provisionTeacher(p, { ...row, schoolIds, campusIds }, known))
          emails.add(email)
          result.created++
          continue
        }
        if (!known.has(schoolId)) fail(400, 'La institución "' + schoolId + '" no existe.')
        const code = str(row.code), norm = normalizeCode(code)
        if (kind === 'students') {
          if (!norm) fail(400, 'Falta el código del estudiante.')
          const id = schoolId + '_' + norm, existing = await students(schoolId)
          if (existing.has(id)) {
            result.skipped++;
            continue
          }
          const data = {...newStudent({ ...row, campus }, code, schoolId, p.uid, false, timestamp),source:'import',needsReview:false,reviewReasons:[],ocrConfidence:null,mergedInto:null}
          inserts.push({ ref: doc(db, 'students', id), data })
          existing.set(id, data)
        } else if (kind === 'groups') {
          const name = groupName(row.name)
          const subject = subjectOf(row.subject), login = str(row.teacherEmail ?? row.teacherUsername ?? row.teacher).toLowerCase()
          const teacher = row.teacherId ? byId.get(str(row.teacherId)) : byEmail.get(login.includes('@') ? login : login + '@enad.app')
          if (!teacher || teacher.data().rol !== 'docente' || !teacher.data().activo || !teacher.data().schoolIds?.includes(schoolId)) fail(400, 'Selecciona un docente activo del colegio.')
          const id = schoolId + '_' + subject + '_' + slug(name), existing = await groups(schoolId)
          if (existing.has(id)) {
            result.skipped++;
            continue
          }
          const studentIds = stringList(row.studentCodes ?? row.studentIds).map(s => s.startsWith(schoolId + '_') ? s : schoolId + '_' + normalizeCode(s))
          const schoolRoster = await students(schoolId)
          if (new Set(studentIds).size !== studentIds.length || studentIds.length > 60 || studentIds.some(id => !schoolRoster.has(id) || schoolRoster.get(id)?.mergedInto)) fail(400,'Elige hasta 60 estudiantes diferentes de la institución.')
          const data = {
            name,
            subject,
            teacherId: teacher.id,
            teacherName: str(teacher.data().fullName),
            schoolId,
            campus,
            studentIds,
            createdAt: timestamp,
            updatedAt: timestamp
          }
          inserts.push({ ref: doc(db, 'groups', id), data })
          existing.set(id, data)
        } else {
          const id = str(row.studentId) || schoolId + '_' + norm, student = (await students(schoolId)).get(id)
          if (!student) fail(400, 'No encontramos al estudiante con ese código.')
          events.push(historical(row, student, doc(db, 'students', id)))
        }
      } catch (e) {
        const error = apiError(e)
        if (kind === 'teachers' && error.status === 409) result.skipped++
        else result.errors.push({ row: index + 1, message: error.message })
      }
    }
    for (const [id, entry] of pendingSchools) inserts.push({ ref: doc(db, 'schools', id), data: { ...entry.data, campuses: entry.campuses } })
    for (const page of chunks(inserts, 400)) {
      const { created } = await insertPage(page, true)
      result.created += created.size
      result.skipped += page.length - created.size
    }
    await saveHistory(events, p.uid, timestamp)
    result.created += events.length
    try {
      await commit(setDoc(doc(collection(db, 'imports')), { kind, rows: rows.length, created: result.created, errors: result.errors.length, by: p.uid, at: now() }))
    }
    catch { /* The mobile gateway treats the audit log as best effort. */ }
    return result
  })
}
