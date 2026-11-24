import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { ManagerHome } from './ManagerHome'
import { readDashboard } from '../../data/dashboard'
import { useProgramConfig, useSchools } from '../../data/scope'
import type { School, UserProfile } from '../../domain/types'
vi.mock('../../data/dashboard', async original => ({ ...await original<typeof import('../../data/dashboard')>(), readDashboard: vi.fn() }))
vi.mock('../../data/firebase', () => ({ db: {}, auth: {} }))
vi.mock('../../data/scope', () => ({ useSchools: vi.fn(), useProgramConfig: vi.fn() }))
afterEach(() => { cleanup(); vi.restoreAllMocks() })
it('actualiza el tablero con una toma de asistencia y abre el envío exacto del docente pendiente', async () => {
  vi.spyOn(Date, 'now').mockReturnValue(Date.UTC(2026, 3, 8, 15))
  const school: School = { id: 'ie', name: 'Escuela', region: 'Centro', department: 'Caldas', municipality: 'Neira', projectId: 'p', zone: 'rural', active: true, campuses: [] }
  const profile: UserProfile = { uid: 'p', fullName: 'Sol', email: 's@example.test', rol: 'coordinador', activo: true, campusIds: {}, schoolIds: [], jornada: 'única' }
  vi.mocked(useSchools).mockReturnValue({ schools: [school], loading: false, error: undefined })
  vi.mocked(useProgramConfig).mockReturnValue({ config: { projectName: 'Prueba', implementationStartDate: '2026-04-06', breaks: [], year: 2026 }, loading: false, error: undefined })
  const path='/visualizacion/seguimiento?schoolId=ie&week=1&teacher=d'
  const data = { insights:{attendance:[null,null],planned:0,worked:0,reporters:0}, teachers:1, students:0, moment:'linea_base' as const, feed:[], alerts:[{category:'Sin asistencia esta semana',label:'Luz',path,schoolId:'ie',count:1}] }
  vi.mocked(readDashboard).mockResolvedValueOnce(data).mockResolvedValueOnce({...data,alerts:[],feed:[{kind:'Asistencia',key:'g',author:'Luz',school:'Escuela',savedAt:'2026-04-08T12:00:00Z',detail:'g'}]})
  render(<MemoryRouter><ManagerHome profile={profile} /></MemoryRouter>)
  fireEvent.click(await screen.findByText(/Sin asistencia esta semana/))
  expect((await screen.findByRole('link',{name:'Luz'})).getAttribute('href')).toBe(path)
  expect(screen.getByText('Asistencia hasta hoy')).toBeTruthy()
  fireEvent.click(screen.getByRole('button',{name:'Actualizar'}))
  expect(await screen.findByText('Luz · Escuela')).toBeTruthy()
  expect(screen.queryByText(/Sin asistencia esta semana/)).toBeNull()
})
