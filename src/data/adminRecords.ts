import { createAccount } from './functions'
import { writeBatch, type WriteBatch } from 'firebase/firestore'
import type { Campus, Jornada, School, UserProfile } from '../domain/types'
import { db } from './firebase'
import { chunks, commit, fail, slug, str } from './core'

type Fields = Record<string, unknown>
/** Validates the school shift. */
export function shift(value: unknown): Jornada {
  const s = str(value)
  if (s !== 'mañana' && s !== 'tarde' && s !== 'única') fail(400, 'La jornada debe ser mañana, tarde o única.')
  return s
}
/** Normalizes school fields shared by the manual editor and school imports. */
export function schoolFields(input: Fields, id: string, create: boolean, projectId?: string) {
  const out: Partial<School> = create ? { projectId: projectId ?? '', department: '', municipality: '', active: true, campuses: [] } : {}
  for (const k of ['name', 'region', 'department', 'municipality', 'projectId'] as const) if (k in input) out[k] = str(input[k])
  if ((create || 'name' in input) && !out.name) fail(400, 'Escribe el nombre de la institución.')
  if (create && !out.region) fail(400, 'Escribe la región de la institución.')
  if ('zone' in input || create) {
    const zone = str(input.zone).toLowerCase() || 'urbana'
    if (zone !== 'urbana' && zone !== 'rural') fail(400, 'La zona debe ser urbana o rural.')
    out.zone = zone
  }
  if ('active' in input) out.active = input.active !== false
  if ('campuses' in input) {
    const campuses: Campus[] = []
    for (const c of Array.isArray(input.campuses) ? input.campuses : []) {
      const name = str(c?.name)
      if (!name) fail(400,'Escribe el nombre de cada sede.')
      if (campuses.some(site => site.id === (str(c.id) || id + '-' + slug(name)))) fail(400,'Revisa las sedes repetidas.')
      campuses.push({ name, id: str(c.id) || id + '-' + slug(name), jornada: shift(str(c.jornada) || 'única') })
    }
    out.campuses = campuses
  }
  return out
}
/** Normalizes delimited import lists and already-decoded arrays. */
export function stringList(value: unknown): string[] {
  const list = Array.isArray(value) ? value : typeof value === 'string' ? value.split(/[,;|]/) : []
  return list.map(str).filter(Boolean)
}
/** Normalizes per-school campus assignments. */
export function campusIds(value: unknown): Record<string, string[]> {
  if (!value || typeof value !== 'object') return {}
  return Object.fromEntries(Object.entries(value).filter(([, ids]) => Array.isArray(ids)).map(([id, ids]) => [id, stringList(ids)]))
}
type Operation = (batch: WriteBatch) => void
/** Commits ordered directory or import operations in bounded batches. */
export async function batched(ops: Operation[]) {
  let state: 'pending' | 'synced' = 'synced'
  for (const page of chunks(ops, 400)) {
    const batch = writeBatch(db)
    page.forEach(op => op(batch))
    if (await commit(batch.commit()) === 'pending') state = 'pending'
  }
  return state
}
export function provisionTeacher(p: UserProfile, input: Fields, known: Set<string>) {
  const schoolIds = [...new Set(stringList(input.schoolIds ?? input.schoolId))]
  if (!schoolIds.length || schoolIds.some(id => !known.has(id))) fail(400, 'Selecciona un colegio asignado.')
  if (p.rol === 'docente') fail(403, 'No tienes permiso para crear cuentas.')
  const username = str(input.username || str(input.email).replace(/@enad\.app$/, '')).toLowerCase()
  return createAccount({ fullName: str(input.fullName), username, rol: 'docente', schoolIds,
    campusIds: campusIds(input.campusIds), jornada: shift(input.jornada || 'única') })
}
