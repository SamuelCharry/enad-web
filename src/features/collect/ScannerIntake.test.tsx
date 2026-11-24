import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { Group, School, Student } from '../../domain/types'
import { StudentEditor } from './Students'
import { Scanner } from './Scanner'
import { createStudent, useStudents } from '../../data/students'
import { addStudentsToGroup, useGroups } from '../../data/groups'

vi.mock('../../data/students', () => ({ useStudents: vi.fn(), createStudent: vi.fn() }))
vi.mock('../../data/groups', () => ({ useGroups: vi.fn(), addStudentsToGroup: vi.fn() }))
const school = { id: 's', campuses: [] } as unknown as School
const ana = { id: 'a', fullName: 'Ana Gómez', schoolId: 's', campus: 'b', grade: 5, code: '01', gender: 'F' } as Student
const group = { id: 'g', name: 'Lectura', studentIds: ['a'], schoolId: 's', campus: 'b' } as Group
const pick = (name: string) => fireEvent.click(screen.getByRole('button', { name }))
const type = (label: string, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } })
beforeEach(() => {
  vi.resetAllMocks()
  Object.defineProperty(HTMLDialogElement.prototype, 'showModal', { configurable: true, value: function(this: HTMLDialogElement) { this.open = true } })
  Object.defineProperty(HTMLDialogElement.prototype, 'close', { configurable: true, value: function(this: HTMLDialogElement) { this.open = false } })
  vi.mocked(useStudents).mockReturnValue({ students: [ana], loading: false, error: undefined })
  vi.mocked(useGroups).mockReturnValue({ groups: [{ ...group, studentCount: 1 }], loading: false, error: undefined })
})
afterEach(cleanup)
it('busca antes de crear y conserva la identidad de un estudiante de otra sede', async () => {
  const onSaved = vi.fn()
  render(<StudentEditor school={school} campus="otra" groupId="g" admin={false} onClose={vi.fn()} onSaved={onSaved} />)
  type('Nombre completo', 'Gómez Ana')
  expect(screen.queryByText('Crear nuevo')).toBeNull()
  fireEvent.click(await screen.findByRole('button', { name: '¿Es Ana Gómez (5°)?' }))
  await waitFor(() => expect(onSaved).toHaveBeenCalledWith('a', false))
  expect(addStudentsToGroup).toHaveBeenCalledWith('g', ['a'])
  expect(createStudent).not.toHaveBeenCalled()
})
it('envía el vecino débil y reintenta la membresía sin repetir el alta', async () => {
  vi.mocked(createStudent).mockResolvedValue({ ...ana, id: 'p', syncState: 'synced' })
  const onSaved = vi.fn().mockRejectedValueOnce(new Error('No se pudo añadir al grupo.')).mockResolvedValue(undefined)
  render(<StudentEditor school={school} campus="b" admin={false} onClose={vi.fn()} onSaved={onSaved} />)
  type('Nombre completo', 'ANÍBAL   MESA')
  expect(screen.getByText('Se guardará como: Aníbal Mesa')).toBeVisible()
  fireEvent.click(screen.getByLabelText('Niño'))
  fireEvent.click(screen.getByLabelText('4°'))
  fireEvent.click(await screen.findByRole('button', { name: 'Crear nuevo' }))
  await screen.findByRole('alert')
  expect(createStudent).toHaveBeenCalledWith(expect.objectContaining({ source: 'manual', fullName: 'ANÍBAL   MESA', grade: 4, gender: 'M', reviewReasons: ['posible_duplicado:a'] }))
  pick('Completar registro')
  await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(2))
  expect(createStudent).toHaveBeenCalledOnce()
})
it('guarda nombres dudosos, respeta el grado del grupo y conserva la selección al reintentar', async () => {
  vi.mocked(createStudent).mockResolvedValue({ ...ana, id: 'p', syncState: 'synced' })
  vi.mocked(addStudentsToGroup).mockRejectedValueOnce(new Error('Intenta de nuevo.'))
  render(<Scanner schoolId="s" campus="b" students={[ana]} onClose={vi.fn()} />)
  pick('Añadir una fila omitida')
  type('Nombre · fila 1', 'Ana Gómez')
  type('Añadir al grupo', 'g')
  pick('Añadir una fila omitida')
  type('Nombre · fila 2', 'R.')
  pick('Guardar lista')
  await screen.findByRole('alert')
  expect(createStudent).toHaveBeenCalledWith(expect.objectContaining({ source: 'ocr', grade: 5, gender: '', reviewReasons: expect.arrayContaining(['solo_iniciales', 'formato_nombre']) }))
  pick('Reintentar guardado')
  await screen.findByText(/1 ya .*1 nuevo/)
  expect(addStudentsToGroup).toHaveBeenLastCalledWith('g', ['a', 'p'])
  expect(createStudent).toHaveBeenCalledOnce()
})
