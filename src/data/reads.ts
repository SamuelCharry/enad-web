import { collection, collectionGroup, getAggregateFromServer, getCountFromServer, getDocs, limit, orderBy, query, startAfter, sum, where, type Query, type QueryConstraint } from 'firebase/firestore'
import { db } from './firebase'
import { recordOf } from './core'
import type { AttendanceMark } from '../domain/types'

export const equal = (field: string, value: unknown) => where(field, '==', value)
export function dates(from: string, to: string) {
  return [where('date', '>=', from), where('date', '<=', to)]
}
export function scoped(path: string, schoolId: string, ...filters: QueryConstraint[]) {
  const source = path === 'attendance' || path === 'evaluations' ? collectionGroup(db, path) : collection(db, path)
  return query(source, equal('schoolId', schoolId), ...filters)
}
export async function rows<T>(q: Query) {
  return (await getDocs(q)).docs.map(d => recordOf<T>(d))
}
export async function total(q: Query) {
  return (await getCountFromServer(q)).data().count
}
export async function hoursTotal(q: Query) {
  return (await getAggregateFromServer(q, { planned: sum('plannedHours'), worked: sum('workedHours') })).data()
}
export async function attendanceTotals(q: Query) {
  const [present, absent] = await Promise.all(['vino', 'no_vino'].map(status => total(query(q, equal('status', status)))))
  return { present, absent }
}
export type SessionMark = AttendanceMark & { present: number; absent: number }
/** Seek past all marks of each group/teacher/day. A deleted group or a substitute
 * teacher still appears. Only one actual mark is downloaded per session. */
export async function sessions(base: Query, from: string, to: string, signal?: AbortSignal) {
  const ordered = query(base, ...dates(from, to), orderBy('date'), orderBy('groupId'), orderBy('teacherId'), orderBy('savedAt', 'desc'), limit(1))
  const result: SessionMark[] = []
  let page = ordered
  for (; ;) {
    signal?.throwIfAborted()
    const [mark] = await rows<AttendanceMark>(page)
    if (!mark) return result
    const totals = await attendanceTotals(query(base, equal('date', mark.date), equal('groupId', mark.groupId), equal('teacherId', mark.teacherId)))
    result.push({ ...mark, ...totals })
    page = query(ordered, startAfter(mark.date, mark.groupId, mark.teacherId))
  }
}

/** Older roster records may omit the flags. Only explicit retirement or
 * deactivation removes a student from enrollment. */
export async function enrollment(q: Query) {
  const [all, retired, inactive] = await Promise.all([
    total(q), total(query(q, equal('retired', true))), total(query(q, equal('active', false)))
  ])
  const both = retired && inactive ? await total(query(q, equal('retired', true), equal('active', false))) : 0
  return all - retired - inactive + both
}

/** Firestore has no COUNT DISTINCT. An inclusive week fits one IN query.
 * Seek past each studentId, including students removed from the current roster. */
export async function distinctPresent(schoolId: string, from: string, to: string, signal: AbortSignal) {
  const days: string[] = []
  for (let ms = Date.parse(from); ms <= Date.parse(to); ms += 86_400_000) days.push(new Date(ms).toISOString().slice(0, 10))
  const base = scoped('attendance', schoolId, equal('status', 'vino'), where('date', 'in', days), orderBy('studentId'), limit(1))
  let page = base, count = 0
  for (; ;) {
    signal.throwIfAborted()
    const [mark] = await rows<AttendanceMark>(page)
    if (!mark) return count
    count++
    page = query(base, startAfter(mark.studentId))
  }
}
