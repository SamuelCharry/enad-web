import { getDataQuality } from '../../../data/reports'
import { qualityIssues } from '../../../data/quality'
import { beforeEach, afterEach, expect, it, vi } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import type { School, Student, UserProfile } from '../../../domain/types'
import { useUsers, useImportHistory, patchUser } from '../../../data/admin'
import { useProjects, useProgramConfig, useSchools } from '../../../data/scope'
import { useStudents } from '../../../data/students'
import { patchGroup, useGroups } from '../../../data/groups'
import { saveStudentAssignment } from '../../../data/adminStudent'
import { createAccount } from '../../../data/functions'
import { Program } from '../Program'
import { Schools, Teachers } from '../Directories'
import { DataQuality, ImportHistory } from './Audit'
import { GroupMembers } from './GroupMembers'
import { Rosters } from './Rosters'
vi.mock('../../../data/functions',()=>({createAccount:vi.fn()}))
vi.mock('../../../data/reports',()=>({refreshReports:vi.fn(),getDataQuality:vi.fn()}))
vi.mock('../../../data/firebase', () => ({ db: {}, auth: {} }))
vi.mock('../../../data/admin', () => ({ useUsers: vi.fn(), useImportHistory: vi.fn(), patchUser: vi.fn(), upsertSchool: vi.fn(),saveProgramConfig:vi.fn() }))
vi.mock('../../../data/adminStudent', () => ({ saveStudentAssignment: vi.fn() }))
vi.mock('../../../data/groups', () => ({ patchGroup: vi.fn(), useGroups: vi.fn() }))
vi.mock('../../../data/scope', () => ({ useSchools: vi.fn(), useProgramConfig:vi.fn(),useProjects:vi.fn() }))
vi.mock('../../../data/students', () => ({ useStudents: vi.fn() }))
const school: School = { id: 's', name: 'Escuela', region: 'Centro', department: 'Caldas', municipality: 'Neira', projectId: 'p', zone: 'rural', active: true, campuses: [{ id: 'c', name: 'Central', jornada: 'única' }] }
const student: Student = { id: 's_001', schoolId: 's', code: '001', campus: 'c', fullName: 'Ana Paz', nameKey: 'ana paz', grade: 3, age: null, sample: null, gender: '', retired: false, active: true, provisional: false, levels: {} }
const teacher: UserProfile = { uid: 't', fullName: 'Luz', email: 'l@example.test', activo: true, rol: 'docente', jornada: 'única', campusIds: { s: ['c'] }, schoolIds: ['s'] }
const ready = { loading: false, error: undefined }
beforeEach(() => {
  vi.resetAllMocks()
  vi.mocked(useProjects).mockReturnValue({...ready,data:[{id:'p',name:'Proyecto cafetero'}]})
  vi.mocked(useUsers).mockReturnValue({ ...ready, users: [teacher] })
  vi.mocked(useSchools).mockReturnValue({ ...ready, schools: [school] })
  vi.mocked(useStudents).mockReturnValue({ ...ready, students: [student as ReturnType<typeof useStudents>['students'][number]] })
  vi.mocked(useGroups).mockReturnValue({ ...ready, groups: [] })
})
afterEach(() => { cleanup(); vi.restoreAllMocks() })
it('pagina y busca docentes, confirma la desactivación y conserva el resultado después del cierre', async () => {
  vi.mocked(useUsers).mockReturnValue({ ...ready, users: Array.from({ length: 21 }, (_, i) => ({ ...teacher, uid: String(i), fullName: 'Docente ' + i })) })
  render(<MemoryRouter><Teachers /></MemoryRouter>)
  expect(screen.queryByText('Docente 20')).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }))
  expect(screen.getByText('Docente 20')).toBeTruthy()
  fireEvent.change(screen.getByLabelText('Buscar'), { target: { value: 'Docente 20' } })
  fireEvent.click(screen.getByRole('button', { name: 'Editar' }))
  fireEvent.click(screen.getByLabelText('Cuenta activa'))
  const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
  fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }))
  expect(patchUser).not.toHaveBeenCalled()
  confirm.mockReturnValue(true)
  vi.mocked(patchUser).mockResolvedValue({ ...teacher, activo: false, syncState: 'synced' })
  fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }))
  expect(await screen.findByText('Cambios guardados.')).toBeTruthy()
  expect(patchUser).toHaveBeenCalledWith('20', expect.objectContaining({ activo: false, campusIds: { s: ['c'] } }))
})
it('ofrece retiro con confirmación y conserva el editor si falla el guardado', async () => {
  render(<MemoryRouter><Rosters kind="estudiantes" /></MemoryRouter>)
  fireEvent.click(screen.getByRole('button', { name: 'Editar' }))
  fireEvent.click(screen.getByLabelText('Estudiante retirado'))
  vi.spyOn(window, 'confirm').mockReturnValue(true)
  vi.mocked(saveStudentAssignment).mockRejectedValue(new Error('El registro cambió.'))
  fireEvent.click(screen.getByRole('button', { name: 'Guardar estudiante' }))
  expect((await screen.findByRole('alert')).textContent).toBe('El registro cambió.')
  expect(saveStudentAssignment).toHaveBeenCalledWith(student, expect.objectContaining({ retired: true }), [], [])
})
it('vincula cada hallazgo al directorio y conserva filas y responsable del historial', async () => {
  vi.mocked(getDataQuality).mockResolvedValue(qualityIssues([student],[],[teacher],[school]))
  const view = render(<MemoryRouter><DataQuality /></MemoryRouter>)
  expect((await screen.findByRole('link', { name: 'Ana Paz' })).getAttribute('href')).toBe('/recoleccion/evaluaciones?schoolId=s&student=s_001')
  view.unmount()
  vi.mocked(useImportHistory).mockReturnValue({ ...ready, data: [{ id: 'i', at: '2026-04-08T12:00:00Z', by: 't', kind: 'students', rows: 12, created: 10, errors: 1 }] })
  render(<MemoryRouter><ImportHistory /></MemoryRouter>)
  expect(screen.getByRole('row', { name: /Estudiantes Luz 12 10 1/ })).toBeTruthy()
})

it('reasigna el grupo solo después de confirmar el docente de destino',async () => {
  const group = {id:'g',name:'Lectores',teacherId:'t',teacherName:'Luz',studentIds:[],studentCount:0,schoolId:'s',campus:'c',subject:'lectura' as const}
  vi.mocked(useGroups).mockReturnValue({...ready,groups:[group]})
  vi.mocked(useUsers).mockReturnValue({...ready,users:[teacher,{...teacher,uid:'n',fullName:'Nueva docente'}]})
  render(<MemoryRouter><Rosters kind="grupos"/></MemoryRouter>)
  fireEvent.click(screen.getByRole('button',{name:'Editar'}))
  fireEvent.change(screen.getByLabelText('Docente'),{target:{value:'n'}})
  const confirm = vi.spyOn(window,'confirm').mockReturnValue(false)
  fireEvent.click(screen.getByRole('button',{name:'Guardar grupo'}))
  expect(patchGroup).not.toHaveBeenCalled()
  confirm.mockReturnValue(true)
  vi.mocked(patchGroup).mockResolvedValue({...group,teacherId:'n',teacherName:'Nueva docente',syncState:'synced'})
  fireEvent.click(screen.getByRole('button',{name:'Guardar grupo'}))
  expect(await screen.findByText('Cambios guardados.')).toBeTruthy()
  expect(patchGroup).toHaveBeenCalledWith('g',{name:'Lectores',teacherId:'n'})
})

it('elige un proyecto existente y explica en español que se necesita una sede', async () => {
  render(<MemoryRouter><Schools/></MemoryRouter>)
  fireEvent.click(screen.getByRole('button',{name:'Crear institución'}))
  for (const [label,value] of [['Nombre de la institución','Institución Sur'],['Departamento','Caldas'],['Municipio','Neira'],['Proyecto','p']]) {
    fireEvent.change(screen.getByLabelText(label),{target:{value}})
  }
  expect(screen.getByRole('option',{name:'Proyecto cafetero'})).toBeTruthy()
  expect(screen.queryByLabelText('Región')).toBeNull()
  fireEvent.click(screen.getByRole('button',{name:'Guardar institución'}))
  expect((await screen.findByRole('alert')).textContent).toContain('Añade al menos una sede')
})
it('muestra la cuenta creada y conserva el aviso después de copiar las credenciales', async () => {
  vi.mocked(createAccount).mockResolvedValue({uid:'new',username:'sol.paz',password:'ejemplo'})
  render(<MemoryRouter><Teachers/></MemoryRouter>)
  fireEvent.click(screen.getByRole('button',{name:'Crear cuenta'}))
  fireEvent.change(screen.getByLabelText('Nombre completo'),{target:{value:'Sol Paz'}})
  fireEvent.change(screen.getByLabelText('Usuario'),{target:{value:'sol.paz'}})
  fireEvent.click(screen.getByLabelText('Escuela'))
  const submit=screen.getAllByRole('button',{name:'Crear cuenta'}).at(-1)!
  fireEvent.click(submit)
  expect(await screen.findByText(/Cuenta creada.*Copia la contraseña/)).toBeTruthy()
  fireEvent.click(screen.getByRole('button',{name:'Cerrar'}))
  expect(await screen.findByText('Cuenta creada')).toBeTruthy()
})
it('valida el año del programa y deja las pausas y el cierre accesibles en el diálogo', async () => {
  Object.defineProperties(HTMLDialogElement.prototype,{
    showModal:{configurable:true,value:function(this:HTMLDialogElement){this.open=true}},
    close:{configurable:true,value:function(this:HTMLDialogElement){this.open=false}}
  })
  vi.mocked(useProgramConfig).mockReturnValue({...ready,config:{projectName:'ENAd',year:2026,implementationStartDate:'2026-09-14',breaks:[]}})
  render(<Program/>)
  expect(screen.queryByLabelText('Buscar')).toBeNull()
  fireEvent.click(screen.getByRole('button',{name:'Editar configuración'}))
  fireEvent.change(screen.getByLabelText('Año del programa'),{target:{value:'1999'}})
  fireEvent.click(screen.getByRole('button',{name:'Guardar configuración'}))
  expect((await screen.findByRole('alert')).textContent).toContain('coincidir con la fecha de inicio')
  fireEvent.click(screen.getByRole('button',{name:'Añadir pausa'}))
  fireEvent.click(screen.getByRole('button',{name:'Quitar pausa'}))
  fireEvent.click(screen.getByRole('button',{name:'Cerrar'}))
  expect(screen.queryByRole('dialog')).toBeNull()
})

it('ofrece mover integrantes desde el inicio y advierte las pertenencias múltiples', () => {
  const group={id:'g',name:'Garzas',schoolId:'s',campus:'c',subject:'lectura' as const,studentIds:[student.id],studentCount:1,teacherId:'t',teacherName:'Luz'}
  vi.mocked(useGroups).mockReturnValue({...ready,groups:[group,{...group,id:'g2',name:'Uvas'},{...group,id:'g3',name:'Mangos'}]})
  render(<MemoryRouter><GroupMembers group={group} students={[student]}/></MemoryRouter>)
  const picker=screen.getByLabelText('Mover a…')
  const move=screen.getByRole('button',{name:'Mover estudiantes'}) as HTMLButtonElement
  expect(move.disabled).toBe(true)
  expect(screen.getByText(/Pertenece a varios grupos/)).toBeTruthy()
  fireEvent.change(picker,{target:{value:'g2'}})
  fireEvent.click(screen.getByLabelText('Seleccionar a Ana Paz para mover'))
  const confirm=vi.spyOn(window,'confirm').mockReturnValue(false)
  fireEvent.click(move)
  expect(confirm).toHaveBeenCalledWith('¿Mover 1 estudiante a Uvas?')
  expect(screen.queryByText('Exportar página a Excel')).toBeNull()
})
