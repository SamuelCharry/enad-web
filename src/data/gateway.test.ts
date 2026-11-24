import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { createStudent, importStudents, patchStudent, useStudents } from './students'
import { correctRecord } from './corrections'
import { saveEvaluation } from './evaluations'
import { saveGroupAttendance } from './attendance'
import { saveHours } from './hours'
import { planToday } from './activities'
import { readEntities } from './downloads'
import { moveMembers, patchGroup } from './groups'
import { adminImport, createTeacher, patchUser } from './admin'
import { getSummary } from './reports'
import { commit, reportCache } from './core'
import { updateMyName } from './profile'
import { useSchools } from './scope'
import { signIn } from './session'

// Only this in-memory SDK is loaded. No Firebase app or network transport is initialized.
const mem = vi.hoisted(() => {
  type Data = Record<string, unknown>
  type Ref = { path: string; id: string; group?: boolean; filters?: { field: string; op: string; value: unknown }[] }
  const docs = new Map<string, Data>(), reads: Ref[] = [], batches: { path: string; data: Data; action: string }[][] = []
  const auth = { currentUser: { uid: 't' } }, secondary = { name: 'secondary' }
  const ref = (path: string): Ref => ({ path, id: path.split('/').at(-1) ?? '' })
  function child(parent: Ref, ...parts: string[]) {
    return ref([parent.path, ...(parts.length ? parts : ['auto-' + ++counter])].filter(Boolean).join('/'))
  }
  let counter = 0, rejectNext = false
  function snapshot(r: Ref) {
    const data = docs.get(r.path)
    return { id: r.id, ref: r, data: () => data, exists: () => data !== undefined, metadata: { hasPendingWrites: false } }
  }
  function page(q: Ref) {
    reads.push(q)
    return {
      docs: [...docs].filter(([path, d]) => {
        const parts = path.split('/')
        if ((q.group ? parts.at(-2) : parts.slice(0, -1).join('/')) !== q.path) return false
        return (q.filters ?? []).every(f => {
          const value = f.field === '__name__' ? parts.at(-1) : d[f.field]
          if (f.op === 'array-contains') return Array.isArray(value) && value.includes(f.value)
          if (f.op === 'order') return value !== undefined
          if (f.op === 'in') return (f.value as unknown[]).includes(value)
          if (f.op === '>=') return String(value) >= String(f.value)
          if (f.op === '<=') return String(value) <= String(f.value)
          return value === f.value
        })
      }).map(([path]) => snapshot(ref(path)))
    }
  }
  function update(r: Ref, changes: Data) {
    const data = { ...docs.get(r.path) }
    for (const [key, value] of Object.entries(changes)) {
      const [field, sub] = key.split('.')
      const op = value as {operation?:string;ids?:string[]} | undefined
      if (op?.operation && op.ids) {
        const ids = Array.isArray(data[field]) ? data[field] as string[] : []
        data[field] = op.operation==='union' ? [...new Set([...ids,...op.ids])] : ids.filter(id => !op.ids!.includes(id))
      }
      else if (sub) data[field] = { ...(data[field] as Data), [sub]: value }
      else data[key] = value
    }
    docs.set(r.path, data)
  }
  function batch() {
    const ops: { path: string; data: Data; action: string }[] = []
    return {
      set: (r: Ref, data: Data) => ops.push({ path: r.path, data, action: 'set' }),
      update: (r: Ref, data: Data) => ops.push({ path: r.path, data, action: 'update' }),
      delete: (r: Ref) => ops.push({ path: r.path, data: {}, action: 'delete' }),
      commit: async () => {
        batches.push(ops)
        if (rejectNext) {
          rejectNext = false;
          throw { code: 'aborted' }
        }
        for (const op of ops) {
          if (op.action === 'delete') docs.delete(op.path)
          else if (op.action === 'set') docs.set(op.path, op.data)
          else update(ref(op.path), op.data)
        }
      },
    }
  }
  const listeners = new Set<() => void>()
  const onSnapshot = vi.fn((r: Ref, options: unknown, success?: unknown) => {
    const callback = (typeof options === 'function' ? options : success) as (s: unknown) => void
    const notify = () => callback(r.filters || r.path.split('/').length % 2 ? page(r) : snapshot(r))
    listeners.add(notify)
    notify()
    return () => listeners.delete(notify)
  })
  const fs = {
    arrayUnion:(...ids:string[]) => ({operation:'union',ids}),
    arrayRemove:(...ids:string[]) => ({operation:'remove',ids}),
    doc: child, collection: child, collectionGroup: (_: Ref, name: string) => ({ ...ref(name), group: true }),
    documentId: () => '__name__', where: (field: string, op: string, value: unknown) => ({ field, op, value }),
    query: (r: Ref, ...filters: NonNullable<Ref['filters']>) => ({ ...r, filters:[...(r.filters ?? []),...filters] }), getDocs: async (r: Ref) => page(r), getDoc: async (r: Ref) => snapshot(r),
    orderBy:(field:string)=>({field,op:'order'}),limit:(value:number)=>({field:'',op:'limit',value}),startAfter:(value:string)=>({field:'studentId',op:'after',value}),
    getCountFromServer:async (q:Ref) => ({data:() => ({count:page(q).docs.length})}),
    sum:(field:string)=>field,
    getAggregateFromServer:async(q:Ref, fields:Record<string,string>) => {
      const docs = page(q).docs
      return {data:()=>Object.fromEntries(Object.entries(fields).map(([alias,field])=>[alias,docs.reduce((n,d)=>n+Number(d.data()?.[field] ?? 0),0)]))}
    },
    onSnapshot, writeBatch: batch, setDoc: async (r: Ref, d: Data) => { docs.set(r.path, d) }, updateDoc: async (r: Ref, d: Data) => update(r, d),
    runTransaction: async (_db: unknown, fn: (tx: unknown) => Promise<unknown>) => {
      const tx = batch(), result = await fn({ ...tx, get: async (r: Ref) => snapshot(r) })
      await tx.commit()
      return result
    }
  }
  return {
    docs, auth, secondary, fs, batches, reads, listeners, ref, failBatch: () => { rejectNext = true },
    createAccount: vi.fn(async (_auth: unknown, _email: string, _pass: string) => ({ user: { uid: 'new' } })), logout: vi.fn(async () => { }),
    login: vi.fn(async () => { }), init: vi.fn(() => secondary)
  }
})
vi.mock('./functions',() => ({createAccount:vi.fn(async (input:{username:string}) => ({uid:'new',username:input.username,password:'test-only'}))}))
vi.mock('./firebase', () => ({ auth: mem.auth, db: mem.ref(''), firebaseConfig: {} }))
vi.mock('firebase/firestore', () => mem.fs)
vi.mock('firebase/app', () => ({ initializeApp: mem.init, getApps: () => [] }))
vi.mock('firebase/auth', () => ({
  getAuth: () => mem.secondary, createUserWithEmailAndPassword: mem.createAccount, signOut: mem.logout, signInWithEmailAndPassword: mem.login,
  onAuthStateChanged: (_auth: unknown, cb: (user: { uid: string }) => void) => {
    cb(mem.auth.currentUser);
    return () => { }
  },
}))
beforeEach(() => {
  mem.auth.currentUser.uid = 't'
  mem.docs.clear()
  mem.batches.length = 0
  mem.reads.length = 0
  reportCache.clear()
  vi.clearAllMocks()
  vi.spyOn(Date, 'now').mockReturnValue(Date.UTC(2026, 10, 19, 15))
  mem.docs.set('users/t', { rol: 'docente', activo: true, fullName: 'Diana', email: 't@enad.app', schoolIds: ['s'] })
  mem.docs.set('users/fundacion', { rol: 'fundacion', activo: true, fullName: 'Fundación', schoolIds: [] })
  mem.docs.set('schools/s', { name: 'Institución', region: 'Caldas', campuses: [] })
  mem.docs.set('schools/otra', { name: 'Otra', region: 'Antioquia', campuses: [] })
  mem.docs.set('program/config', { year: 2026, projectName: 'ENAd', implementationStartDate: '2026-09-09', breaks: [] })
  mem.docs.set('students/s_A', { fullName: 'Ana', schoolId: 's', grade: 4, sample: 1, levels: {}, retired: false, active: true })
  mem.docs.set('groups/g', { schoolId: 's', name: 'Grupo', subject: 'lectura', teacherId: 't', studentIds: ['s_A'] })
})
afterEach(() => { vi.restoreAllMocks() })
it('deniega instituciones ajenas, roles de lectura, perfiles inactivos y cambios de identidad', async () => {
  await expect(importStudents('otra', [{ code: '1', grade: 4, fullName: 'Ana' }])).rejects.toMatchObject({ status: 403 })
  await expect(patchStudent('s_A', { fullName: 'Cambio' })).rejects.toMatchObject({ status: 403 })
  mem.docs.set('groups/g', { schoolId: 's', teacherId: 'otro' })
  await expect(patchGroup('g', { name: 'Cambio' })).rejects.toMatchObject({ status: 403 })
  mem.docs.set('users/t', { rol: 'coordinador', activo: true, regions: ['Caldas'] })
  await expect(getSummary({ schoolId: 'otra' })).rejects.toMatchObject({ status: 403 })
  await expect(saveGroupAttendance('g', '2026-11-17', { s_A: 'vino' })).rejects.toMatchObject({ status: 403 })
  mem.docs.set('users/t', { rol: 'docente', schoolIds: ['s'] })
  await expect(updateMyName('Nombre')).rejects.toMatchObject({ status: 403 })
  expect(mem.batches).toHaveLength(0)
})
it('reutiliza el identificador provisional y no sobrescribe códigos existentes al importar', async () => {
  const input = { schoolId: 's', grade: 3, fullName: '  Ana  Muñoz ', clientId: 'c-123' }
  const s = await createStudent(input)
  expect(s).toMatchObject({ id: 's_P_C123', code: 'P-0C123', nameKey: 'ana munoz', fullName: 'Ana Muñoz', provisional: true })
  expect(await createStudent(input)).toMatchObject({ id: s.id })
  await patchStudent(s.id, { grade: 5 })
  mem.batches.length = 0
  mem.auth.currentUser.uid = 'fundacion'
  const rows = Array.from({ length: 403 }, (_, i) => ({ code: 'b-' + i, grade: 3, fullName: 'Estudiante' }))
  const result = await importStudents('s', [...rows, { code: 'B0', grade: 4, fullName: 'Otro' }])
  expect(result.skipped).toEqual(['B0'])
  expect(result.created).toHaveLength(403)
  expect(mem.batches.map(b => b.length)).toEqual([400, 3])
  expect((await importStudents('s', rows)).created).toHaveLength(0)
})
it('valida el grupo antes de escribir y mantiene el retiro en el mismo lote que la marca', async () => {
  await expect(saveGroupAttendance('g', '2026-11-17', { s_A: 'vino', otro: 'vino' })).rejects.toMatchObject({ status: 400 })
  expect(mem.batches).toHaveLength(0)
  const receipt = await saveGroupAttendance('g', '2026-11-17', { s_A: 'retirado' })
  expect(receipt).toMatchObject({ saved: 1, syncState: 'synced' })
  expect(mem.batches[0].map(w => w.path)).toEqual(['students/s_A/attendance/g_2026-11-17', 'students/s_A'])
  expect(mem.docs.get('students/s_A/attendance/g_2026-11-17')).toMatchObject({ groupId: 'g', schoolId: 's', studentId: 's_A', teacherId: 't', date: '2026-11-17', status: 'retirado' })
  expect(mem.docs.get('students/s_A')?.retired).toBe(true)
})
it('reintenta la evaluación con el mismo UUID y nunca baja el momento del nivel actual', async () => {
  const input = { studentId: 's_A', subject: 'lectura', moment: 'linea_final', level: 'cuento', groupId: 'g' } as const
  mem.failBatch()
  await expect(saveEvaluation(input)).rejects.toMatchObject({ status: 500 })
  const receipt = await saveEvaluation(input)
  const path = 'students/s_A/evaluations/' + receipt.id
  expect(mem.batches[0][0].path).toBe(path)
  expect(mem.docs.get(path)).toMatchObject({ teacherId: 't', studentId: 's_A', schoolId: 's', groupId: 'g', sample: 1 })
  for (const moment of ['linea_base', 'verificacion'] as const) await saveEvaluation({ ...input, moment, level: 'letra' })
  expect(mem.docs.get('students/s_A')).toMatchObject({ sample: 1, levels: { lectura: { moment: 'linea_final', level: 'cuento' } } })
})
it('permite evaluar a un estudiante provisional sin edad o muestra', async () => {
  const student = {schoolId:'s', fullName:'Ana Paz', provisional:true, levels:{}}
  mem.docs.set('students/s_A',student)
  const result = await saveEvaluation({studentId:'s_A',subject:'lectura',moment:'linea_base',level:'letra'})
  expect(mem.docs.get('students/s_A/evaluations/'+result.id)?.sample).toBeNull()
  expect(mem.docs.get('students/s_A')).not.toHaveProperty('age')
  expect(mem.docs.get('students/s_A')).not.toHaveProperty('sample')
})
it('usa la clave compuesta para horas e invalida los reportes después de escribir', async () => {
  expect((await getSummary({})).hoursWorked).toBe(0)
  const reads = mem.reads.length
  await getSummary({})
  expect(mem.reads).toHaveLength(reads)
  const input = { schoolId: 's', date: '2026-11-17', plannedHours: 4, workedHours: 2 }
  await expect(saveHours(input)).rejects.toMatchObject({ status: 400 })
  await saveHours({ ...input, reason: 'Salud: cita médica' })
  expect(mem.docs.get('hours/t_s_2026-11-17')).toMatchObject({ ...input, week: 11, teacherId: 't' })
  expect((await getSummary({})).hoursWorked).toBe(2)
  expect(mem.reads.filter(r => r.path === 'attendance').every(q => q.filters?.some(f => f.field === 'schoolId' && f.value === 's'))).toBe(true)
})
it('crea cuentas por función y sincroniza la agenda al desactivar', async () => {
  mem.auth.currentUser.uid = 'fundacion'
  const fields = {username:'docente.nueva',fullName:'Diana',schoolIds:['s'],campusIds:{s:['s1']}}
  const result = await createTeacher(fields)
  expect(result.username).toBe(fields.username)
  expect(mem.auth.currentUser.uid).toBe('fundacion')
  mem.docs.set('users/new',{...fields,rol:'docente',activo:true,email:'docente.nueva@enad.app'})
  mem.docs.set('schools/s/teachers/new',{uid:'new',fullName:'Diana',email:'docente.nueva@enad.app'})
  await patchUser('new', { activo: false })
  expect(mem.docs.has('schools/s/teachers/new')).toBe(false)
  await signIn(' DOCENTE.NUEVA ', 'clave')
  expect(mem.login).toHaveBeenCalledWith(mem.auth, 'docente.nueva@enad.app', 'clave')
})
it('importa instituciones y momentos históricos con auditoría y errores por fila', async () => {
  mem.auth.currentUser.uid = 'fundacion'
  const school = { name: 'IE Núñez', region: 'Caldas', campus: 'Centro' }
  expect(await adminImport('schools', [school, { ...school, campus: 'Norte' }])).toMatchObject({ created: 1, skipped: 0, errors: [] })
  expect(mem.docs.get('schools/ie-nunez')?.campuses).toHaveLength(2)
  const assessment = { schoolId: 's', code: 'a', subject: 'lectura', moment: 'linea_final', level: 'cuento' }
  const outcome = await adminImport('evaluations', [assessment, { ...assessment, moment: 'linea_base', level: 'letra' }, { ...assessment, code: 'missing' }])
  expect(outcome).toMatchObject({ created: 2, skipped: 0, errors: [{ row: 3, message: 'No encontramos al estudiante con ese código.' }] })
  expect(mem.docs.get('students/s_A/evaluations/imp_lectura_linea_final')).toMatchObject({ teacherId: 'fundacion', sample: 1, level: 'cuento' })
  expect(mem.docs.get('students/s_A')?.levels).toMatchObject({ lectura: { moment: 'linea_final', level: 'cuento' } })
  expect([...mem.docs].filter(([path]) => path.startsWith('imports/')).map(([, v]) => v.errors)).toEqual([0, 1])
})
it('refleja cambios remotos y cancela los listeners de Auth, perfil y escuela al desmontar', async () => {
  const hook = renderHook(() => useStudents('s'))
  await waitFor(() => expect(hook.result.current.students.map(s => s.fullName)).toEqual(['Ana']))
  mem.docs.set('students/s_A', { ...mem.docs.get('students/s_A'), fullName: 'Ana María' })
  act(() => { for (const notify of [...mem.listeners]) notify() })
  await waitFor(() => expect(hook.result.current.students[0].fullName).toBe('Ana María'))
  mem.docs.set('users/t', { rol: 'docente', activo: false })
  act(() => { for (const notify of [...mem.listeners]) notify() })
  await waitFor(() => expect(hook.result.current.students).toEqual([]))
  expect(hook.result.current.error).toContain('inactiva')
  hook.unmount()
  expect(mem.listeners.size).toBe(0)
})

it('vence la caché a los diez minutos y la separa por usuario y filtros', async () => {
  const start = Date.now()
  const initial = await getSummary({})
  mem.docs.set('students/s_B', { schoolId: 's', active: true })
  vi.mocked(Date.now).mockReturnValue(start + 599999)
  expect(await getSummary({})).toEqual(initial)
  expect((await getSummary({ schoolId: 's' })).students).toBe(2)
  vi.mocked(Date.now).mockReturnValue(start + 600000)
  expect((await getSummary({})).students).toBe(2)
  mem.auth.currentUser.uid = 'fundacion'
  expect((await getSummary({})).schools).toBe(2)
})
it('limita las consultas regionales a diez valores y cancela cada partición', async () => {
  const schoolIds = ['s', ...Array.from({ length: 22 }, (_, i) => 'R' + i)]
  mem.docs.set('users/t', { rol: 'coordinador', activo: true, schoolIds })
  const hook = renderHook(() => useSchools())
  await waitFor(() => expect(hook.result.current.schools.map(s => s.id)).toEqual(['s']))
  const clauses = mem.reads.filter(q => q.path === 'schools').flatMap(q => q.filters ?? [])
  expect(clauses.every(f => f.field === '__name__' && f.op === 'in')).toBe(true)
  expect(clauses.map(f => (f.value as string[]).length)).toEqual([10, 10, 3])
  hook.unmount()
  expect(mem.listeners.size).toBe(0)
})
it('devuelve un recibo pendiente tras 1,5 segundos y limpia el caché al confirmar', async () => {
  vi.useFakeTimers()
  try {
    let acknowledge!: () => void
    const write = new Promise<void>(resolve => { acknowledge = resolve })
    const receipt = commit(write)
    await vi.advanceTimersByTimeAsync(1500)
    expect(await receipt).toBe('pending')
    reportCache.set('pending', { expires: Infinity, value: Promise.resolve({}) })
    acknowledge()
    await vi.advanceTimersByTimeAsync(0)
    expect(reportCache.size).toBe(0)
  } finally { vi.useRealTimers() }
})

it('revalida el alcance por colegio aunque un reporte esté en caché', async () => {
  mem.docs.set('users/t', { activo: true, rol: 'coordinador', schoolIds: ['s'] })
  expect((await getSummary({})).students).toBe(1)
  mem.docs.set('users/t', { activo: true, rol: 'coordinador', schoolIds: [] })
  expect((await getSummary({})).schools).toBe(0)
  await expect(getSummary({ schoolId: 's' })).rejects.toMatchObject({ status: 403 })
})

it('keeps failed submissions per account and retries the original record', async () => {
  const {usePending,retrySubmission} = await import('./pending')
  const mine = renderHook(() => usePending('t'))
  const other = renderHook(() => usePending('another'))
  mem.failBatch()
  await act(async () => {
    await expect(saveGroupAttendance('g','2026-11-15',{s_A:'vino'})).rejects.toHaveProperty('status')
  })
  const ticket = mine.result.current.find(t => t.date === '2026-11-15')
  expect(ticket?.failed).toBeTruthy()
  expect(other.result.current).toHaveLength(0)
  await act(async () => { await retrySubmission(ticket!) })
  expect(mine.result.current.find(t => t.key === ticket?.key)).toBeUndefined()
  expect(mem.docs.has('students/s_A/attendance/g_2026-11-15')).toBe(true)
  mine.unmount()
  other.unmount()
})

it('corrige el registro original, comprueba su versión y conserva el autor', async () => {
  const record = {id:'t_s_2026-11-10',schoolId:'s',teacherId:'t',date:'2026-11-10',week:9,plannedHours:2,workedHours:2,reason:null,savedAt:'2026-11-10T12:00:00Z'}
  const correction = {kind:'hours',record,planned:2,worked:1.5,reason:'Salud: cita'} as const
  const path = 'hours/'+record.id
  mem.docs.set(path,record)
  await expect(correctRecord(correction)).rejects.toMatchObject({status:403})
  mem.auth.currentUser.uid = 'fundacion'
  await correctRecord(correction)
  expect(mem.docs.get(path)).toMatchObject({workedHours:1.5,teacherId:'t',schoolId:'s',reason:'Salud: cita'})
  await expect(correctRecord(correction)).rejects.toMatchObject({status:409})
})
it('mantiene el último nivel al corregir una evaluación anterior',async () => {
  mem.auth.currentUser.uid = 'fundacion'
  const record = {id:'e',subject:'lectura',moment:'linea_base',level:'letra',sample:null,teacherId:'t',date:'2026-09-01',schoolId:'s',studentId:'s_A',savedAt:'2026-09-01T13:00:00Z'} as const
  const path = 'students/s_A/evaluations/e'
  mem.docs.set(path,record)
  mem.docs.set('students/s_A',{schoolId:'s',levels:{lectura:{moment:'linea_final',level:'cuento'}}})
  await correctRecord({kind:'evaluations',record,level:'palabra'})
  expect(mem.docs.get(path)).toMatchObject({level:'palabra',teacherId:'t'})
  expect(mem.docs.get('students/s_A')?.levels).toEqual({lectura:{moment:'linea_final',level:'cuento'}})
})
it('conserva una asistencia más reciente al reintentar un retiro fallido',async () => {
  const {usePending,retrySubmission} = await import('./pending')
  const mine = renderHook(() => usePending('t'))
  mem.failBatch()
  await act(async () => { await expect(saveGroupAttendance('g','2026-11-10',{s_A:'retirado'})).rejects.toHaveProperty('status') })
  const ticket = mine.result.current.find(t => t.date==='2026-11-10')!
  const path = ticket.writes[0].path
  mem.docs.set(path,{...ticket.writes[0].data,status:'vino',savedAt:'2099-01-01T00:00:00Z'})
  await act(async () => { await retrySubmission(ticket) })
  expect(mem.docs.get(path)?.status).toBe('vino')
  expect(mem.docs.get('students/s_A')?.retired).toBe(false)
  mine.unmount()
})

it('sincroniza la ficha y el directorio cuando coordinación desactiva un docente',async () => {
  mem.docs.set('users/c',{rol:'coordinador',activo:true,schoolIds:['s']})
  mem.auth.currentUser.uid = 'c'
  await patchUser('t',{activo:false})
  expect(mem.batches.at(-1)?.map(w => [w.path,w.action])).toEqual([['users/t','update'],['schools/s/teachers/t','delete']])
  await patchUser('t',{activo:true,fullName:'Diana Paz'})
  expect(mem.docs.get('schools/s/teachers/t')).toEqual({uid:'t',fullName:'Diana Paz',email:'t@enad.app'})
})

it('traslada estudiantes y deshace solo las pertenencias que se añadieron',async () => {
  mem.auth.currentUser.uid = 'fundacion'
  const group = {schoolId:'s',subject:'lectura'}
  mem.docs.set('groups/g',{...group,studentIds:['a','b']})
  mem.docs.set('groups/h',{...group,studentIds:['a','c']})
  const undo = await moveMembers('g','h',['a','b'])
  expect(mem.docs.get('groups/g')?.studentIds).toEqual([])
  expect(mem.docs.get('groups/h')?.studentIds).toEqual(['a','c','b'])
  await undo()
  expect(mem.docs.get('groups/g')?.studentIds).toEqual(['a','b'])
  expect(mem.docs.get('groups/h')?.studentIds).toEqual(['a','c'])
})
it('reemplaza el plan de hoy del grupo en el mismo documento',async () => {
  mem.docs.set('activities/a',{active:true,title:'Leer en parejas'})
  mem.docs.set('activities/b',{active:true,title:'Contar palabras'})
  await planToday('g','a')
  await planToday('g','b')
  const plans = [...mem.docs].filter(([path]) => path.startsWith('groups/g/plan/'))
  expect(plans).toHaveLength(1)
  const [path,data] = plans[0]
  expect(path).toBe('groups/g/plan/'+data.date)
  expect(data).toMatchObject({schoolId:'s',teacherId:'t',activityId:'b',activityTitle:'Contar palabras'})
  mem.docs.set('groups/g',{schoolId:'s',teacherId:'another'})
  await expect(planToday('g','a')).rejects.toMatchObject({status:403})
})
it('limita las descargas de coordinación a sus colegios e incluye solo las asignaciones visibles',async () => {
  mem.docs.set('users/c',{rol:'coordinador',activo:true,schoolIds:['s']})
  mem.auth.currentUser.uid = 'c'
  mem.docs.set('users/t',{rol:'docente',schoolIds:['s','otra'],campusIds:{s:['x'],otra:['y']},fullName:'Luz'})
  mem.docs.set('students/otro',{schoolId:'otra',fullName:'Fuera del colegio'})
  mem.docs.set('students/unido',{schoolId:'s',mergedInto:'s_A'})
  const data = await readEntities(['Estudiantes','Docentes'])
  expect(data.Estudiantes?.map(s => s.id)).toEqual(['s_A'])
  expect(data.Docentes).toMatchObject([{id:'t',schoolIds:['s'],campusIds:{s:['x']}}])
})
