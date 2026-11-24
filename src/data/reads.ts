import { collection, collectionGroup, endAt, getAggregateFromServer, getCountFromServer, getDocs, limit, orderBy, query, startAfter, sum, where, type Query, type QueryConstraint } from 'firebase/firestore'
import { db } from './firebase'
import { chunks, recordOf } from './core'
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
  return (await getDocs(q)).docs.filter(d => !d.data().mergedInto).map(d => recordOf<T>(d))
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
export async function mapBatches<T, R>(items: T[], size: number, read: (item: T) => Promise<R>, signal?: AbortSignal) {
  const result: R[] = []
  for (const batch of chunks(items, size)) {
    signal?.throwIfAborted()
    result.push(...await Promise.all(batch.map(read)))
  }
  return result
}

export type SessionMark = AttendanceMark & { present: number; absent: number }
/** Split an ordered index at known keys. The open ends also cover historical
 * records whose student or group no longer appears in the directory. */
function splitKeys(size: number, keyAt: (i: number) => string[], minSize: number) {
  const stride = Math.max(minSize, Math.ceil(size / 30))
  const keys: string[][] = []
  for (let i = stride; i < size; i += stride) keys.push(keyAt(i - 1))
  return keys
}

async function distinctRows<T>(ordered: Query, splits: string[][], key: (row: T) => string[], signal?: AbortSignal) {
  const ranges = await Promise.all([...splits, undefined].map(async (end, i) => {
    const range = end ? query(ordered, endAt(...end)) : ordered
    let page = i ? query(range, startAfter(...splits[i - 1])) : range
    const result: T[] = []
    for (;;) {
      signal?.throwIfAborted()
      const [row] = await rows<T>(page)
      if (!row) return result
      result.push(row)
      const cursor = key(row)
      if (end?.length === cursor.length && end.every((v, i) => v === cursor[i])) return result
      page = query(range, startAfter(...cursor))
    }
  }))
  return ranges.flat()
}

export async function sessions(base: Query, from: string, to: string, groupIds: string[], signal?: AbortSignal): Promise<SessionMark[]> {
  const ordered = query(base, ...dates(from, to), orderBy('date'), orderBy('groupId'), orderBy('teacherId'), orderBy('savedAt', 'desc'))
  signal?.throwIfAborted()
  const maxRanges = await total(query(ordered, limit(30)))
  if (!maxRanges) return []
  const start = Date.parse(from), day = 86_400_000
  const days = 1 + (Date.parse(to) - start) / day
  const groupsPerDay = Math.max(1, groupIds.length)
  const slots = days * groupsPerDay
  const splits = splitKeys(slots, i => {
    const date = new Date(start + Math.floor(i / groupsPerDay) * day).toISOString().slice(0, 10)
    return groupIds.length ? [date, groupIds[i % groupsPerDay]] : [date]
  }, Math.ceil(slots / maxRanges))
  const marks = await distinctRows<AttendanceMark>(query(ordered, limit(1)), splits, m => [m.date, m.groupId, m.teacherId], signal)
  return mapBatches(marks, 30, async mark => ({
    ...mark, ...await attendanceTotals(query(base, equal('date', mark.date), equal('groupId', mark.groupId), equal('teacherId', mark.teacherId)))
  }), signal)
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
