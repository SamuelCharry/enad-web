import { beforeEach, expect, it, vi } from 'vitest'
import type { UserProfile } from '../domain/types'
import { useImportHistory } from './admin'
import { renderHook } from '@testing-library/react'

const store = vi.hoisted(() => ({
  role: 'coordinador', queries: [] as { path: string; filters: { field: string; value: unknown }[] }[],
  callbacks: new Map<string, (rows: unknown[]) => void>(), stops: vi.fn()
}))
vi.mock('./firebase', () => ({ db: {} }))
vi.mock('firebase/firestore', async original => ({
  ...await original<typeof import('firebase/firestore')>(),
  collection: (_db: unknown, ...parts: string[]) => ({ path: parts.join('/'), filters: [] }),
  limit:(n:number)=>({n}),orderBy:(field:string)=>({field}),documentId:()=>"id",
  collectionGroup: (_db: unknown, path: string) => ({ path, filters: [] }),
  where: (field: string, _op: string, value: unknown) => ({ field, value }),
  query: (ref: { path: string }, ...filters: unknown[]) => ({ ...ref, filters }),
  onSnapshot: (q: { path: string; filters: { field: string; value: unknown }[] }, _opts: unknown, cb: (snapshot: unknown) => void) => {
    store.queries.push(q)
    const receive = (rows: unknown[]) => cb({ docs: rows.map((row, i) => ({ id: 'id' + i, data: () => row, metadata: { hasPendingWrites: false } })) })
    store.callbacks.set(q.path, receive)
    if (q.path === 'schools') receive([{ name: 'IE', region: 'Norte', campuses: [] }])
    else receive([])
    return store.stops
  }
}))
vi.mock('./session', () => ({
  watchSession: (cb: (s: unknown) => void) => {
    cb({ profile: { uid: 'p', activo: true, rol: store.role, regions: ['Norte'], schoolIds: [], fullName: 'Coordinación', email: 'p@example.test', campusIds: {}, jornada: 'única' } as UserProfile })
    return () => { }
  }
}))
beforeEach(() => { store.role = 'coordinador'; store.queries.length = 0; store.callbacks.clear(); vi.clearAllMocks() })
it('solo suscribe al historial de importación en administración', () => {
  const regional = renderHook(useImportHistory)
  expect(regional.result.current.error).toMatch(/administración/)
  regional.unmount()
  store.role = 'admin'
  const admin = renderHook(useImportHistory)
  expect(admin.result.current.data).toEqual([])
  expect(store.queries.map(q => q.path)).toEqual(['imports'])
  admin.unmount()
})
