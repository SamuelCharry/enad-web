import { trackSubmission, type Mutation } from './pending'
import { useMemo } from 'react'
import { collectionGroup, doc, onSnapshot, query, where, writeBatch } from 'firebase/firestore'
import type { AttendanceMark, AttendanceStatus } from '../domain/types'
import { db } from './firebase'
import { api, caller, chunks, fail, now, requireDate } from './core'
import { groupDoc } from './groups'
import { listenMany, useLive, withSession } from './live'

type DailyMark = AttendanceMark & { syncState?: 'pending' | 'synced' }

/** One school/date subscription shared by all group cards or the open attendance sheet. */
export function useSchoolAttendance(schoolId: string, date: string, groupIds?: string[]) {
  const keys = groupIds && JSON.stringify(groupIds)
  const source = useMemo(() => withSession<DailyMark[]>([], (p, next, error) => {
    if (p.rol !== 'docente' || !p.schoolIds.includes(schoolId) || !date) {
      next([])
      return () => {}
    }
    const pages = keys ? chunks<string>(JSON.parse(keys),30).map(ids => [where('groupId','in',ids)]) : [[]]
    return listenMany(pages.map(page => query(collectionGroup(db, 'attendance'), where('schoolId', '==', schoolId),
      where('date', '==', date), ...page)), next, error)
  }), [schoolId, date, keys])
  return useLive(source, [])
}
/** Watches group attendance on a calendar date using the deployed school/date index. */
export function useGroupAttendance(groupId: string, date: string): Record<string, AttendanceStatus> {
  const source = useMemo(() => withSession<Record<string, AttendanceStatus>>({}, (p, next, error) => {
    if (!groupId || !date) {
      next({});
      return () => { }
    }
    let live = true, stop: (() => void) | undefined
    void groupDoc(p, groupId).then(d => {
      if (!live) return
      stop = onSnapshot(query(collectionGroup(db, 'attendance'), where('schoolId', '==', d.data().schoolId), where('groupId','==',groupId), where('date', '==', date)),
        { includeMetadataChanges: true }, snap => next(Object.fromEntries(snap.docs.map(s => s.data()).filter(m => m.groupId === groupId).map(m => [m.studentId, m.status]))), error)
    }).catch(e => { if (live) error(e) })
    return () => {
      live = false;
      stop?.()
    }
  }), [groupId, date])
  return useLive(source, {}).data
}
/** Saves group marks, keeping each retirement and its student update atomic. */
export function saveGroupAttendance(groupId: string, date: string, marks: Record<string, AttendanceStatus>) {
  return api(async () => {
    const p = await caller('writer')
    requireDate(date)
    const entries = Object.entries(marks)
    if (!entries.length) fail(400, 'No hay marcas de asistencia para guardar.')
    const d = await groupDoc(p, groupId), members = new Set(d.data().studentIds as string[]), schoolId = String(d.data().schoolId)
    for (const [sid, status] of entries) {
      if (!members.has(sid)) fail(400, 'Hay estudiantes que no pertenecen a este grupo.')
      if (!['vino', 'no_vino', 'retirado'].includes(status)) fail(400, 'La asistencia debe ser vino, no_vino o retirado.')
    }
    const operations = entries.length + entries.filter(([, status]) => status === 'retirado').length
    if (operations > 400) fail(400, 'Esta lista supera el límite de 400 operaciones por guardado.')
    const batch = writeBatch(db)
    const writes: Mutation[] = []
    for (const [studentId, status] of entries) {
      const ref = doc(db, 'students', studentId), savedAt = now()
      const target = doc(ref,'attendance',groupId + '_' + date)
      const data = { groupId, date, status, teacherId:p.uid, savedAt, schoolId, studentId }
      writes.push({path:target.path,data})
      batch.set(target,data)
      if (status === 'retirado') writes.push({path:ref.path,data:{retired:true,updatedAt:savedAt},update:true})
      if (status === 'retirado') batch.update(ref, { retired: true, updatedAt: savedAt })
    }
    const syncState = await trackSubmission({uid:p.uid,schoolId,date,label:'Asistencia · ' + d.data().name,writes},() => batch.commit())
    return { groupId, date, saved: entries.length, syncState }
  })
}
