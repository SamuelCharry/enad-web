import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { School, Student } from '../../domain/types'
import { StudentEditor } from './Students'
import { createStudent, useStudents } from '../../data/students'
import { addStudentsToGroup } from '../../data/groups'

vi.mock('../../data/students', () => ({ useStudents: vi.fn(), createStudent: vi.fn() }))
vi.mock('../../data/groups', () => ({ addStudentsToGroup: vi.fn() }))
const school = { id: 's', campuses: [] } as unknown as School
const ana = { id: 'a', fullName: 'Ana Gómez', schoolId: 's', campus: 'b', grade: 5, code: '01', gender: 'F' } as Student
const pick = (name: string) => fireEvent.click(screen.getByRole('button', { name }))
const type = (label: string, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } })
beforeEach(() => {
  vi.resetAllMocks()
  Object.defineProperty(HTMLDialogElement.prototype, 'showModal', { configurable: true, value: function(this: HTMLDialogElement) { this.open = true } })
  Object.defineProperty(HTMLDialogElement.prototype, 'close', { configurable: true, value: function(this: HTMLDialogElement) { this.open = false } })
  vi.mocked(useStudents).mockReturnValue({ students: [ana], loading: false, error: undefined })
})
afterEach(cleanup)
it('busca antes de crear y conserva la identidad de un estudiante de otra sede', async () => {
  const onSaved = vi.fn()
  render(<StudentEditor school={school} campus="otra" groupId="g" admin={false} onClose={vi.fn()} onSaved={onSaved} />)
  type('Nombre completo', 'Gómez Ana')
  expect(screen.queryByText('Crear nuevo')).toBeNull()
  const suggestion = await screen.findByRole('button', { name: '¿Es Ana Gómez (5°)?' })
  expect(screen.getByText('No, es un estudiante nuevo')).toBeVisible()
  fireEvent.click(suggestion)
  await waitFor(() => expect(onSaved).toHaveBeenCalledWith('a', false,'selected'))
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
  expect(createStudent).toHaveBeenCalledWith(expect.objectContaining({ source: 'manual', fullName: 'ANÍBAL   MESA', grade: 4, gender: 'M', reviewReasons: [] }))
  pick('Completar registro')
  await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(2))
  expect(createStudent).toHaveBeenCalledOnce()
})

it('permite registrar un homónimo después de ofrecer la coincidencia', async () => {
  vi.mocked(createStudent).mockResolvedValue({...ana,id:'nuevo',syncState:'synced'})
  render(<StudentEditor school={school} campus="b" admin={false} onClose={vi.fn()} onSaved={vi.fn()}/>)
  type('Nombre completo','Ana Gómez')
  const match = await screen.findByRole('button',{name:/¿Es Ana Gómez/})
  const create = screen.getByRole('button',{name:'No, es un estudiante nuevo'})
  expect(match.compareDocumentPosition(create) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  fireEvent.click(create)
  fireEvent.click(screen.getByLabelText('Niña'))
  fireEvent.click(screen.getByLabelText('5°'))
  pick('Crear nuevo')
  await waitFor(() => expect(createStudent).toHaveBeenCalledWith(expect.objectContaining({reviewReasons:expect.arrayContaining(['posible_duplicado:a'])})))
})
