import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AttendanceMark, Group, School, Student, UserProfile } from '../../domain/types'
import * as session from '../../data/session'
import * as groupsApi from '../../data/groups'
import * as hoursApi from '../../data/hours'
import * as profileApi from '../../data/profile'
import * as reportsApi from '../../data/reports'
import * as scopeApi from '../../data/scope'
import * as studentsApi from '../../data/students'
import * as excelApi from '../../domain/export/excel'
import * as weeksApi from '../../domain/weeks'
import { MOMENTS } from '../../domain/levels'
import { ReportRoutes } from './index'
import { ReportRead } from './ReportState'
import { WeeklyTable } from './reportViews'
import { changeFilter, number, percent, studentRate } from './model'
import { exportReport } from '../../data/reportMath'

vi.mock('../../data/session', () => ({ useSession: vi.fn() }))

vi.mock('../../data/groups', () => ({ useGroups: vi.fn() }))
vi.mock('../../data/hours', () => ({ useMyHours: vi.fn() }))
vi.mock('../../data/profile', () => ({ updateMyName: vi.fn() }))
vi.mock('../../data/reports', () => ({ refreshReports: vi.fn(), getEvaluationRows:vi.fn(), getStudentReport:vi.fn(),getGroupRoster:vi.fn(), getFollowup:vi.fn(), getComparison:vi.fn(), getMovement: vi.fn().mockResolvedValue([]), getAttendanceReport: vi.fn(), getExport: vi.fn(), getHoursReport: vi.fn(), getLevels: vi.fn(), getSubmissions: vi.fn(), getSummary: vi.fn(), getTeacherMetrics: vi.fn(), useFilterOptions: vi.fn() }))
vi.mock('../../data/scope', () => ({ useProgramConfig: vi.fn(), useSchools: vi.fn() }))
vi.mock('../../data/students', () => ({ getStudentHistory: vi.fn(), useStudents: vi.fn() }))
vi.mock('../../domain/export/excel', () => ({ buildExcelExport: vi.fn() }))
beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(scopeApi.useProgramConfig).mockReturnValue({loading:false,config:null,error:undefined})
  vi.spyOn(reportsApi, 'useFilterOptions').mockReturnValue({ projectNames:{}, projects: [], departments: [], municipalities: [], schools: [], campuses: [], error: undefined, loading: false })
})

afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals() })

const profile: UserProfile = { uid: 'd1', rol: 'fundacion', activo: true, fullName: 'Docente de prueba', email: 'prueba@example.test', schoolIds: ['ie1'], campusIds: { ie1: ['s1'] }, jornada: 'mañana' }
const school: School = { id: 'ie1', projectId: 'proyecto', name: 'Institución de prueba', zone: 'rural', active: true, department: 'Caldas', municipality: 'Neira', region: 'Centro', campuses: [{ id: 's1', name: 'Sede Uno', jornada: 'mañana' }] }
const group: Group & { studentCount: number;teacherId:string } = { studentCount: 1, id: 'g1', teacherId: 'd1', teacherName: 'Docente de prueba', subject: 'lectura', name: 'Grupo Uno', campus: 's1', schoolId: 'ie1', studentIds: ['e1'] }
const student: Student = { id: 'e1', fullName: 'Estudiante Uno', nameKey: 'estudiante uno', code: '001', schoolId: 'ie1', campus: 's1', grade: 4, gender: 'F', age: 9, sample: null, active: true, retired: false, provisional: false, levels: { lectura: { level: 'parrafo', date: '2026-04-01', moment: 'linea_base' } } }
const summary = { unavailable:[], range: { from: '2026-04-01', to: '2026-04-23' }, students: 12540, teachers: 8, schools: 1, campuses: 3, groupsBySubject: { lectura: 2, matematicas: 4 }, hoursWorked: 42.5, hoursPlanned: 50, attendanceRate: 85, studentsOverTime: [{ week: 1, count: 5 }] }
const mark: AttendanceMark & { id: string; syncState: 'synced' } = { id: 'g1_2026-04-01', syncState: 'synced', groupId: 'g1', studentId: 'e1', schoolId: 'ie1', teacherId: 'd1', date: '2026-04-01', status: 'vino', savedAt: '' }

function open(path: string, p = profile) {
  vi.spyOn(session, 'useSession').mockReturnValue({ profile: p, user: null, loading: false })
  return render(<MemoryRouter initialEntries={[p.rol === 'docente' ? '/portal/mis-datos' : path]}><Routes><Route path="/portal/reportes/*" element={<ReportRoutes />} /><Route path="/portal/mis-datos" element={<ReportRoutes/>}/></Routes></MemoryRouter>)
}

describe('Presentación de informes', () => {
  it('distingue porcentajes inexistentes de cero y usa números colombianos', () => {
    expect(number(12540.56)).toBe('12.540,6')
    expect(percent(45.25)).toBe('45,3 %')
    expect(percent(null)).toBe('Sin datos')
    expect(percent(0)).toBe('0 %')
  })

  it('ordena las semanas y acumula las horas ejecutadas, incluso sin horas planeadas', () => {
    render(<WeeklyTable weeks={[{ week: 10, planned: 0, worked: 1 }, { week: 2, planned: 4, worked: 2.5 }]} />)
    const rows = within(screen.getByRole('table')).getAllByRole('row')
    expect(within(rows[1]).getAllByRole('cell').map(td => td.textContent)).toEqual(['2', '4', '2,5', '2,5', '62,5 %'])
    expect(within(rows[2]).getAllByRole('cell').map(td => td.textContent)).toEqual(['10', '0', '1', '3,5', 'Sin datos'])
  })

  it('limpia solo las selecciones descendientes, conserva el rango y permite quitar un padre', () => {
    const filters = { projectId: 'p', department: 'Caldas', municipality: 'Neira', schoolId: 'ie1', campus: 's1', from: '2026-02-01', to: '2026-02-28' }
    expect(changeFilter(filters, 'municipality', 'Manizales')).toEqual({ projectId: 'p', department: 'Caldas', municipality: 'Manizales', from: filters.from, to: filters.to })
    expect(changeFilter(filters, 'projectId', '')).toEqual({ from: filters.from, to: filters.to })
    expect(filters.campus).toBe('s1')
  })

  it('aplica el alcance visible a la consulta sin repetir lecturas al enfocar la ventana', async () => {
    const get = vi.spyOn(reportsApi, 'getSummary').mockResolvedValue(summary)
    vi.spyOn(reportsApi, 'useFilterOptions').mockImplementation(f => ({
      projectNames:{p:'ENAd Caldas'}, projects: ['p'], departments: f.projectId ? ['Caldas'] : [], municipalities: [], schools: [], campuses: [], error: undefined, loading: false,
    }))
    open('/portal/reportes')
    expect(await screen.findByText('12.540')).toBeTruthy()
    fireEvent.click(screen.getByText('Filtros', { selector: 'summary' }))
    expect(within(screen.getByLabelText('Proyecto')).getByRole('option',{name:'ENAd Caldas'})).toBeTruthy()
    fireEvent.change(screen.getByLabelText('Proyecto'), { target: { value: 'p' } })
    fireEvent.change(screen.getByLabelText('Departamento'), { target: { value: 'Caldas' } })
    await waitFor(() => expect(get).toHaveBeenLastCalledWith({ projectId: 'p', department: 'Caldas' }))
    fireEvent.change(screen.getByLabelText('Proyecto'), { target: { value: '' } })
    await waitFor(() => expect(get).toHaveBeenLastCalledWith({}))
    const requests = get.mock.calls.length
    fireEvent.focus(window)
    expect(get).toHaveBeenCalledTimes(requests)
    expect(await screen.findByText(/Última actualización/)).toBeTruthy()
  })

  it('conserva los totales distintos de envíos y muestra solo las filas pendientes', async () => {
    vi.spyOn(weeksApi, 'colombiaToday').mockReturnValue('2026-04-23')
    vi.spyOn(scopeApi, 'useProgramConfig').mockReturnValue({ config: { projectName: 'P', implementationStartDate: '2026-04-06', breaks: [], year: 2026 }, loading: false, error: '' })
    const get = vi.spyOn(reportsApi, 'getSubmissions').mockResolvedValue({ week: 2, range: { from: '2026-04-13', to: '2026-04-19' }, total: 1, attendanceSent: 1, hoursSent: 1,
      teachers: [{ uid: 'd1', schoolId: 'ie1', schoolName: 'Primera IE', fullName: 'Docente Uno', attendanceSent: true, hoursSent: true },
        { uid: 'd1', schoolId: 'ie2', schoolName: 'Segunda IE', fullName: 'Docente Uno', attendanceSent: false, hoursSent: true }] })
    open('/portal/reportes/seguimiento')
    expect(await screen.findByText('Primera IE')).toBeTruthy()
    expect(get).toHaveBeenCalledWith({}, 3)
    fireEvent.click(screen.getByLabelText('Solo pendientes'))
    expect(screen.queryByText('Primera IE')).toBeNull()
    expect(screen.getByText('Segunda IE')).toBeTruthy()
    fireEvent.change(screen.getByLabelText('Semana de implementación'), { target: { value: '2' } })
    await waitFor(() => expect(get).toHaveBeenLastCalledWith({}, 2))
  })

  it('abre una sola institución, sede y grupo, y presenta niveles y asistencia', async () => {
    vi.spyOn(scopeApi, 'useSchools').mockReturnValue({ schools: [school], loading: false, error: '' })
    const groups = vi.spyOn(groupsApi, 'useGroups').mockReturnValue({ groups: [group], loading: false, error: '' })
    vi.spyOn(studentsApi, 'useStudents').mockReturnValue({ students: [student], loading: false, error: '' })
    vi.spyOn(reportsApi, 'getAttendanceReport').mockResolvedValue({ bySchool: [], byTeacher: [], byGroup: [{ schoolId: 'ie1', subject: 'lectura', teacherId: 'd1', groupId: 'g1', name: 'Grupo Uno', teacherName: 'D', rate: 82, sessions: 6 }] })
    vi.spyOn(studentsApi, 'getStudentHistory').mockResolvedValue({ attendance: [mark, { ...mark, date: '2026-04-02', status: 'no_vino' }], evaluations: [] })
    vi.mocked(reportsApi.getGroupRoster).mockResolvedValue([{student:{...student,syncState:'synced'},level:undefined,rate:50}])
    vi.mocked(reportsApi.useFilterOptions).mockReturnValue({projectNames:{}, projects:[],departments:[],municipalities:[],schools:[school],campuses:school.campuses,loading:false,error:undefined})
    open('/portal/reportes/instituciones')
    expect(groups).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: school.name }))
    fireEvent.click(screen.getByRole('button', { name: 'Sede Uno' }))
    expect(await screen.findByText('82 %')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: group.name }))
    expect(await screen.findByText('50 %')).toBeTruthy()
    expect(screen.getByText('Párrafo')).toBeTruthy()
    expect(groups).toHaveBeenCalledWith('ie1',expect.objectContaining({campus:'s1',groupId:'g1'}))
  })

  it('excluye retirados, otros grupos y fechas fuera del rango de la tasa del estudiante', () => {
    expect(studentRate([mark, { ...mark, date: '2026-03-31', status: 'no_vino' }, { ...mark, groupId: 'g2', status: 'no_vino' }, { ...mark, status: 'retirado' }], 'g1', { from: '2026-04-01', to: '2026-04-01' })).toBe(100)
    expect(studentRate([{ ...mark, status: 'retirado' }], 'g1', {})).toBeNull()
  })

  it('ignora respuestas anteriores y permite reintentar tras un error', async () => {
    let resolve!: (s: string) => void
    const old = new Promise<string>(r => { resolve = r })
    const fresh = vi.fn<() => Promise<string>>().mockRejectedValueOnce(new Error()).mockResolvedValue('Actual')
    const view = render(<ReportRead query="anterior" load={() => old}>{v => <p>{v}</p>}</ReportRead>)
    view.rerender(<ReportRead query="actual" load={fresh}>{v => <p>{v}</p>}</ReportRead>)
    await screen.findByRole('alert')
    fireEvent.click(screen.getByRole('button', { name: 'Actualizar' }))
    expect(await screen.findByText('Actual')).toBeTruthy()
    await act(async () => resolve('Anterior'))
    expect(screen.queryByText('Anterior')).toBeNull()
  })

  it('descarga el libro devuelto por el exportador con el alcance activo', async () => {
    vi.spyOn(reportsApi, 'getSummary').mockResolvedValue(summary)
    const payload = exportReport({
      ...summary.range, dateFiltered: false,
      config: { projectName: 'ENAd', year: 2026, implementationStartDate: '2026-04-01', breaks: [] },
      schools: [{ school, students: [student], groups: [group], attendance: [], teachers: [], evaluations: [], hours: [] }],
    })
    const get = vi.spyOn(reportsApi, 'getExport').mockResolvedValue(payload)
    const build = vi.spyOn(excelApi, 'buildExcelExport').mockReturnValue(new Blob())
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function(this: HTMLAnchorElement) {
      expect(this.download).toBe('Informe-ENAd.xlsx')
    })
    vi.stubGlobal('URL', class extends URL { static createObjectURL() { return 'blob:fixture' }; static revokeObjectURL() {} })
    open('/portal/reportes')
    await screen.findByText('12.540')
    fireEvent.change(screen.getByLabelText('Desde'), { target: { value: '2026-04-01' } })
    fireEvent.click(screen.getByRole('button', { name: 'Descargar informe filtrado en Excel' }))
    await waitFor(() => expect(click).toHaveBeenCalledOnce())
    expect(get).toHaveBeenCalledWith({ from: '2026-04-01' })
    expect(build).toHaveBeenCalledWith(payload)
  })
})

describe('Mis datos y niveles', () => {
  it('limita los grupos y horas al docente, guarda el nombre y abre el historial de un estudiante', async () => {
    vi.spyOn(weeksApi, 'colombiaToday').mockReturnValue('2026-04-23')
    vi.spyOn(scopeApi, 'useSchools').mockReturnValue({ schools: [school], loading: false, error: '' })
    vi.spyOn(scopeApi, 'useProgramConfig').mockReturnValue({ config: { projectName: 'Proyecto de prueba', implementationStartDate: '2026-04-01', breaks: [], year: 2026 }, loading: false, error: '' })
    vi.spyOn(groupsApi, 'useGroups').mockReturnValue({ groups: [group, { ...group, id: 'otro', teacherId: 'd2', name: 'Otro grupo' }], loading: false, error: '' })
    vi.spyOn(studentsApi, 'useStudents').mockReturnValue({ students: [student], loading: false, error: '' })
    vi.spyOn(studentsApi, 'getStudentHistory').mockResolvedValue({ attendance: [mark], evaluations: [] })
    vi.spyOn(reportsApi, 'getTeacherMetrics').mockResolvedValue({ present: 4, recorded: 5, history: [] })
    const h = { date: '2026-03-25', plannedHours: 4, workedHours: 3, reason: 'Reunión', teacherId: 'd1', schoolId: 'ie1', week: 1, savedAt: '' }
    const hours = vi.spyOn(hoursApi, 'useMyHours').mockReturnValue({ loading: false, error: '', hours: [
      h, { ...h, teacherId: 'd2', workedHours: 99 }, { ...h, date: '2026-03-24', workedHours: 99 },
    ] })
    const save = vi.spyOn(profileApi, 'updateMyName').mockResolvedValue({ ...profile, fullName: 'Nuevo nombre', syncState: 'synced' })
    open('/portal/reportes', { ...profile, rol: 'docente' })
    expect(await screen.findByText('80 %')).toBeTruthy()
    expect(screen.getByText('75 %')).toBeTruthy()
    expect(hours).toHaveBeenCalledWith('2026-03-25', '2026-04-23')
    expect(screen.queryByText('Otro grupo')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Editar nombre' }))
    fireEvent.change(screen.getByLabelText('Nombre completo'), { target: { value: '  Nuevo nombre  ' } })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar nombre' }))
    expect(await screen.findByText('Nombre guardado.')).toBeTruthy()
    expect(save).toHaveBeenCalledWith('Nuevo nombre')
    fireEvent.click(screen.getByRole('button', { name: group.name }))
    fireEvent.click(screen.getByRole('button', { name: student.fullName }))
    expect(await screen.findByText('Asistió')).toBeTruthy()
    expect(screen.queryByRole('link', { name: 'Instituciones' })).toBeNull()
  })

  it('distingue un momento sin evaluaciones y mantiene los intervalos de edad vacíos', async () => {
    const block = { n: 4, counts: { linea_base: 4 }, distribution: { linea_base: { principiante: 1, parrafo: 3 } }, rezago: { linea_base: 25, linea_media_1: 0 } }
    const get = vi.spyOn(reportsApi, 'getLevels').mockResolvedValue({
      subject: 'lectura', moments: MOMENTS, overall: block, bySchool: [{ schoolId: 'ie1', name: school.name, ...block }], gender: { F: 2, M: 2 }, age: { '8': 2, '10': 2 },
    })
    open('/portal/reportes/niveles')
    const row = await screen.findByRole('row', { name: /Institución de prueba/ })
    expect(within(row).getAllByRole('cell').map(td => td.textContent)).toEqual([school.name, '25 %', 'Sin datos'])
    expect(screen.getByText('9 años')).toBeTruthy()
    fireEvent.change(screen.getByLabelText('Área'), { target: { value: 'matematicas' } })
    await waitFor(() => expect(get).toHaveBeenLastCalledWith({}, 'matematicas', MOMENTS))
  })

  it('impide consultar o exportar un rango invertido y se recupera al corregirlo', async () => {
    const get = vi.spyOn(reportsApi, 'getSummary').mockResolvedValue(summary)
    open('/portal/reportes')
    await screen.findByText('12.540')
    fireEvent.change(screen.getByLabelText('Desde'), { target: { value: '2026-04-01' } })
    await waitFor(() => expect(get).toHaveBeenLastCalledWith({ from: '2026-04-01' }))
    fireEvent.change(screen.getByLabelText('Hasta'), { target: { value: '2026-03-31' } })
    expect(screen.getByRole('alert').textContent).toMatch(/fecha final/)
    expect(screen.getByRole('button', { name: 'Descargar informe filtrado en Excel' }).hasAttribute('disabled')).toBe(true)
    expect(get).not.toHaveBeenCalledWith({ from: '2026-04-01', to: '2026-03-31' })
    fireEvent.change(screen.getByLabelText('Hasta'), { target: { value: '2026-04-01' } })
    expect(await screen.findByText('12.540')).toBeTruthy()
  })

  it('mantiene los datos fuera del árbol de una sesión inactiva', () => {
    const get = vi.spyOn(reportsApi, 'getSummary')
    open('/portal/reportes', { ...profile, activo: false })
    expect(screen.getByRole('alert').textContent).toMatch(/sesión activa/)
    expect(get).not.toHaveBeenCalled()
  })
})

it('muestra la tabla semanal y permite consultar las tres agrupaciones de asistencia', async () => {
  vi.spyOn(reportsApi, 'getHoursReport').mockResolvedValue({
    byTeacher: [{ uid: 'd1', fullName: 'Docente Uno', schoolIds: ['ie1'], weekly: [{ week: 3, planned: 4, worked: 3 }],
      cumulative: { planned: 4, worked: 3, rate: 75 } }], bySchool: [],
  })
  vi.spyOn(reportsApi, 'getAttendanceReport').mockResolvedValue({
    bySchool: [{ schoolId: 'ie1', name: 'Primera IE', present: 6, absent: 4, rate: 60, sessions: 10 }],
    byGroup: [{ schoolId: 'ie1', subject: 'lectura', teacherId: 'd1', groupId: 'g1', name: 'Primero', teacherName: 'Docente Uno', rate: 75, sessions: 4 }],
    byTeacher: [{ uid: 'd1', fullName: 'Docente Uno', rate: 0, sessions: 0 }],
  })
  open('/portal/reportes/horas')
  expect(await screen.findByRole('row', { name: 'Primera IE 60 % 10' })).toBeTruthy()
  fireEvent.click(screen.getByText('Docente Uno · 3 de 4 h'))
  expect(screen.getByRole('row', { name: '3 4 3 3 75 %' })).toBeTruthy()
  fireEvent.change(screen.getByLabelText('Agrupar por'), { target: { value: 'group' } })
  expect(screen.getByRole('row', { name: 'Primero Docente Uno 75 % 4' })).toBeTruthy()
  fireEvent.change(screen.getByLabelText('Agrupar por'), { target: { value: 'teacher' } })
  expect(screen.getByRole('row', { name: 'Docente Uno Sin datos 0' })).toBeTruthy()
})

it('abre la comparación de una sede desde un enlace compartido y enlaza el grupo de la docente', async () => {
  vi.mocked(reportsApi.getComparison).mockResolvedValue([{school,campus:school.campuses[0],students:1,groups:1,evaluated:0,attendance:100}])
  vi.mocked(reportsApi.getFollowup).mockResolvedValue({unavailable:[],from:'2026-04-06',to:'2026-04-12',moment:'linea_base',teachers:[{
    uid:group.teacherId,fullName:group.teacherName,school,groups:[{...group,syncState:'synced'}],last:'',weeks:1,expected:1,attendanceRate:100,worked:0,planned:0,evaluated:0,members:1,coverage:0}]})
  const view = open('/portal/reportes/comparacion?schoolId=ie1&campus=s1')
  expect(await screen.findByRole('row',{name:/Institución de prueba · Sede Uno 1 1 0 100 %/})).toBeTruthy()
  expect(reportsApi.getComparison).toHaveBeenCalledWith({schoolId:'ie1',campus:'s1'},true)
  view.unmount()
  open('/portal/reportes/docentes?schoolId=ie1&teacher=d1&orden=asistencia')
  expect(await screen.findByRole('row',{name:/1 \/ 1 · 100 %/})).toBeTruthy()
  expect(screen.getByRole('link',{name:'Grupo Uno'}).getAttribute('href')).toContain('campus=s1&group=g1')
})
it('abre directamente la ficha de un estudiante y conserva el período al regresar al grupo',async () => {
  vi.mocked(studentsApi.useStudents).mockReturnValue({students:[student],loading:false,error:undefined})
  vi.mocked(reportsApi.getStudentReport).mockResolvedValue({student:{...student,syncState:'synced'},evaluations:[],attendance:[mark]})
  open('/portal/reportes/estudiante?schoolId=ie1&campus=s1&group=g1&student=e1&from=2026-01-01')
  expect(await screen.findByText('Asistió')).toBeTruthy()
  expect(screen.queryByText('2025-01-01')).toBeNull()
  expect(screen.getByRole('link',{name:'Volver al grupo'}).getAttribute('href')).toContain('from=2026-01-01')
})

it('combina los filtros de área, momento y nivel con búsqueda por apellidos sin repetir lecturas',async () => {
  const common={syncState:'synced' as const,id:'1',school:'Escuela',student:'Ana María Pérez',studentId:'a',date:'2026-11-17',teacherId:'t',schoolId:'s',savedAt:'',sample:null}
  const read=vi.mocked(reportsApi.getEvaluationRows).mockResolvedValue([
    {...common,subject:'lectura',moment:'linea_media_2',level:'parrafo'},
    {...common,id:'2',student:'Sara Gómez',subject:'matematicas',moment:'linea_base',level:'un_digito'}
  ])
  open('/portal/reportes/evaluaciones')
  await screen.findByText('Sara Gómez')
  const choose=(label:string,value:string) => fireEvent.change(screen.getByLabelText(label),{target:{value}})
  choose('Área','lectura')
  choose('Momento','linea_media_2')
  choose('Nivel','parrafo')
  choose('Buscar','perez ana')
  expect(screen.queryByText('Sara Gómez')).toBeNull()
  expect(screen.getByText('Ana María Pérez')).toBeTruthy()
  expect(read).toHaveBeenCalledOnce()
})
