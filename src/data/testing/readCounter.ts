// In-memory Firestore read model. Empty queries cost one read. A server
// aggregation costs at least one read and another per 1,000 matching entries.
type Fields = Record<string, unknown>
type Filter = { field: string; op: string; value: unknown }
type Ref = { path: string; group?: boolean; constraints?: Filter[] }
type Row = { id: string; path: string; data: Fields }
function field(row: Row, name: string): unknown {
  if (name === '__name__') return row.id
  return name.split('.').reduce<unknown>((value, k) => (value as Fields | undefined)?.[k], row.data)
}
const compare = (a: unknown, b: unknown) => a === b ? 0 : String(a) < String(b) ? -1 : 1
export function readCounter() {
  const docs = new Map<string, Row>(), collections = new Map<string, Row[]>()
  const reads = { documents: 0, aggregations: 0, aggregateReads: 0, listeners: [] as Ref[], requests: [] as Ref[] }
  const put = (path: string, data: Fields) => {
    const parts = path.split('/'), row = { id: parts.at(-1)!, path, data }
    docs.set(path, row)
    for (const key of new Set([parts.slice(0, -1).join('/'), parts.at(-2)!])) {
      const list = collections.get(key) ?? []
      list.push(row); collections.set(key, list)
    }
  }
  const snap = (path: string) => ({ id: path.split('/').at(-1), ref: { path }, exists: () => docs.has(path), data: () => docs.get(path)?.data, metadata: { hasPendingWrites: false } })
  const child = (parent: Ref, ...parts: string[]) => ({ path: [parent.path, ...parts].filter(Boolean).join('/') })
  const where = (field: string, op: string, value: unknown) => ({ field, op, value })
  function select(q: Ref) {
    reads.requests.push(q)
    const constraints = q.constraints ?? [], orders = constraints.filter(f => f.op === 'order')
    const after = constraints.find(f => f.op === 'cursor')?.value as unknown[] | undefined
    const take = constraints.find(f => f.op === 'limit')?.value as number | undefined
    let list = (collections.get(q.path) ?? []).filter(row => constraints.every(({ field: name, op, value }) => {
      const v = field(row, name)
      switch (op) {
        case '==': return v === value
        case 'in': return (value as unknown[]).includes(v)
        case '>=': return v !== undefined && compare(v, value) >= 0
        case '<=': return v !== undefined && compare(v, value) <= 0
        case 'order': return v !== undefined
        case 'limit': case 'cursor': return true
        default: throw Error('Unsupported fixture query ' + op)
      }
    }))
    if (orders.length) {
      const order = (r: Row, values: unknown[]) => {
        for (const [i, v] of values.entries()) {
          const delta = compare(field(r, orders[i].field), v) * (orders[i].value === 'desc' ? -1 : 1)
          if (delta) return delta
        }
        return 0
      }
      if (after) list = list.filter(r => order(r, after) > 0)
      list.sort((a, b) => order(a, orders.map(o => field(b, o.field))))
    }
    return take === undefined ? list : list.slice(0, take)
  }
  function page(q: Ref) {
    const items = select(q)
    reads.documents += Math.max(1, items.length)
    return { docs: items.map(r => snap(r.path)) }
  }
  function aggregate(q: Ref) {
    const list = select(q)
    reads.aggregations++; reads.aggregateReads += Math.max(1, Math.ceil(list.length / 1000))
    return list
  }
  const sdk = {
    where, doc: child, collection: child, collectionGroup: (_db: Ref, path: string) => ({ path, group: true }), documentId: () => '__name__',
    orderBy: (field: string, dir = 'asc') => where(field, 'order', dir), limit: (n: number) => where('', 'limit', n), startAfter: (...values: unknown[]) => where('', 'cursor', values),
    query: (q: Ref, ...extra: Filter[]) => ({ ...q, constraints: [...(q.constraints ?? []), ...extra] }),
    getDocsFromCache: async () => ({ docs: [] }),
    getDocs: async (q: Ref) => page(q), getDoc: async (q: Ref) => { reads.documents++; return snap(q.path) },
    onSnapshot: (q: Ref, options: unknown, cb?: (v: unknown) => void) => {
      reads.listeners.push(q)
      const notify = typeof options === 'function' ? options : cb
      if (q.path.split('/').length % 2 || q.group) notify?.(page(q))
      else { reads.documents++; notify?.(snap(q.path)) }
      return () => { }
    },
    getCountFromServer: async (q: Ref) => { const count = aggregate(q).length; return { data: () => ({ count }) } },
    sum: (field: string) => field, getAggregateFromServer: async (q: Ref, fields: Record<string, string>) => {
      const items = aggregate(q)
      return { data: () => Object.fromEntries(Object.entries(fields).map(([alias, k]) => [alias, items.reduce((n, r) => n + Number(field(r, k) ?? 0), 0)])) }
    },
  }
  return { put, sdk, reads, cost: () => reads.documents + reads.aggregateReads }
}

export function semester(store: ReturnType<typeof readCounter>, role: string) {
  const { put } = store
  const school = (i: number) => 'ie' + (i % 5), teacher = (i: number) => 't' + (i % 12), group = (i: number) => 'g' + (i % 25)
  const day = (i: number) => new Date(Date.UTC(2026, 8, 14 + Math.floor(i / 5) * 7 + i % 5)).toISOString().slice(0, 10)
  const config = { implementationStartDate: day(0), breaks: [], year: 2026, projectName: 'ENAd' }
  const profile = { uid: role === 'docente' ? 't0' : 'manager', rol: role, activo: true, fullName: 'Perfil de prueba', email: 'prueba@example.test', regions: ['Centro'], schoolIds: role === 'docente' ? ['ie0', 'ie2', 'ie4'] : [], campusIds: {}, jornada: 'única' }
  put('users/' + profile.uid, profile); put('program/config', config)
  for (let i = 0; i < 5; i++) put('schools/' + school(i), { name: 'Institución ' + i, region: 'Centro', department: 'Caldas', municipality: 'Neira', zone: 'rural', projectId: 'enad', active: true, campuses: [{ id: 'c', name: 'Central', jornada: 'única' }] })
  for (let i = 0; i < 12; i++) {
    if (teacher(i) === profile.uid) continue
    const assignments = Array.from({ length: 25 }, (_, g) => g).filter(g => teacher(g) === teacher(i)).map(school)
    put('users/' + teacher(i), { ...profile, uid: teacher(i), rol: 'docente', fullName: 'Docente ' + i, schoolIds: assignments, regions: [] })
  }
  const directories = new Set<string>()
  for (let i = 0; i < 25; i++) {
    const key = 'schools/' + school(i) + '/teachers/' + teacher(i)
    if (!directories.has(key)) put(key, { uid: teacher(i), fullName: 'Docente ' + i % 12 })
    directories.add(key)
    put('groups/' + group(i), {
      name: 'Grupo ' + i, subject: i % 2 ? 'lectura' : 'matematicas', schoolId: school(i), campus: 'c',
      teacherId: teacher(i), teacherName: 'Docente ' + i % 12, studentIds: Array.from({ length: 12 }, (_, j) => 's' + (i + 25 * j))
    })
  }
  for (let i = 0; i < 300; i++) {
    const studentId = 's' + i, g = i % 25, common = { studentId, groupId: group(g), schoolId: school(g), teacherId: teacher(g) }
    put('students/' + studentId, {
      fullName: 'Estudiante ' + i, code: String(i), ...common, campus: 'c', grade: 4, active: true, retired: false, provisional: false, sample: 1, age: 9, gender: 'F',
      levels: { lectura: { level: 'principiante', moment: 'linea_media_1', date: day(49) } }
    })
    for (let d = 0; d < 50; d++) put('students/' + studentId + '/attendance/' + group(g) + '_' + day(d), {
      ...common, date: day(d), savedAt: day(d) + 'T15:00:00Z',
      teacherId: d === 48 && i === 0 ? 't1' : common.teacherId, status: i % 4 ? 'vino' : 'no_vino'
    })
  }
  for (let i = 0; i < 2000; i++) {
    const n = i % 300, g = n % 25, mid = i >= 900, d = mid ? 49 : 5
    put('students/s' + n + '/evaluations/e' + i, {
      studentId: 's' + n, schoolId: school(g), ...(i % 3 ? { groupId: group(g) } : {}), teacherId: teacher(g),
      subject: g % 2 ? 'lectura' : 'matematicas', moment: mid ? 'linea_media_1' : 'linea_base', date: day(d), savedAt: day(d) + 'T16:00:00Z', level: mid ? (g % 2 ? 'letra' : 'un_digito') : 'principiante'
    })
  }
  for (let i = 0; i < 1000; i++) {
    const g = i % 25, d = 10 + Math.floor(i / 25)
    put('hours/' + teacher(g) + '_' + school(g) + '_' + day(d), {
      teacherId: teacher(g), schoolId: school(g), date: day(d), week: 1 + Math.floor(d / 5),
      plannedHours: 4, workedHours: 3, savedAt: day(d) + 'T19:00:00Z'
    })
  }
  return profile
}
