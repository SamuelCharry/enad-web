import { useMemo } from 'react'
import { collection, collectionGroup, deleteDoc, getDocs, doc, getDoc, query, limit, orderBy, documentId, startAfter, setDoc, where, type WriteBatch } from 'firebase/firestore'
import { ApiError, type ProgramConfig, type Role, type School, type UserProfile } from '../domain/types'
import { db } from './firebase'
import { api, caller, commit, requireSchool, compare, fail, requireDate, schoolsOf, slug, str } from './core'
import { batched, campusIds, provisionTeacher, schoolFields, shift, stringList } from './adminRecords'
import { listenMany, useLive, withSession } from './live'

/** Validates program dates and saves the implementation calendar. */
export function saveProgramConfig(input: ProgramConfig) {
  return api(async () => {
    await caller('fundacion')
    const start = requireDate(input.implementationStartDate, 'fecha de inicio')
    if (input.year !== Number(start.slice(0,4))) fail(400,'El año debe coincidir con la fecha de inicio.')
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
    const p = await caller('manager'), id = str(input.id) || slug(str(input.name))
    if (!id) fail(400, 'Escribe el nombre de la institución.')
    if (p.rol === 'coordinador') {
      await requireSchool(p, id)
      if (!input.id || Object.keys(input).some(k => !['id','name','campuses'].includes(k))) fail(403, 'Solo puedes editar el nombre y las sedes del colegio.')
    }
    const ref = doc(db, 'schools', id), before = await getDoc(ref)
    if (p.rol === 'coordinador' && !before.exists()) fail(403, 'El colegio debe existir.')
    if (!input.id && before.exists()) fail(409, 'Ya existe una institución con ese identificador.')
    if ((!before.exists() || input.campuses) && !input.campuses?.length) fail(400,'Añade al menos una sede.')
    const fields = schoolFields({ ...input }, id, !before.exists(), p.projectId)
    if (!Object.keys(fields).length) fail(400, 'No hay cambios para guardar.')
    const syncState = await commit(setDoc(ref, fields, { merge: before.exists() }))
    return { ...before.data(), ...fields, id, syncState }
  })
}
/** Provisions a teacher without replacing the operator's authenticated session. */
export function createTeacher(input: Record<string, unknown>) {
  return api(async () => {
    const p = await caller('fundacion')
    return provisionTeacher(p, input, new Set((await schoolsOf(p)).map(s => s.id)))
  })
}
/** Live admin directory, optionally restricted to one role. */
export function useUsers(role?: Role) {
  const source = useMemo(() => withSession<UserProfile[]>([], (p, next, error) => {
    if (p.rol === 'docente') {
      error(new ApiError(403, 'No tienes acceso al directorio de personas.'));
      return () => { }
    }
    const users = collection(db, 'users')
    const queries = p.rol === 'coordinador'
      ? p.schoolIds.map(id => query(users, where('rol', '==', 'docente'), where('schoolIds', 'array-contains', id)))
      : [role ? query(users, where('rol', '==', role)) : users]
    return listenMany<UserProfile & { id: string }>(queries, pages => {
      const rows = [...new Map(pages.map(row => [row.id, row])).values()]
      next(rows.map(r => ({ ...r, uid: r.id })).sort((a, b) => compare(a.fullName, b.fullName)))
    }, error)
  }), [role])
  const { data: users, loading, error } = useLive(source, [])
  return { users, loading, error }
}
/** Updates profile fields and synchronizes the active docente directory. */
export function patchUser(uid: string, fields: Partial<UserProfile>) {
  return api(async () => {
    const p = await caller('manager')
    const ref = doc(db, 'users', uid), snap = await getDoc(ref), before = snap.data()
    if (!before) fail(404, 'No encontramos el usuario.')
    if (p.rol === 'coordinador' && (before.rol !== 'docente' || !before.schoolIds?.length ||
      !before.schoolIds.every((id:string) => p.schoolIds.includes(id)) ||
      Object.keys(fields).some(k => !['fullName','campusIds','jornada','activo'].includes(k)) ||
      Object.keys(fields.campusIds ?? {}).some(id => !before.schoolIds.includes(id)))) fail(403, 'Solo puedes editar docentes de tu colegio.')
    if (p.uid === uid && fields.activo === false) fail(400,'Tu cuenta debe permanecer activa.')
    const changes: Partial<UserProfile> = {}
    if ('activo' in fields) changes.activo = fields.activo === true
    if ('rol' in fields) {
      if (!['docente', 'coordinador', 'fundacion'].includes(str(fields.rol))) fail(400, 'El rol no es válido.')
      changes.rol = fields.rol
    }
    if ('fullName' in fields) {
      changes.fullName = str(fields.fullName);
      if (!changes.fullName) fail(400, 'Escribe el nombre.')
    }
    if ('schoolIds' in fields) changes.schoolIds = stringList(fields.schoolIds)
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
export function useImportHistory(after?:{ at:string; id:string }) {
  const at=after?.at, id=after?.id
  const source=useMemo(() => withSession<ImportReceipt[]>([], (p,next,error) => {
    if (p.rol !== 'fundacion') {
      error(new ApiError(403,'Solo la fundación puede consultar las importaciones.'))
      return () => {}
    }
    const page=query(collection(db,'imports'),orderBy('at','desc'),orderBy(documentId(),'desc'),
      ...(at && id ? [startAfter(at,id)] : []),limit(21))
    return listenMany<ImportReceipt>([page],next,error)
  }),[at,id])
  return useLive(source,[])
}

export function removeSchool(id:string) {
  return api(async () => {
    await caller('fundacion')
    const dependencies = [
      ...['students','groups','hours'].map(path => query(collection(db,path),where('schoolId','==',id),limit(1))),
      ...['attendance','evaluations','plan'].map(path => query(collectionGroup(db,path),where('schoolId','==',id),...(path === 'plan' ? [orderBy('date')] : []),limit(1))),
      query(collection(db,'users'),where('schoolIds','array-contains',id),limit(1))
    ]
    if ((await Promise.all(dependencies.map(q => getDocs(q)))).some(s => !s.empty)) fail(409,'Este colegio tiene registros. Puedes marcarlo como inactivo.')
    await commit(deleteDoc(doc(db,'schools',id)))
  })
}
