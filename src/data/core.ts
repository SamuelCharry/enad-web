import { collection, doc, documentId, getDoc, getDocs, query, where, type DocumentSnapshot, type Query } from 'firebase/firestore'
import { ApiError, type ProgramConfig, type School, type UserProfile } from '../domain/types'
import { colombiaToday } from '../domain/weeks'
import { auth, db } from './firebase'

/** Reusable Spanish API failure at a domain boundary. */
export function fail(status: number, message: string): never { throw new ApiError(status, message) }
/** Trims values following the gateway's JSON conversion. */
export const str = (value: unknown) => String(value ?? '').trim()
/** ISO UTC timestamp for gateway writes. */
export const now = () => new Date().toISOString()
/** Uppercase identity component used in deterministic student IDs. */
export const normalizeCode = (value: string) => value.toUpperCase().replace(/[^A-Z0-9]/g, '')
/** Human-readable school and group ID component. */
export const slug = (value: string) => value.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
/** Checks a calendar date supplied by a form. */
export function requireDate(date: string, field = 'fecha') {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) fail(400, 'La ' + field + ' debe tener el formato AAAA-MM-DD.')
  const ms = Date.parse(date)
  if (!Number.isFinite(ms) || new Date(ms).toISOString().slice(0, 10) !== date) fail(400, 'La ' + field + ' no es válida.')
  return date
}
/** Whether a remote transaction can fall back to an offline batch. */
export function isOffline(error: unknown) {
  const code = (error as { code?: string } | null)?.code
  return code === 'unavailable' || code === 'deadline-exceeded'
}
/** Preserves gateway status codes and presents Firebase failures in Spanish. */
export function apiError(error: unknown) {
  if (error instanceof ApiError) return error
  const code = String((error as { code?: string } | null)?.code ?? '').replace(/^auth\//, '')
  const messages: Record<string, [number, string]> = {
    'permission-denied': [403, 'No tienes permiso para consultar o modificar estos datos.'],
    unauthenticated: [401, 'Inicia sesión para continuar.'],
    'not-found': [404, 'No encontramos el registro.'],
    'already-exists': [409, 'El registro ya existe.'],
    'resource-exhausted': [429, 'Se alcanzó el límite de uso por hoy. Intenta más tarde.'],
    'failed-precondition': [500, 'La consulta necesita un índice de Firestore que no está desplegado.'],
    'unavailable': [0, 'No pudimos conectar. Tus cambios quedan guardados en el dispositivo.'],
    'deadline-exceeded': [0, 'La conexión tardó demasiado. Intenta de nuevo.'],
    'email-already-in-use': [409, 'Ya existe una cuenta con ese usuario o correo.'],
    'weak-password': [400, 'La contraseña debe tener al menos 6 caracteres.'],
    'invalid-email': [400, 'El correo no es válido.'],
    'user-disabled': [403, 'Tu cuenta está desactivada. Contacta al administrador.'],
    'too-many-requests': [429, 'Demasiados intentos. Espera unos minutos e intenta de nuevo.'],
    'network-request-failed': [0, 'No pudimos conectar. Revisa tu conexión.'],
  }
  if (['invalid-credential', 'wrong-password', 'user-not-found', 'invalid-login-credentials'].includes(code)) return new ApiError(401, 'Usuario o contraseña incorrectos.')
  return new ApiError(...(messages[code] ?? [500, 'No se pudo completar la solicitud' + (code ? ' (' + code + ')' : '') + '.']))
}
/** Translates failures from the entire operation, including prerequisite reads. */
export async function api<T>(action: () => Promise<T>) {
  try { return await action() } catch (error) { throw apiError(error) }
}
/** Read the active profile, treating missing activity or roles as denied. */
export function profileOf(snap: DocumentSnapshot): UserProfile {
  const d = snap.data()
  if (!d) fail(403, 'Tu cuenta todavía no tiene perfil. Contacta al administrador.')
  if (d.activo !== true) fail(403, 'Tu cuenta está inactiva. Contacta al administrador.')
  if (!['docente', 'coordinador', 'admin', 'fundacion'].includes(d.rol)) fail(403, 'Tu cuenta no tiene un rol asignado. Contacta al administrador.')
  return {
    schoolIds: [],
    campusIds: {},
    regions: [],
    jornada: 'única',
    ...d,
    rol: d.rol,
    activo: true,
    fullName: str(d.fullName),
    email: str(d.email),
    uid: snap.id
  } as UserProfile
}
/** Current caller with the role needed by an operation. */
export async function caller(access?: 'writer' | 'admin') {
  const uid = auth.currentUser?.uid
  if (!uid) fail(401, 'Inicia sesión para continuar.')
  const p = profileOf(await getDoc(doc(db, 'users', uid)))
  if (auth.currentUser?.uid !== uid) fail(401, 'Inicia sesión para continuar.')
  if (access === 'admin' && p.rol !== 'admin') fail(403, 'Solo un administrador puede hacer este cambio.')
  if (access === 'writer' && !['admin', 'docente'].includes(p.rol)) fail(403, 'Tu rol solo permite consultar la información.')
  return p
}
/** Verifies the school scope of a document read or write. */
export async function requireSchool(p: UserProfile, id: string) {
  if (id && (p.rol === 'admin' || p.rol === 'fundacion' || (p.rol === 'docente' && p.schoolIds.includes(id)))) return
  if (id && p.rol === 'coordinador' && p.regions.includes((await getDoc(doc(db, 'schools', id))).data()?.region)) return
  fail(403, 'No tienes acceso a esta institución.')
}
/** Splits query operands and writes at the service limit. */
export function chunks<T>(values: T[], limit: number) {
  const result: T[][] = []
  for (let i = 0; i < values.length; i += limit) result.push(values.slice(i, i + limit))
  return result
}
/** Queries whose predicates prove access under the schools rules. */
export function schoolQueries(p: UserProfile): Query[] {
  const schools = collection(db, 'schools')
  if (p.rol === 'admin' || p.rol === 'fundacion') return [schools]
  const regional = p.rol === 'coordinador'
  return chunks([...new Set(regional ? p.regions : p.schoolIds)], 10)
    .map(ids => query(schools, where(regional ? 'region' : documentId(), 'in', ids)))
}
/** Converts a snapshot to the gateway JSON including local pending state. */
export function recordOf<T>(d: DocumentSnapshot) {
  return { ...d.data(), id: d.id, syncState: d.metadata.hasPendingWrites ? 'pending' : 'synced' } as T & { id: string; syncState: 'pending' | 'synced' }
}
/** Loads accessible schools sorted by name. */
export async function schoolsOf(p: UserProfile) {
  const pages = await Promise.all(schoolQueries(p).map(q => getDocs(q)))
  return pages.flatMap(page => page.docs.map(d => recordOf<School>(d))).sort((a, b) => compare(a.name, b.name))
}
/** Dart String.compareTo ordering. */
export const compare = (a: string, b: string) => a < b ? -1 : Number(a > b)
/** Uses the gateway's ENAd calendar when program/config is absent. */
export function configOf(d: DocumentSnapshot): ProgramConfig {
  const year = Number(colombiaToday().slice(0, 4))
  return { projectName: 'ENAd', year, implementationStartDate: year + '-01-01', breaks: [], ...d.data() }
}
/** Cached report promises shared by all accessors. */
export const reportCache = new Map<string, { expires: number; value: Promise<unknown> }>()
/** Bounded local write acknowledgement, with invalidation on enqueue and settlement. */
export async function commit(write: Promise<void>): Promise<'synced' | 'pending'> {
  reportCache.clear()
  let timer: ReturnType<typeof setTimeout> | undefined
  const ack = write.finally(() => reportCache.clear()).then(() => 'synced' as const)
  try {
    return await Promise.race([ack, new Promise<'pending'>(resolve => { timer = setTimeout(() => resolve('pending'), 1500) })])
  }
  finally { clearTimeout(timer) }
}
