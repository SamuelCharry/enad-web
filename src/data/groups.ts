import { runTransaction, arrayRemove, arrayUnion, collection, deleteDoc, doc, getDoc, setDoc, updateDoc, where, documentId } from 'firebase/firestore'
import type { Group, Subject, UserProfile } from '../domain/types'
import { SUBJECTS } from '../domain/levels'
import { db } from './firebase'
import { api, caller, reportCache, commit, compare, fail, now, recordOf, requireSchool, str } from './core'
import { scopedRows } from './scope'
import { useLive } from './live'
import { useMemo } from 'react'
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
export function useGroups(schoolId?: string, opts?: { mine?: boolean; campus?: string; campusName?: string; groupId?: string }) {
  const { mine, campus, campusName, groupId } = opts ?? {}
  const source = useMemo(() => scopedRows<Group>('groups',schoolId,p => [
    ...(mine ? [where('teacherId','==',p.uid)] : []),
    ...(campus !== undefined ? [where('campus','in',[...new Set([campus,campusName ?? campus])])] : []),
    ...(groupId ? [where(documentId(),'==',groupId)] : [])
  ]),[schoolId,mine,campus,campusName,groupId])
  const {data,loading,error}=useLive(source,[])
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
async function teacher(uid: string, schoolId: string) {
  const d = await getDoc(doc(db, 'users', uid))
  if (!d.exists()) fail(404, 'No encontramos al docente.')
  if (d.data().rol !== 'docente' || !d.data().activo || !d.data().schoolIds?.includes(schoolId)) fail(400, 'Selecciona un docente activo del colegio.')
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
    const owner = p.rol !== 'docente' ? await teacher(str(input.teacherId), schoolId) : { teacherId: p.uid, teacherName: p.fullName }
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
      if (p.rol === 'docente') fail(403, 'Solo coordinación o fundación puede cambiar el docente del grupo.')
      Object.assign(changes, await teacher(str(fields.teacherId), d.data().schoolId))
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

/** Both membership changes commit together and recheck the live source roster. */
export function moveMembers(from:string,into:string,ids:string[]) {
  return api(async () => {
    const p = await caller('manager')
    if (from === into || !ids.length) fail(400,'Selecciona estudiantes y otro grupo.')
    const sourceRef = doc(db,'groups',from), targetRef = doc(db,'groups',into)
    const stamp = now()
    const original = await runTransaction(db,async tx => {
      const [a,b] = await Promise.all([tx.get(sourceRef),tx.get(targetRef)])
      const source = a.data(), target = b.data()
      if (!source || !target || target.schoolId !== source.schoolId || target.subject !== source.subject) fail(400,'Selecciona un grupo del mismo colegio y área.')
      await requireSchool(p,source.schoolId)
      if (!ids.every(id => source.studentIds.includes(id))) fail(409,'Los integrantes cambiaron. Revisa la selección.')
      const added = ids.filter(id => !target.studentIds.includes(id))
      tx.update(sourceRef,{studentIds:arrayRemove(...ids),updatedAt:stamp})
      tx.update(targetRef,{studentIds:arrayUnion(...ids),updatedAt:stamp})
      return {added,schoolId:source.schoolId}
    })
    reportCache.clear()
    return () => api(async () => {
      const actor = await caller('manager')
      await requireSchool(actor,original.schoolId)
      await runTransaction(db,async tx => {
        const pair = await Promise.all([tx.get(sourceRef),tx.get(targetRef)])
        if (pair.some(g => g.data()?.updatedAt !== stamp || g.data()?.schoolId !== original.schoolId)) fail(409,'Los grupos cambiaron después del traslado.')
        const updatedAt = now()
        tx.update(sourceRef,{studentIds:arrayUnion(...ids),updatedAt})
        if (original.added.length) tx.update(targetRef,{studentIds:arrayRemove(...original.added),updatedAt})
      })
      reportCache.clear()
    })
  })
}
