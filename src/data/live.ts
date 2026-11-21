import { useEffect, useState } from 'react'
import { onSnapshot, type Query } from 'firebase/firestore'
import { apiError, recordOf } from './core'
import { watchSession } from './session'
import { ApiError, type UserProfile } from '../domain/types'

/** Common listener shape for scoped hooks. */
export type Stream<T> = (next: (value: T) => void, error: (e: unknown) => void, reset?: () => void) => (() => void)
/** Keeps old listeners and values from crossing filter or session boundaries. */
export function useLive<T>(source: Stream<T>, initial: T) {
  const [state, set] = useState<{ source: Stream<T>; data?: T; error?: string }>()
  useEffect(() => {
    let live = true
    let stop: (() => void) | undefined
    let timer: ReturnType<typeof setTimeout>
    function detach() {
      const unsubscribe = stop
      stop = undefined
      unsubscribe?.()
    }
    function fail(message:string) {
      if (!live) return
      live = false
      clearTimeout(timer)
      set({source,error:message})
      detach()
    }
    function arm() {
      clearTimeout(timer)
      timer = setTimeout(() => fail('No pudimos cargar los datos ahora. Intenta de nuevo en unos minutos.'),20_000)
    }
    arm()
    const receive = (data:T) => {
      if (live) { clearTimeout(timer); set({source,data}) }
    }
    try {
      stop = source(receive,e => fail(apiError(e).message),() => {
        if (live) { arm(); set(undefined) }
      })
      if (!live) detach()
    } catch (e) { fail(apiError(e).message) }
    return () => { live = false; clearTimeout(timer); detach() }
  }, [source])
  return state?.source === source ? { data: state.data ?? initial, error: state.error, loading: false } : { data: initial, loading: true, error: undefined }
}
/** Restarts child listeners on login, logout and role/scope changes. */
export function withSession<T>(empty: T, start: (p: UserProfile, next: (v: T) => void, error: (e: unknown) => void, reset: () => void) => () => void): Stream<T> {
  return (next, error, reset = () => next(empty)) => {
    let child: (() => void) | undefined
    const stop = watchSession(s => {
      child?.()
      child = undefined
      reset()
      if (s.loading) return
      if (s.error) {
        error(new ApiError(403, s.error));
        return
      }
      if (!s.profile) {
        next(empty);
        return
      }
      child = start(s.profile, next, error, reset)
    })
    return () => {
      child?.();
      stop()
    }
  }
}
/** Combines disjoint scoped snapshot queries after every partition has loaded. */
export function listenMany<T>(queries: Query[], next: (rows: T[]) => void, error: (e: unknown) => void) {
  let active = true
  const pages = new Map<number, T[]>()
  if (!queries.length) next([])
  const stops = queries.map((q, i) => onSnapshot(q, { includeMetadataChanges: true }, snap => {
    if (!active) return
    pages.set(i, snap.docs.map(d => recordOf<T>(d)))
    if (pages.size === queries.length) next(queries.flatMap((_, index) => pages.get(index) ?? []))
  }, e => {
    if (active) {
      active = false;
      error(e)
    }
  }))
  return () => {
    active = false;
    stops.forEach(stop => stop())
  }
}
