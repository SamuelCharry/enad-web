import { arrayRemove, arrayUnion, collection, deleteDoc, doc, getDoc, setDoc, updateDoc } from 'firebase/firestore'
import type { Group, Subject, UserProfile } from '../domain/types'
import { SUBJECTS } from '../domain/levels'
import { db } from './firebase'
import { api, caller, commit, compare, fail, now, recordOf, requireSchool, str } from './core'
import { useScopedRows } from './scope'
import { studentDoc } from './students'

function groupView<T extends Group>(group: T) {
  const studentIds = group.studentIds ?? []
  return {
    ...group,
    name: group.name ?? '',
    campus: group.campus ?? '',
    teacherName: group.teacherName ?? '',
    studentIds,
    studentCount: studentIds.length
  }
}
/** Live groups in the caller's schools, optionally limited to their own groups. */
export function useGroups(schoolId?: string, opts?: { mine?: boolean }) {
  const { data, loading, error } = useScopedRows<Group>('groups', schoolId, opts?.mine)
  return { groups: data.map(groupView).sort((a, b) => compare(a.name, b.name)), loading, error }
}
/** Loads a scoped group and checks ownership when editing. */
export async function groupDoc(p: UserProfile, id: string, editing = false) {
  const d = await getDoc(doc(db, 'groups', id))
  if (!d.exists()) fail(404, 'No encontramos el grupo.')
  await requireSchool(p, d.data().schoolId)
  if (editing && p.rol === 'docente' && p.uid !== d.data().teacherId) fail(403, 'Solo el docente del grupo puede editarlo.')
  return d
}
async function teacher(uid: string) {
  const d = await getDoc(doc(db, 'users', uid))
  if (!d.exists()) fail(404, 'No encontramos al docente.')
  return { teacherId: uid, teacherName: str(d.data().fullName) }
}
/** Creates a group with one owner and an empty membership list. */
export function createGroup(input: {
  name: string;
  subject: Subject;
  schoolId: string;
  campus: string;
  teacherId?: string
}) {
  return api(async () => {
    const p = await caller('writer'), name = str(input.name), { subject, schoolId } = input
    if (!name) fail(400, 'Escribe el nombre del grupo.')
    if (!SUBJECTS.includes(subject)) fail(400, 'La materia debe ser lectura o matemáticas.')
    await requireSchool(p, schoolId)
    const owner = p.rol === 'admin' && input.teacherId ? await teacher(input.teacherId) : { teacherId: p.uid, teacherName: p.fullName }
    const ref = doc(collection(db, 'groups')), timestamp = now()
    const data = {
      name,
      subject,
      schoolId,
      campus: str(input.campus),
      ...owner,
      studentIds: [] as string[],
      createdAt: timestamp,
      updatedAt: timestamp
    }
    const syncState = await commit(setDoc(ref, data))
    return groupView({ ...data, id: ref.id, syncState })
  })
}
/** Edits the group's name, campus or admin-assigned teacher. */
export function patchGroup(id: string, fields: Partial<Pick<Group, 'name' | 'campus' | 'teacherId'>>) {
  return api(async () => {
    const p = await caller('writer'), d = await groupDoc(p, id, true), changes: Partial<Group> = {}
    if ('name' in fields) {
      changes.name = str(fields.name);
      if (!changes.name) fail(400, 'Escribe el nombre del grupo.')
    }
    if ('campus' in fields) changes.campus = str(fields.campus)
    if ('teacherId' in fields && fields.teacherId !== d.data().teacherId) {
      if (p.rol !== 'admin') fail(403, 'Solo un administrador puede cambiar el docente del grupo.')
      Object.assign(changes, await teacher(str(fields.teacherId)))
    }
    if (!Object.keys(changes).length) fail(400, 'No hay cambios para guardar.')
    const syncState = await commit(updateDoc(d.ref, { ...changes, updatedAt: now() }))
    return groupView({ ...recordOf<Group>(d), ...changes, syncState })
  })
}
/** Deletes an owned group while preserving historical attendance. */
export function deleteGroup(id: string) {
  return api(async () => {
    const d = await groupDoc(await caller('writer'), id, true)
    return { id, deleted: true, syncState: await commit(deleteDoc(d.ref)) }
  })
}
/** Atomically adds same-school students, ignoring existing memberships. */
export function addStudentsToGroup(id: string, studentIds: string[]) {
  return api(async () => {
    const p = await caller('writer'), d = await groupDoc(p, id, true), group = groupView(recordOf<Group>(d))
    const ids = [...new Set(studentIds)]
    for (const sid of ids) {
      if (!sid) fail(400, 'Selecciona un estudiante.')
      if ((await studentDoc(p, sid)).data().schoolId !== group.schoolId) fail(400, 'El estudiante es de otra institución.')
    }
    const added = ids.filter(s => !group.studentIds.includes(s))
    if (!added.length) return group
    const syncState = await commit(updateDoc(d.ref, { studentIds: arrayUnion(...added), updatedAt: now() }))
    return groupView({ ...group, studentIds: [...group.studentIds, ...added], syncState })
  })
}
/** Removes one student without overwriting concurrent membership edits. */
export function removeStudentFromGroup(id: string, sid: string) {
  return api(async () => {
    const d = await groupDoc(await caller('writer'), id, true), group = groupView(recordOf<Group>(d))
    const syncState = await commit(updateDoc(d.ref, { studentIds: arrayRemove(sid), updatedAt: now() }))
    return groupView({ ...group, studentIds: group.studentIds.filter(s => s !== sid), syncState })
  })
}
