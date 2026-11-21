import { useMemo } from 'react'
import { collection, doc, getDoc, query, setDoc, where, type WriteBatch } from 'firebase/firestore'
import { ApiError, type ProgramConfig, type Role, type School, type UserProfile } from '../domain/types'
import { db } from './firebase'
import { api, caller, commit, compare, fail, requireDate, schoolsOf, slug, str } from './core'
import { batched, campusIds, provisionTeacher, schoolFields, shift, stringList } from './adminRecords'
import { listenMany, useLive, withSession } from './live'

/** Validates program dates and saves the implementation calendar. */
export function saveProgramConfig(input: ProgramConfig) {
  return api(async () => {
    await caller('admin')
    const start = requireDate(input.implementationStartDate, 'fecha de inicio')
    const breaks = (input.breaks ?? []).map(b => {
      const from = requireDate(b.from, 'fecha de inicio del receso'), to = requireDate(b.to, 'fecha final del receso')
      if (to < from) fail(400, 'Cada receso debe terminar después de empezar.')
      return { from, to, label: str(b.label) }
    })
    const config = {
      projectName: str(input.projectName) || 'ENAd',
      implementationStartDate: start,
      breaks,
      year: input.year ?? Number(start.slice(0, 4))
    }
    return { ...config, syncState: await commit(setDoc(doc(db, 'program', 'config'), config)) }
  })
}
/** Creates or updates a school and its embedded campuses. */
export function upsertSchool(input: Partial<School>) {
  return api(async () => {
    const p = await caller('admin'), id = str(input.id) || slug(str(input.name))
    if (!id) fail(400, 'Escribe el nombre de la institución.')
    const ref = doc(db, 'schools', id), before = await getDoc(ref)
    if (!input.id && before.exists()) fail(409, 'Ya existe una institución con ese identificador.')
    const fields = schoolFields({ ...input }, id, !before.exists(), p.projectId)
    if (!Object.keys(fields).length) fail(400, 'No hay cambios para guardar.')
    const syncState = await commit(setDoc(ref, fields, { merge: before.exists() }))
    return { ...before.data(), ...fields, id, syncState }
  })
}
/** Provisions a teacher without replacing the administrator's authenticated session. */
export function createTeacher(input: Record<string, unknown>) {
  return api(async () => {
    const p = await caller('admin')
    return provisionTeacher(p, input, new Set((await schoolsOf(p)).map(s => s.id)))
  })
}
/** Live admin directory, optionally restricted to one role. */
export function useUsers(role?: Role) {
  const source = useMemo(() => withSession<UserProfile[]>([], (p, next, error) => {
    if (p.rol !== 'admin') {
      error(new ApiError(403, 'Solo un administrador puede hacer este cambio.'));
      return () => { }
    }
    const users = collection(db, 'users')
    return listenMany<UserProfile & { id: string }>([role ? query(users, where('rol', '==', role)) : users], rows =>
      next(rows.map(r => ({ ...r, uid: r.id })).sort((a, b) => compare(a.fullName, b.fullName))), error)
  }), [role])
  const { data: users, loading, error } = useLive(source, [])
  return { users, loading, error }
}
/** Updates admin-editable fields and synchronizes the active docente directory. */
export function patchUser(uid: string, fields: Partial<UserProfile>) {
  return api(async () => {
    await caller('admin')
    const ref = doc(db, 'users', uid), snap = await getDoc(ref), before = snap.data()
    if (!before) fail(404, 'No encontramos el usuario.')
    const changes: Partial<UserProfile> = {}
    if ('activo' in fields) changes.activo = fields.activo === true
    if ('rol' in fields) {
      if (!['docente', 'coordinador', 'fundacion', 'admin'].includes(str(fields.rol))) fail(400, 'El rol no es válido.')
      changes.rol = fields.rol
    }
    if ('fullName' in fields) {
      changes.fullName = str(fields.fullName);
      if (!changes.fullName) fail(400, 'Escribe el nombre.')
    }
    if ('schoolIds' in fields) changes.schoolIds = stringList(fields.schoolIds)
    if ('regions' in fields) changes.regions = stringList(fields.regions)
    if ('campusIds' in fields) changes.campusIds = campusIds(fields.campusIds)
    if ('jornada' in fields) changes.jornada = shift(fields.jornada)
    if (!Object.keys(changes).length) fail(400, 'No hay cambios para guardar.')
    const after = { ...before, ...changes } as UserProfile
    const listed = (u: Record<string, unknown>) => new Set(u.rol === 'docente' && u.activo === true ? stringList(u.schoolIds) : [])
    const next = listed({ ...after }), ops: ((b: WriteBatch) => void)[] = [b => b.update(ref, { ...changes })]
    for (const id of listed(before)) if (!next.has(id)) ops.push(b => b.delete(doc(db, 'schools', id, 'teachers', uid)))
    for (const id of next) ops.push(b => b.set(doc(db, 'schools', id, 'teachers', uid), { uid, fullName: after.fullName ?? '', email: after.email ?? '' }))
    return { ...after, uid, syncState: await batched(ops) }
  })
}

/** Bulk-imports rows and records the admin audit entry. */
export { adminImport } from './adminImport'

export interface ImportReceipt { id: string; kind: string; rows: number; errors: number; created: number; by: string; at: string }
const importStream = withSession<ImportReceipt[]>([], (p,next,error) => {
  if (p.rol !== 'admin') {
    error(new ApiError(403,'Solo administración puede consultar las importaciones.'))
    return () => {}
  }
  return listenMany<ImportReceipt>([collection(db,'imports')], rows => next(rows.sort((a,b) => compare(b.at,a.at))),error)
})
export function useImportHistory() { return useLive(importStream,[]) }
