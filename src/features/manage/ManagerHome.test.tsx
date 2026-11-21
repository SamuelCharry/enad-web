import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { ManagerHome } from './ManagerHome'
import { useManagementActivity } from '../../data/activity'
import { useProgramConfig, useSchools } from '../../data/scope'
import type { School, UserProfile } from '../../domain/types'
vi.mock('../../data/activity', async original => ({ ...await original<typeof import('../../data/activity')>(), useManagementActivity: vi.fn() }))
vi.mock('../../data/firebase', () => ({ db: {}, auth: {} }))
vi.mock('../../data/scope', () => ({ useSchools: vi.fn(), useProgramConfig: vi.fn() }))
afterEach(() => { cleanup(); vi.restoreAllMocks() })
it('actualiza el tablero con una toma de asistencia y abre el envío exacto del docente pendiente', () => {
  vi.spyOn(Date, 'now').mockReturnValue(Date.UTC(2026, 3, 8, 15))
  const school: School = { id: 'ie', name: 'Escuela', region: 'Centro', department: 'Caldas', municipality: 'Neira', projectId: 'p', zone: 'rural', active: true, campuses: [] }
  const profile: UserProfile = { uid: 'p', fullName: 'Sol', email: 's@example.test', rol: 'coordinador', activo: true, regions: ['Centro'], campusIds: {}, schoolIds: [], jornada: 'única' }
  vi.mocked(useSchools).mockReturnValue({ schools: [school], loading: false, error: undefined })
  vi.mocked(useProgramConfig).mockReturnValue({ config: { projectName: 'Prueba', implementationStartDate: '2026-04-06', breaks: [], year: 2026 }, loading: false, error: undefined })
  const data = { school, students: [], groups: [], teachers: [{ uid: 'd', fullName: 'Luz' }], hours: [], evaluations: [], attendance: [] }
  vi.mocked(useManagementActivity).mockReturnValue({ data: [data], loading: false, error: undefined })
  const element = <MemoryRouter><ManagerHome profile={profile} /></MemoryRouter>
  const view = render(element)
  fireEvent.click(screen.getByText(/Sin asistencia esta semana/))
  expect(screen.getByRole('link', { name: 'Luz' }).getAttribute('href')).toBe('/visualizacion/seguimiento?schoolId=ie&week=1&teacher=d')
  expect(screen.getByText('Solo lectura')).toBeTruthy()
  vi.mocked(useManagementActivity).mockReturnValue({ data: [{ ...data, attendance: [{ schoolId: 'ie', groupId: 'g', studentId: 'e', teacherId: 'd', status: 'vino', date: '2026-04-08', savedAt: '2026-04-08T12:00:00Z' }] }], loading: false, error: undefined })
  view.rerender(<MemoryRouter><ManagerHome profile={profile} /></MemoryRouter>)
  expect(screen.queryByText(/Sin asistencia esta semana/)).toBeNull()
  expect(screen.getByText('Luz · Escuela')).toBeTruthy()
  expect(screen.getByText('Asistencia · g')).toBeTruthy()
})
