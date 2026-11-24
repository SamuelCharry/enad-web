import { afterAll, afterEach, beforeAll, beforeEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { MemoryRouter, Outlet, Route, Routes } from 'react-router-dom'
import { PortalLayout } from '../../app/PortalLayout'
import { CollectRoutes } from '../collect'
import { GroupDetail } from './GroupDetail'
import { useTodayPlans } from '../../data/activities'
import { TeacherHome } from './TeacherHome'
import { Scanner } from '../collect/Scanner'
import { useSchoolAttendance, saveGroupAttendance } from '../../data/attendance'
import { useSchoolEvaluations, saveEvaluation } from '../../data/evaluations'
import { createGroup, useGroups, addStudentsToGroup, removeStudentFromGroup } from '../../data/groups'
import { patchStudent, useStudents, getStudentHistory } from '../../data/students'
import { useSchools, useProgramConfig } from '../../data/scope'
import { useMyHours } from '../../data/hours'
import { useSession } from '../../data/session'
import type { UserProfile, School, Group, Student } from '../../domain/types'
import { hourSeries } from './hourSeries'
import { qualityWarning } from './photoQuality'

vi.mock('../../data/session', () => ({ useSession: vi.fn(), signOut: vi.fn() }))
vi.mock('../../data/scope', () => ({ useSchools: vi.fn(), useProgramConfig: vi.fn() }))
vi.mock('../../data/attendance', () => ({ useSchoolAttendance: vi.fn(), saveGroupAttendance: vi.fn() }))
vi.mock('../../data/evaluations', () => ({ useSchoolEvaluations: vi.fn(), saveEvaluation: vi.fn() }))
vi.mock('../../data/groups', () => ({ useGroups: vi.fn(), createGroup: vi.fn(), addStudentsToGroup: vi.fn(), removeStudentFromGroup: vi.fn() }))
vi.mock('../../data/students', () => ({ useStudents: vi.fn(), getStudentHistory: vi.fn(), patchStudent: vi.fn() }))
vi.mock('../../data/hours', () => ({ useMyHours: vi.fn() }))
vi.mock('../../data/activities', () => ({useTodayPlans:vi.fn()}))
vi.mock('../../data/admin', () => ({}))
vi.mock('../../domain/weeks', async orig => ({ ...await orig<typeof import('../../domain/weeks')>(), colombiaToday: () => '2026-04-08' }))

const profile: UserProfile = { uid: 'd', rol: 'docente', activo: true, fullName: 'Ana Pérez', email: 'ana@example.test', jornada: 'mañana', schoolIds: ['first','second'], campusIds: {} }
const school: School = { id: 'second', name: 'Institución de prueba', active: true, projectId: 'p', region: '', department: '', municipality: '', zone: 'rural',
  campuses: [{ id: 'a', name: 'Central', jornada: 'mañana' }, { id: 'b', name: 'Sede rural', jornada: 'mañana' }] }
const group: Group & { studentCount: number; teacherId:string } = { id: 'g', name: 'Lectores de la mañana', teacherName: profile.fullName, schoolId: school.id, campus: 'b', teacherId: profile.uid, subject: 'lectura', studentIds: ['s'], studentCount: 1 }
const student: Student = { id: 's', fullName: 'Estudiante de prueba', nameKey: 'estudiante de prueba', grade: 4, schoolId: 'second', campus: 'b', code: '321', levels: {},
  age: 10, gender: 'F', sample: 1, active: true, retired: false, provisional: false }
const config = { projectName: 'ENAd', year: 2026, implementationStartDate: '2026-03-23', breaks: [] }
const loaded = { loading: false, error: undefined }
const deep = '?school=second&campus=b&group=g&subject=lectura'
function show(route: string) {
  return render(<MemoryRouter initialEntries={[route]}><Routes><Route element={<Outlet context={profile} />}>
    <Route element={<PortalLayout />}><Route path="/portal/hoy" element={<TeacherHome profile={profile} />} />
      <Route path="/portal/*" element={<CollectRoutes />} /></Route></Route></Routes></MemoryRouter>)
}
function click(name: string) { fireEvent.click(screen.getByRole('button',{name})) }
function select(label: string, value: string) { fireEvent.change(screen.getByLabelText(label),{ target: { value } }) }
beforeAll(() => {
  Object.defineProperties(HTMLDialogElement.prototype, {
    showModal: { configurable: true, value: function(this: HTMLDialogElement) { this.open = true } },
    close: { configurable: true, value: function(this: HTMLDialogElement) { this.open = false } },
  })
})
afterAll(() => {
  Reflect.deleteProperty(HTMLDialogElement.prototype,'showModal')
  Reflect.deleteProperty(HTMLDialogElement.prototype,'close')
})
beforeEach(() => {
  localStorage.clear()
  vi.resetAllMocks()
  vi.mocked(useTodayPlans).mockReturnValue({...loaded,data:[]})
  vi.mocked(useSession).mockReturnValue({ loading: false, user: null, profile })
  vi.mocked(useSchools).mockReturnValue({ ...loaded, schools: [{ ...school,id: 'first',name: 'Primera institución' },school] })
  vi.mocked(useProgramConfig).mockReturnValue({ ...loaded,config })
  vi.mocked(useGroups).mockReturnValue({ ...loaded, groups: [group] })
  vi.mocked(useStudents).mockReturnValue({ ...loaded, students: [student] })
  vi.mocked(useMyHours).mockReturnValue({ ...loaded, hours: [] })
  vi.mocked(useSchoolAttendance).mockReturnValue({ ...loaded, data: [] })
  vi.mocked(useSchoolEvaluations).mockReturnValue({ ...loaded, data: [] })
  vi.mocked(getStudentHistory).mockResolvedValue({ attendance: [], evaluations: [] })
})
afterEach(cleanup)

it('abre el grupo de la segunda institución desde Hoy, conserva la sede y guarda una lista completa', async () => {
  vi.mocked(saveGroupAttendance).mockResolvedValue({ groupId: 'g', date: '2026-04-08', saved: 1, syncState: 'pending' })
  show('/portal/grupos' + deep)
  expect(screen.getByLabelText('Institución')).toHaveValue('second')
  expect(screen.getByLabelText('Sede')).toHaveValue('b')
  fireEvent.click(screen.getByRole('link',{ name: 'Tomar asistencia' }))
  expect(screen.getByLabelText('Grupo')).toHaveValue('g')
  click('Marcar a todos presentes')
  click('Guardar asistencia')
  expect(saveGroupAttendance).not.toHaveBeenCalled()
  click('Confirmar asistencia')
  expect(await screen.findByText('Pendiente de envío')).toBeVisible()
  expect(saveGroupAttendance).toHaveBeenCalledWith('g','2026-04-08',{s:'vino'})
})
it('usa el historial del momento y permite corregir una verificación sin reemplazar el nivel actual', async () => {
  vi.mocked(useSchoolEvaluations).mockReturnValue({ ...loaded, data: [{ id: 'e', subject: 'lectura', moment: 'verificacion', level: 'cuento',
    teacherId: 'd', schoolId: 'second', studentId: 's', date: '2026-04-07', savedAt: '2026-04-07', sample: 1 }] })
  vi.mocked(saveEvaluation).mockResolvedValue({ id:'e2',syncState:'synced' })
  show('/portal/evaluacion' + deep + '&moment=verificacion&student=s')
  expect(screen.getByText(/conservará el nivel actual/)).toBeVisible()
  click('Comprensión')
  click('Guardar evaluación')
  await waitFor(() => expect(saveEvaluation).toHaveBeenCalledWith({studentId:'s',subject:'lectura',moment:'verificacion',level:'comprension',groupId:'g'}))
})
it('ofrece cuatro tareas en Hoy y lleva los registros pendientes a su lista', () => {
  show('/portal/hoy')
  expect(within(screen.getByRole('navigation',{name:'Registro de clase'})).getAllByRole('link')).toHaveLength(4)
  expect(screen.getByRole('link',{name:'Escanear lista'})).toHaveAttribute('href','/portal/estudiantes?scan=1')
  expect(screen.getByRole('link',{name:'0 registros por enviar'})).toHaveAttribute('href','/portal/pendientes')
  expect(screen.queryByLabelText('Momento de evaluación')).toBeNull()
})
it('confirma el retiro del grupo y permite deshacerlo sin retirar al estudiante del programa', async () => {
  vi.mocked(removeStudentFromGroup).mockResolvedValue({ ...group, studentIds:[], syncState:'synced' })
  vi.mocked(addStudentsToGroup).mockResolvedValue({ ...group, syncState:'synced' })
  const detail = (g: Group) => <MemoryRouter><GroupDetail group={g} students={[student]} owner /></MemoryRouter>
  const view = render(detail(group))
  click('Quitar del grupo')
  expect(removeStudentFromGroup).not.toHaveBeenCalled()
  click('Confirmar retiro del grupo')
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  view.rerender(detail({...group, studentIds:[]}))
  click('Deshacer')
  await waitFor(() => expect(addStudentsToGroup).toHaveBeenCalledWith('g',['s']))
  expect(removeStudentFromGroup).toHaveBeenCalledWith('g','s')
  expect(patchStudent).not.toHaveBeenCalled()
})
it('presenta el grupo de otro docente en modo de consulta', () => {
  vi.mocked(useGroups).mockReturnValue({ ...loaded,groups: [{...group,teacherId:'other'}] })
  show('/portal/grupos'+deep)
  expect(screen.getByText(/Solo lectura/)).toBeVisible()
  expect(screen.queryByRole('button',{name:'Eliminar grupo'})).toBeNull()
  expect(screen.queryByRole('button',{name:'Quitar del grupo'})).toBeNull()
})
it('edita datos y confirma el retiro de un estudiante oficial sin enviar campos de identidad', async () => {
  vi.mocked(patchStudent).mockResolvedValue({ ...student, retired:true, syncState:'synced' })
  show('/portal/estudiantes?school=second&campus=b&student=s')
  await screen.findByText('Historial de asistencia')
  click('Editar estudiante')
  expect(screen.getByLabelText('Nombre completo')).toBeDisabled()
  expect(screen.getByLabelText('Grado')).toBeDisabled()
  select('Sexo','M')
  fireEvent.click(screen.getByLabelText('Estudiante retirado'))
  click('Guardar estudiante')
  expect(patchStudent).not.toHaveBeenCalled()
  click('Confirmar retiro')
  await waitFor(() => expect(patchStudent).toHaveBeenCalledWith('s',expect.objectContaining({ retired:true, gender:'M' })))
  expect(vi.mocked(patchStudent).mock.calls[0][1]).not.toHaveProperty('fullName')
})
it('permite cámara y galería, coteja una fila omitida y añade un estudiante existente sin duplicarlo', async () => {
  const saved = vi.fn()
  render(<Scanner schoolId="second" campus="b" students={[student]} onClose={vi.fn()} onSaved={saved} />)
  expect(screen.getByLabelText('Tomar foto de la lista')).toHaveAttribute('capture','environment')
  expect(screen.getByLabelText('Elegir imagen')).toHaveAttribute('accept','image/*')
  click('Añadir una fila omitida')
  const save = screen.getByRole('button',{name:/Guardar lista|Importar lista revisada/})
  expect(save).toBeDisabled()
  select('Nombre · fila 1',student.fullName)

  expect(screen.getByLabelText('Identidad · fila 1')).toHaveValue('s')
  select('Añadir al grupo','g')
  fireEvent.click(save)
  await waitFor(() => expect(addStudentsToGroup).toHaveBeenCalledWith('g',['s']))
  expect(saved).toHaveBeenCalledWith(group)
})
it('guía el registro sobre el formulario y exige seleccionar un grupo antes de avanzar', () => {
  show('/portal/asistencia?school=second&guide=1')
  const guide = screen.getByRole('region',{name:'Guía de registro'})
  fireEvent.click(within(guide).getByRole('button',{name:'Continuar'}))
  expect(within(guide).getByRole('alert')).toHaveTextContent('Completa este paso')
  select('Grupo','g')
  fireEvent.click(within(guide).getByRole('button',{name:'Continuar'}))
  expect(guide).toHaveTextContent('Revisa la fecha')
})
it('suma las últimas semanas de implementación y distingue los días sin reporte', () => {
  const base = { teacherId:'d', schoolId:'s', plannedHours:0, reason:null, savedAt:'', week:null }
  const chart = hourSeries([{...base,date:'2026-04-01',workedHours:2},{...base,date:'2026-04-08',workedHours:1.5}], '2026-04-06',3,config)
  expect(chart.weeks.map(p => p.value)).toEqual([0,2,3.5])
  expect(chart.days[2]).toEqual({label:'Mié · Sin programación',value:1.5})
  expect(chart.days[0].label).toContain('Sin reporte')
})
it('reconoce oscuridad, reflejo y desenfoque con los umbrales de la cámara móvil', () => {
  const bytes = new Uint8ClampedArray(100*4)
  expect(qualityWarning(bytes,10,10)).toContain('oscura')
  expect(qualityWarning(bytes.fill(255),10,10)).toContain('reflejos')
  expect(qualityWarning(bytes.fill(128),10,10)).toContain('borrosa')
})

it('abre el perfil de un estudiante sin sede desde un enlace de grupo', async () => {
  vi.mocked(useStudents).mockReturnValue({ ...loaded, students: [{ ...student, campus: '' }] })
  show('/portal/estudiantes?school=second&campus=&student=s')
  expect(screen.getByLabelText('Sede')).toHaveValue('')
  expect(await screen.findByRole('button', { name: 'Editar estudiante' })).toBeVisible()
  await waitFor(() => expect(getStudentHistory).toHaveBeenCalled())
})

it('solicita una sede al crear un grupo desde todas las sedes', async () => {
  vi.mocked(createGroup).mockResolvedValue({ ...group, createdAt: '', updatedAt: '', syncState: 'synced' })
  show('/portal/grupos?school=second')
  click('Crear grupo')
  click('Sede rural')
  select('Nombre del grupo', group.name)
  click('Guardar grupo')
  await waitFor(() => expect(createGroup).toHaveBeenCalledWith({ name: group.name, subject: 'lectura', schoolId: school.id, campus: 'b' }))
  expect(await screen.findByRole('link', { name: 'Tomar asistencia' })).toBeVisible()
})

it('conserva el grupo de una propuesta si hay que reintentar el envío de sus integrantes', async () => {
  vi.mocked(useStudents).mockReturnValue({ ...loaded, students: [{ ...student, levels: { lectura: { level: 'cuento', moment: 'linea_base', date: '2026-04-07' } } }] })
  vi.mocked(createGroup).mockResolvedValue({ ...group, createdAt: '', updatedAt: '', syncState: 'synced' })
  vi.mocked(addStudentsToGroup).mockRejectedValueOnce(new Error('Reintenta el envío')).mockResolvedValueOnce({ ...group, syncState: 'synced' })
  show('/portal/grupos?school=second&campus=b')
  click('Sugerir grupos')
  click('Ver propuesta')
  fireEvent.click(screen.getByRole('button', { name: /Grupo 1 ·/ }))
  click('Aceptar mi grupo')
  expect(await screen.findByRole('alert')).toHaveTextContent('Reintenta el envío')
  click('Completar mi grupo')
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  expect(createGroup).toHaveBeenCalledTimes(1)
  expect(addStudentsToGroup).toHaveBeenCalledTimes(2)
})

it('regresa desde Hoy a un borrador del día anterior en la fecha y el grupo correctos', async () => {
  vi.spyOn(window, 'confirm').mockReturnValue(true)
  show('/portal/asistencia' + deep)
  click('Día anterior')
  click('Marcar a todos presentes')
  fireEvent.click(screen.getByRole('link', { name: 'Hoy' }))
  fireEvent.click(screen.getByRole('link', { name: 'Reportar asistencia' }))
  select('Grupo','g')
  click('Día anterior')
  expect(screen.getByLabelText('Fecha')).toHaveValue('2026-04-07')
  vi.mocked(saveGroupAttendance).mockResolvedValue({ groupId:'g', date:'2026-04-07', saved:1, syncState:'synced' })
  click('Guardar asistencia')
  click('Confirmar asistencia')
  await waitFor(() => expect(screen.getByRole('button',{name:'Guardar asistencia'})).toBeDisabled())
  vi.mocked(window.confirm).mockRestore()
})

it('abre la evaluación de un grupo propio fuera de las sedes del perfil desde un enlace incompleto', async () => {
  vi.mocked(useSession).mockReturnValue({loading:false,user:null,profile:{...profile,campusIds:{second:['a']}}})
  vi.mocked(saveEvaluation).mockResolvedValue({id:'e',syncState:'synced'})
  show('/portal/evaluacion?group=g&moment=linea_media_2&student=s')
  await screen.findByRole('button',{name:'Palabra'})
  expect(screen.getByLabelText('Grupo')).toHaveValue('g')
  expect(screen.getByLabelText('Sede')).toHaveValue('b')
  click('Palabra')
  click('Guardar evaluación')
  await waitFor(() => expect(saveEvaluation).toHaveBeenCalledWith({studentId:'s',subject:'lectura',moment:'linea_media_2',groupId:'g',level:'palabra'}))
})

it('muestra en Hoy el título elegido para la fecha colombiana', () => {
  vi.mocked(useTodayPlans).mockReturnValue({...loaded,data:[{activityTitle:'Leer en parejas',activityId:'a',teacherId:'d',schoolId:'second',date:'2026-04-08',savedAt:''}]})
  show('/portal/hoy')
  expect(useTodayPlans).toHaveBeenCalledWith('2026-04-08')
  expect(screen.getByRole('link',{name:'Actividad de hoy · Leer en parejas'})).toHaveAttribute('href','/portal/actividades')
})
it('inicia la propuesta con el último momento con datos y explica el mínimo de docentes', () => {
  vi.mocked(useStudents).mockReturnValue({...loaded,students:[{...student,levels:{lectura:{level:'cuento',moment:'linea_media_2',date:'2026-04-07'}}}]})
  show('/portal/grupos?school=second&campus=b')
  click('Sugerir grupos')
  expect(screen.getByLabelText('Momento de evaluación')).toHaveValue('linea_media_2')
  select('Número de docentes','0')
  expect(screen.getByRole('alert')).toHaveTextContent('Indica al menos un docente')
  expect(screen.getByRole('button',{name:'Ver propuesta'})).toBeDisabled()
})
