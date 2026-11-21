import { useMemo } from 'react'
import { collection, doc, onSnapshot, query, where, type QueryConstraint } from 'firebase/firestore'
import { ApiError, type ProgramConfig, type School, type UserProfile } from '../domain/types'
import { db } from './firebase'
import { compare, configOf, schoolQueries } from './core'
import { listenMany, useLive, withSession, type Stream } from './live'

const schoolStream = withSession<School[]>([], (p, next, error) => listenMany<School>(schoolQueries(p), schools =>
  next(schools.sort((a, b) => compare(a.name, b.name))), error))
/** Live school directory restricted to the caller's institutions or regions. */
export function useSchools() {
  const { data: schools, loading, error } = useLive(schoolStream, [])
  return { schools, loading, error }
}
const configStream = withSession<ProgramConfig | null>(null, (_p, next, error) =>
  onSnapshot(doc(db, 'program', 'config'), snap => next(snap.exists() ? configOf(snap) : null), error))
/** Watches the program calendar and its configured breaks. */
export function useProgramConfig() {
  const { data: config, loading, error } = useLive(configStream, null)
  return { config, loading, error }
}
/** School-scoped streams restart when the actual list of accessible schools changes. */
export function scopedRows<T>(path: string, schoolId?: string, constraints: (p: UserProfile) => QueryConstraint[] = () => []): Stream<T[]> {
  return withSession<T[]>([], (p, next, error, reset) => {
    let stopData: (() => void) | undefined
    let previous: string | undefined
    function select(ids: string[]) {
      const key = JSON.stringify(ids)
      if (previous === key) return
      previous = key
      stopData?.()
      reset()
      if (schoolId && !ids.includes(schoolId)) {
        error(new ApiError(403, 'No tienes acceso a esta institución.'))
        return
      }
      stopData = listenMany<T>(ids.map(id => query(collection(db, path), where('schoolId', '==', id), ...constraints(p))), next, error)
    }
    if (p.rol === 'docente' || (schoolId && p.rol !== 'coordinador')) {
      const ids = schoolId ? [schoolId] : [...new Set(p.schoolIds)]
      select(ids.filter(id => p.rol !== 'docente' || p.schoolIds.includes(id)))
      return () => stopData?.()
    }
    const stopSchools = listenMany<School>(schoolQueries(p), rows => select(rows.map(r => r.id).filter(id => !schoolId || id === schoolId)), e => {
      stopData?.();
      error(e)
    })
    return () => {
      stopSchools();
      stopData?.()
    }
  })
}
/** Memoizes the ordinary scoped collection subscription. */
export function useScopedRows<T>(path: string, schoolId?: string, mine = false) {
  const source = useMemo(() => scopedRows<T>(path, schoolId, p => mine ? [where('teacherId', '==', p.uid)] : []), [path, schoolId, mine])
  return useLive(source, [])
}
