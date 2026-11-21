import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { useSchoolEvaluations } from './evaluations'
import { saveGroupAttendance, useSchoolAttendance } from './attendance'
import type { AttendanceStatus, UserProfile } from '../domain/types'

const sdk = vi.hoisted(() => ({
  listen: vi.fn(), stop: vi.fn(), writeBatch: vi.fn(), groupDoc: vi.fn(),
  profile: { uid: 't', rol: 'docente', activo: true, schoolIds: ['assigned'] } as UserProfile,
}))
vi.mock('./firebase', () => ({ db: {}, auth: {} }))
vi.mock('./core', async original => ({
  ...await original<typeof import('./core')>(), caller: async () => sdk.profile,
}))
vi.mock('./groups', () => ({ groupDoc: sdk.groupDoc }))
vi.mock('./session', () => ({ watchSession(cb: (s: { profile: UserProfile }) => void) { cb({ profile:sdk.profile }); return () => {} } }))
vi.mock('firebase/firestore', () => ({
  collectionGroup: (_db: unknown, name: string) => name,
  orderBy:(...args:unknown[])=>args,limit:(n:number)=>n,query: (...args: unknown[]) => args, where: (...args: unknown[]) => args, onSnapshot: sdk.listen, writeBatch: sdk.writeBatch,
}))
beforeEach(() => { vi.clearAllMocks(); sdk.listen.mockReturnValue(sdk.stop) })
afterEach(() => vi.restoreAllMocks())
it('escucha la fecha e institución autorizadas y actualiza el comprobante cuando cambia solo la metadata', () => {
  const view = renderHook(() => useSchoolAttendance('assigned','2026-04-08'))
  expect(sdk.listen.mock.calls[0][0]).toEqual(['attendance',['schoolId','==','assigned'],['date','==','2026-04-08']])
  expect(sdk.listen.mock.calls[0][1]).toEqual({includeMetadataChanges:true})
  const receive = sdk.listen.mock.calls[0][2]
  for (const pending of [true,false]) {
    act(() => receive({ docs:[{ id:'g_2026-04-08',data:() => ({ studentId:'s', groupId:'g', status:'vino' }),metadata:{hasPendingWrites:pending} }] }))
    expect(view.result.current.data[0].syncState).toBe(pending ? 'pending' : 'synced')
  }
  view.unmount()
  expect(sdk.stop).toHaveBeenCalledOnce()
})
it('no abre consultas de asistencia o evaluación fuera de la institución asignada', () => {
  const view = renderHook(() => [useSchoolAttendance('other','2026-04-08'),useSchoolEvaluations('other','lectura','linea_base',['s'])])
  expect(sdk.listen).not.toHaveBeenCalled()
  expect(view.result.current.map(s => s.data)).toEqual([[],[]])
  view.unmount()
})
it('consulta evaluaciones con el índice de institución y área y cancela el área anterior', () => {
  const view = renderHook(({ math }) => useSchoolEvaluations('assigned',math ? 'matematicas' : 'lectura','linea_base',['s']),{ initialProps:{math:false} })
  view.rerender({math:true})
  expect(sdk.stop).toHaveBeenCalledOnce()
  expect(sdk.listen.mock.lastCall?.[0]).toEqual(['evaluations',['schoolId','==','assigned'],['studentId','==','s'],['subject','==','matematicas'],['moment','==','linea_base'],['savedAt','desc'],1])
  view.unmount()
})
it('rechaza una asistencia mayor a un lote antes de escribir cualquier retiro', async () => {
  const members = Array.from({length:201},(_,i) => String(i))
  sdk.groupDoc.mockResolvedValue({data:() => ({schoolId:'assigned',studentIds:members})})
  const marks: Record<string, AttendanceStatus> = Object.fromEntries(members.map(id => [id,'retirado']))
  await expect(saveGroupAttendance('g','2026-04-08',marks)).rejects.toMatchObject({status:400})
  expect(sdk.writeBatch).not.toHaveBeenCalled()
})
