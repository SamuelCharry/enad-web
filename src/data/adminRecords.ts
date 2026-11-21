import { getApps, initializeApp } from 'firebase/app'
import { createUserWithEmailAndPassword, getAuth, signOut as signOutSecondary } from 'firebase/auth'
import { doc, writeBatch, type WriteBatch } from 'firebase/firestore'
import type { Campus, Jornada, School, UserProfile } from '../domain/types'
import { db, firebaseConfig } from './firebase'
import { chunks, commit, fail, now, slug, str } from './core'

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
  if (create && !out.name) fail(400, 'Escribe el nombre de la institución.')
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
      if (name) campuses.push({ name, id: str(c.id) || id + '-' + slug(name), jornada: shift(str(c.jornada) || 'única') })
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
function token(length: number) {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789'
  const limit = 256 - 256 % alphabet.length
  let result = ''
  while (result.length < length) {
    const bytes = crypto.getRandomValues(new Uint8Array(length - result.length))
    for (const byte of bytes) if (byte < limit) result += alphabet[byte % alphabet.length]
  }
  return result
}
let provisioning: Promise<unknown> = Promise.resolve()
function createAccount(email: string, password: string) {
  const task = provisioning.then(async () => {
    const app = getApps().find(a => a.name === 'secondary') ?? initializeApp(firebaseConfig, 'secondary')
    const secondary = getAuth(app)
    try { return (await createUserWithEmailAndPassword(secondary, email, password)).user.uid }
    finally { await signOutSecondary(secondary) }
  })
  provisioning = task.catch(() => undefined)
  return task
}
/** Provisions an Auth account plus profile and school directory, preserving the admin session. */
export async function provisionTeacher(p: UserProfile, input: Fields, known: Set<string>) {
  const fullName = str(input.fullName)
  if (!fullName) fail(400, 'Escribe el nombre del docente.')
  const username = str(input.username).toLowerCase() || 'docente.' + token(10).toLowerCase()
  if (!str(input.email) && !/^[a-z0-9._-]+$/.test(username)) fail(400, 'El usuario solo puede tener letras, números, punto, guion y guion bajo.')
  const email = str(input.email).toLowerCase() || username + '@enad.app'
  const password = input.password == null ? token(16) : str(input.password)
  if (password.length < 6) fail(400, 'La contraseña debe tener al menos 6 caracteres.')
  const schoolIds = [...new Set(stringList(input.schoolIds ?? input.schoolId))]
  if (!schoolIds.length) fail(400, 'Selecciona al menos una institución.')
  for (const id of schoolIds) if (!known.has(id)) fail(400, 'La institución ' + id + ' no existe.')
  const jornada = shift(str(input.jornada) || 'única'), uid = await createAccount(email, password)
  const user = {
    rol: 'docente',
    activo: true,
    fullName,
    email,
    username: email.endsWith('@enad.app') ? email.split('@')[0] : username,
    schoolIds,
    campusIds: campusIds(input.campusIds),
    jornada,
    projectId: str(input.projectId) || str(p.projectId),
    regions: [],
    createdAt: now()
  }
  await batched([b => b.set(doc(db, 'users', uid), user), ...schoolIds.map(id => (b: WriteBatch) =>
    b.set(doc(db, 'schools', id, 'teachers', uid), { uid, fullName, email }))])
  return { username: email.endsWith('@enad.app') ? user.username : email, password }
}
