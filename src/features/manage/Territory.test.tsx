import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import type { School } from '../../domain/types'
import { Territory } from './Territory'
import { departmentId } from './territoryGeography'

vi.mock('../../data/firebase', () => ({db:{}, auth:{}}))
vi.mock('../../data/students', () => ({useStudents: () => ({students:[{id:'ana',fullName:'Ana Rivera',grade:3}],loading:false})}))
vi.mock('../../data/groups', () => ({useGroups: () => ({groups:[{id:'g',name:'Lectores',campus:'Centro',subject:'lectura',studentIds:['ana']}],loading:false})}))
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
  expect(screen.getByRole('link',{name:'Lectores'}).getAttribute('href')).toContain('schoolId=s&campus=c&group=g')
})

it('enfoca los encabezados al abrir el directorio y devuelve el foco a cada fila de origen', () => {
  render(<MemoryRouter><Territory schools={[school]}/></MemoryRouter>)
  const directory = within(screen.getByRole('complementary',{name:'Explorar comunidad por departamento'}))
  const department = () => directory.getByRole('button',{name:/Caldas.*colegio/})
  const institution = () => directory.getByRole('button',{name:/Escuela del Río/})
  department().focus()
  fireEvent.click(department(),{detail:0})
  expect(document.activeElement).toBe(directory.getByRole('heading',{name:'Caldas'}))
  institution().focus()
  fireEvent.click(institution(),{detail:0})
  expect(document.activeElement).toBe(directory.getByRole('heading',{name:school.name}))
  fireEvent.click(directory.getByRole('button',{name:/Caldas/}),{detail:0})
  expect(document.activeElement).toBe(institution())
  fireEvent.click(directory.getByRole('button',{name:/Departamentos/}),{detail:0})
  expect(document.activeElement).toBe(department())
})

it('mantiene el foco geográfico al seleccionar y regresar desde una región sin colegios', () => {
  render(<MemoryRouter><Territory schools={[school]}/></MemoryRouter>)
  const region = screen.getByRole('button',{name:'Amazonas, 0 colegios'})
  region.focus()
  fireEvent.keyDown(region,{key:' '})
  expect(document.activeElement).toBe(region)
  const back = screen.getByRole('button',{name:/Departamentos/})
  back.focus()
  fireEvent.click(back,{detail:0})
  expect(document.activeElement).toBe(region)
})

it('muestra por defecto una escala de colegios con el mismo tono para cantidades iguales', () => {
  render(<MemoryRouter><Territory schools={[school, {...school,id:'c2'}, {...school,id:'q',department:'Quindío'}, {...school,id:'a',department:'Antioquia'}]}/></MemoryRouter>)
  const map = within(screen.getByRole('group',{name:'Mapa interactivo de Colombia'}))
  const shade = (name:string) => map.getByRole('button',{name}).getAttribute('fill')
  expect(screen.getByText('Colegios por departamento')).toBeTruthy()
  expect(shade('Quindío, 1 colegio')).toEqual(shade('Antioquia, 1 colegio'))
  expect(shade('Caldas, 2 colegios')).not.toEqual(shade('Quindío, 1 colegio'))
  expect(shade('Amazonas, 0 colegios')).not.toEqual(shade('Quindío, 1 colegio'))
})
