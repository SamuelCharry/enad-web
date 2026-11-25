import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import type { School } from '../../domain/types'
import { departmentId, Territory } from './Territory'

vi.mock('../../data/firebase', () => ({db:{}, auth:{}}))
vi.mock('../../data/students', () => ({useStudents: () => ({students:[{id:'ana',fullName:'Ana Rivera',grade:3}],loading:false})}))
vi.mock('../../data/groups', () => ({useGroups: () => ({groups:[{id:'g',name:'Lectores',subject:'lectura',studentIds:['ana']}],loading:false})}))
vi.mock('firebase/firestore', async original => ({...await original<typeof import('firebase/firestore')>(),collection:vi.fn()}))
vi.mock('../../data/reads',async original => ({...await original<typeof import('../../data/reads')>(),rows:() => Promise.resolve([{id:'d',uid:'d',fullName:'Sol Ruiz'}])}))
afterEach(cleanup)

const school: School = {id:'s', name:'Escuela del Río', department:'Caldas', municipality:'Neira', campuses:[{id:'c',name:'Centro',jornada:'única'}],active:true,zone:'rural',region:'',projectId:''}
it('conserva distritos, tildes y colegios sin ubicación sin adivinar un departamento', () => {
  expect(departmentId('QUINDIO')).toBe('QUI')
  expect(departmentId('Bogotá D.C.')).toBe('DC')
  expect(departmentId('Archipiélago de San Andrés, Providencia y Santa Catalina')).toBe('SAP')
  expect(departmentId('Cali')).toBe('sin-departamento')
})
it('explora colegios desde el mapa con teclado y ofrece los tres directorios de la institución', async () => {
  render(<MemoryRouter><Territory schools={[school,{...school,id:'u',department:''}]}/></MemoryRouter>)
  const map=screen.getByRole('group',{name:'Mapa interactivo de Colombia'})
  expect(within(map).getAllByRole('button')).toHaveLength(33)
  expect(screen.getByRole('button',{name:/Sin departamento identificado/})).toBeTruthy()
  fireEvent.change(screen.getByLabelText('Ver en el mapa'),{target:{value:'campuses'}})
  fireEvent.keyDown(within(map).getByRole('button',{name:'Caldas, 1 sede'}),{key:'Enter'})
  fireEvent.click(screen.getByRole('button',{name:/Escuela del Río/}))
  expect((await screen.findByRole('link',{name:'Sol Ruiz'})).getAttribute('href')).toContain('schoolId=s&teacher=d')
  fireEvent.click(screen.getByRole('button',{name:'Estudiantes'}))
  expect(screen.getByRole('link',{name:'Ana Rivera'}).getAttribute('href')).toContain('schoolId=s&student=ana')
  fireEvent.click(screen.getByRole('button',{name:'Grupos'}))
  expect(screen.getByText('Lectores')).toBeTruthy()
})
