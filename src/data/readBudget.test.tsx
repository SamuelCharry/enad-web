import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { readCounter, semester } from './testing/readCounter'
import { Home } from '../app/Home'
import { RequireSession } from '../app/RequireSession'
import { PortalLayout } from '../app/PortalLayout'
import { ReportRoutes } from '../features/reports'
import { CollectRoutes } from '../features/collect'
import { getAttendanceReport, getMovement, getSummary, refreshReports } from './reports'
import { ReportRead } from '../features/reports/ReportState'

let store: ReturnType<typeof readCounter>
const auth = vi.hoisted(() => ({ currentUser: { uid: 'manager' } }))
vi.mock('./firebase', () => ({ db: { path: '' }, auth }))
vi.mock('firebase/auth', () => ({ onAuthStateChanged: (_: unknown, cb: (u: unknown) => void) => { cb(auth.currentUser); return () => { } } }))
vi.mock('firebase/firestore', async () => {
  const { readCounter } = await import('./testing/readCounter')
  return Object.fromEntries(Object.keys(readCounter().sdk).map(key => [key, (...args: never[]) =>
    (store.sdk[key as keyof typeof store.sdk] as (...a: never[]) => unknown)(...args)]))
})

beforeEach(() => { vi.spyOn(console, 'warn'); vi.spyOn(console, 'error'); store = readCounter(); refreshReports(); vi.spyOn(Date, 'now').mockReturnValue(Date.UTC(2026, 10, 20, 18)) })
afterEach(() => {
  cleanup()
  try {
    expect(console.warn).not.toHaveBeenCalled()
    expect(console.error).not.toHaveBeenCalled()
  } finally { vi.restoreAllMocks() }
})
function page(path: string) {
  return render(<MemoryRouter initialEntries={[path]}><Routes><Route element={<RequireSession />}><Route element={<PortalLayout />}>
    <Route path="/portal" element={<Home />} /><Route path="/recoleccion/*" element={<CollectRoutes />} /><Route path="/visualizacion/*" element={<ReportRoutes />} />
  </Route></Route></Routes></MemoryRouter>)
}
async function settled(text: RegExp) {
  await waitFor(() => {
    expect(screen.queryAllByText(text).length).toBeGreaterThan(0)
    expect(screen.queryByText('Cargando datos…')).toBeNull()
    expect(screen.queryByRole('alert')).toBeNull()
  }, { timeout: 5000 })
}
for (const role of ['coordinador', 'fundacion', 'admin', 'docente']) it('presupuesta /portal para ' + role, async () => {
  auth.currentUser.uid = semester(store, role).uid
  page('/portal')
  await settled(role === 'docente' ? /Asistencia completa/ : /Actividad reciente/)
  expect(store.cost()).toBeLessThanOrEqual(role === 'docente' ? 400 : 300)
  const streams = store.reads.listeners.filter(q => ['attendance', 'evaluations'].includes(q.path))
  if (role === 'docente') {
    expect(streams.length).toBeGreaterThan(0)
    expect(streams.every(q => q.constraints?.some(f => f.field === 'date') && q.constraints?.some(f => f.field === 'groupId'))).toBe(true)
  } else expect(streams).toEqual([])
  console.info('Presupuesto', role, store.cost())
})
for (const [path, label] of [
  ['/visualizacion', 'Tasa de asistencia de mis grupos'],
  ['/recoleccion/asistencia?school=ie0&group=g0', 'Grupo 0'],
  ['/recoleccion/evaluacion?school=ie0&group=g0&subject=matematicas&moment=linea_media_1', 'Estudiante 0'],
  ['/recoleccion/horas', 'Horas'], ['/recoleccion/grupos', 'Grupo 0'], ['/recoleccion/estudiantes', 'Estudiante 0']
]) it('limita la página docente ' + path, async () => {
  auth.currentUser.uid = semester(store, 'docente').uid
  page(path)
  await settled(new RegExp(label))
  expect(store.cost()).toBeLessThanOrEqual(400)
  console.info('Presupuesto docente', path, store.cost())
})
it('calcula sesiones compartidas una sola vez y usa únicamente los momentos seleccionados', async () => {
  auth.currentUser.uid = semester(store, 'fundacion').uid
  const [attendance, summary] = await Promise.all([getAttendanceReport({}), getSummary({})])
  expect(attendance.bySchool.reduce((n, s) => n + s.sessions, 0)).toBe(125)
  expect(attendance.bySchool.reduce((n, s) => n + s.present, 0)).toBe(1125)
  expect(summary.studentsOverTime).toEqual([7, 8, 9, 10].map(week => ({ week, count: 225 })))
  expect(summary.hoursWorked).toBe(1500)
  const moves = await getMovement({ from: '2026-09-14', to: '2026-11-20', schoolId: 'ie0' }, 'lectura', 'linea_base', 'linea_media_1')
  expect(moves[0].up).toBe(24)
  const evaluationQueries = store.reads.requests.filter(q => q.path === 'evaluations')
  expect(evaluationQueries.every(q => q.constraints?.some(f => f.field === 'moment' && f.op === 'in'))).toBe(true)
})

const tabs = [
  ['', 'Estudiantes que asistieron'], ['/seguimiento', 'Envíos del'], ['/instituciones', 'Instituciones en la selección'],
  ['/horas', 'Cumplimiento de horas por institución'], ['/niveles', 'Nivel actual por momento'],
  ['/docentes', 'Seguimiento por docente e institución'], ['/comparacion', 'Comparación de instituciones y sedes']
] as const
for (const [tab, label] of tabs) it('presupuesta el informe ' + (tab || 'resumen') + ' y su reapertura', async () => {
  auth.currentUser.uid = semester(store, 'fundacion').uid
  const view = page('/visualizacion' + tab)
  await settled(new RegExp(label))
  const cold = store.cost(), aggregates = store.reads.aggregations
  expect(cold).toBeLessThanOrEqual(1500)
  expect(store.reads.listeners.some(q => ['attendance', 'evaluations'].includes(q.path))).toBe(false)
  view.unmount()
  page('/visualizacion' + tab)
  await settled(new RegExp(label))
  expect(store.cost() - cold).toBeLessThanOrEqual(15)
  expect(store.reads.aggregations).toBe(aggregates)
  console.info('Presupuesto', tab || 'resumen', cold, store.cost() - cold)
})
it('termina la espera a los veinte segundos y reintenta únicamente por solicitud', async () => {
  vi.useFakeTimers()
  try {
    const load = vi.fn<() => Promise<string>>().mockImplementationOnce(() => new Promise(() => { })).mockResolvedValue('Recuperado')
    render(<ReportRead query="demora" load={load}>{v => <p>{v}</p>}</ReportRead>)
    await act(async () => { await vi.advanceTimersByTimeAsync(20_001) })
    expect(screen.getByRole('alert').textContent).toMatch(/No pudimos cargar/)
    fireEvent.focus(window)
    await act(async () => { await vi.advanceTimersByTimeAsync(600_000) })
    expect(load).toHaveBeenCalledOnce()
    await act(async () => { fireEvent.click(screen.getByText('Actualizar')) })
    expect(screen.getByText('Recuperado')).toBeTruthy()
  } finally { vi.useRealTimers() }
})

for (const [path, role, ready] of [
  ['/portal', 'coordinador', 'Actividad reciente'], ['/visualizacion', 'fundacion', 'Estudiantes que asistieron'],
  ['/recoleccion/calidad', 'admin', 'Registros para revisión']
]) it('recupera la vista ' + path + ' después de resource-exhausted', async () => {
  auth.currentUser.uid = semester(store, role).uid
  const failure = { code: 'resource-exhausted' }
  const reject = path.endsWith('calidad') ? vi.spyOn(store.sdk, 'getDocs').mockRejectedValue(failure) :
    vi.spyOn(store.sdk, 'getCountFromServer').mockRejectedValue(failure)
  page(path)
  expect((await screen.findByRole('alert')).textContent).toMatch(/No pudimos cargar/)
  const attempts = reject.mock.calls.length
  fireEvent.focus(window)
  expect(reject).toHaveBeenCalledTimes(attempts)
  reject.mockRestore()
  fireEvent.click(screen.getByRole('button', { name: 'Actualizar' }))
  await settled(new RegExp(ready))
})

for (const [section, label] of [
  ['instituciones', 'Instituciones y sedes'], ['docentes', 'Directorio docente'],
  ['estudiantes', 'Añadir estudiante'], ['grupos', 'Crear grupo'], ['evaluaciones', 'Selecciona el estudiante'],
  ['configuracion', 'Configuración del programa'], ['calidad', 'Registros para revisión'], ['importaciones', 'El historial se llena']
]) it('abre administración sin cargar eventos históricos: ' + section, async () => {
  auth.currentUser.uid = semester(store, 'admin').uid
  page('/recoleccion/' + section)
  await settled(new RegExp(label))
  console.info('Presupuesto administración', section, store.cost())
  expect(store.cost()).toBeLessThanOrEqual(400)
  expect(store.reads.requests.some(q => q.path === 'attendance' || q.path === 'evaluations')).toBe(false)
})
