import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import type { Group, Student } from '../../domain/types'
import * as api from './_pending'
import { Attendance } from './Attendance'
import { Hours } from './Hours'

vi.mock('./_pending', () => ({
  useGroups: vi.fn(), useStudents: vi.fn(), useGroupAttendance: vi.fn(), saveGroupAttendance: vi.fn(),
  useProgramConfig: vi.fn(), useMyHours: vi.fn(), saveHours: vi.fn(), validateHours: vi.fn(),
  colombiaToday: () => '2026-04-08', weekOf: () => 3, rangeOf: () => ({ from: '2026-04-06', to: '2026-04-12' }),
  REASON_CATEGORIES: ['Salud', 'Otro'], parseReason: () => ({ category: null, detail: '' }),
  formatReason: (cat: string, detail: string) => cat + ': ' + detail.trim(),
}))
const group: Group = { id: 'g', name: 'Lectores', schoolId: 's', campus: 'c', subject: 'lectura', teacherId: 't', teacherName: 'Docente', studentIds: ['a', 'b'] }
function student(id: string, fullName: string): Student {
  return { id, fullName, schoolId: 's', campus: 'c', code: id, nameKey: id, grade: 3, gender: '', age: null, sample: null, retired: false, active: true, provisional: false, levels: {} }
}
const roster = [student('a', 'Alba'), student('b', 'Berta')]
// jsdom exposes HTMLDialogElement but does not implement the modal methods.
beforeAll(() => {
  Object.defineProperties(HTMLDialogElement.prototype, {
    showModal: { configurable: true, value: function (this: HTMLDialogElement) { this.open = true } },
    close: { configurable: true, value: function (this: HTMLDialogElement) { this.open = false } },
  })
})
afterAll(() => {
  Reflect.deleteProperty(HTMLDialogElement.prototype, 'showModal')
  Reflect.deleteProperty(HTMLDialogElement.prototype, 'close')
})
afterEach(cleanup)
beforeEach(() => {
  vi.resetAllMocks()
  vi.mocked(api.useGroups).mockReturnValue({ groups: [group], loading: false, error: undefined })
  vi.mocked(api.useStudents).mockReturnValue({ students: roster, loading: false, error: undefined })
  vi.mocked(api.useGroupAttendance).mockReturnValue({})
  vi.mocked(api.useProgramConfig).mockReturnValue({ config: { projectName: 'ENAd', year: 2026, implementationStartDate: '2026-03-23', breaks: [] }, loading: false, error: undefined })
  vi.mocked(api.useMyHours).mockReturnValue({ hours: [], loading: false, error: undefined })
  vi.mocked(api.saveHours).mockImplementation(async input => ({
stored: true, syncState: 'synced', report: {
      ...input, reason: input.reason ?? null, id: 'registro', teacherId: 't', week: 3, savedAt: '2026-04-08T12:00:00Z'
    }
}))
  vi.mocked(api.validateHours).mockReturnValue(null)
})
function showAttendance() {
  render(<Attendance schoolId="s" />)
  fireEvent.change(screen.getByLabelText('Grupo'), { target: { value: 'g' } })
  return screen.getByRole('button', { name: 'Guardar asistencia' })
}
function mark(name: string, value: string) {
  fireEvent.click(within(screen.getByRole('group', { name: 'Asistencia de ' + name })).getByRole('button', { name: value }))
}
function fill(label: string, value: string) { fireEvent.change(screen.getByLabelText(label), { target: { value } }) }

describe('Asistencia', () => {
  it('requiere todos los integrantes, confirma el retiro y conserva el borrador si falla el guardado', async () => {
    vi.mocked(api.saveGroupAttendance).mockRejectedValueOnce(new Error('Intenta de nuevo')).mockResolvedValueOnce({ groupId: "g", date: "2026-04-08", saved: 2, syncState: "synced" })
    const save = showAttendance()
    expect(save).toBeDisabled()
    mark('Alba', 'Vino')
    expect(save).toBeDisabled()
    expect(screen.getByText('Asistió el 50 %')).toBeInTheDocument()
    mark('Berta', 'Retirado')
    expect(save).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar' }))
    expect(save).toBeDisabled()
    mark('Berta', 'Retirado')
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar retiro' }))
    expect(save).toBeEnabled()
    fireEvent.click(save)
    expect(await screen.findByRole('alert')).toHaveTextContent('Intenta de nuevo')
    fireEvent.click(save)
    await screen.findByText('Asistencia guardada')
    expect(api.saveGroupAttendance).toHaveBeenLastCalledWith('g', '2026-04-08', { a: 'vino', b: 'retirado' })
    expect(save).toBeDisabled()
  })
  it('guarda solo cambios reales y separa los borradores por fecha', async () => {
    vi.mocked(api.useGroupAttendance).mockReturnValue({ a: 'vino', b: 'no_vino' })
    vi.mocked(api.saveGroupAttendance).mockResolvedValue({ groupId: 'g', date: '2026-04-08', saved: 1, syncState: 'synced' })
    const save = showAttendance()
    expect(save).toBeDisabled()
    mark('Berta', 'Vino')
    expect(save).toBeEnabled()
    mark('Berta', 'No vino')
    expect(save).toBeDisabled()
    mark('Berta', 'Vino')
    fill('Fecha', '2026-04-07')
    expect(save.isConnected).toBe(false)
    expect(screen.getByRole('button', { name: 'Guardar asistencia' })).toBeDisabled()
    fill('Fecha', '2026-04-08')
    fireEvent.click(screen.getByRole('button', { name: 'Guardar asistencia' }))
    await waitFor(() => expect(api.saveGroupAttendance).toHaveBeenCalledWith('g', '2026-04-08', { b: 'vino' }))
    fill('Fecha', '2026-04-09')
    expect(screen.queryByRole('button', { name: 'Guardar asistencia' })).toBeNull()
  })
  it('bloquea el guardado si faltan integrantes por cargar', () => {
    vi.mocked(api.useStudents).mockReturnValue({ students: roster.slice(0, 1), loading: false, error: undefined })
    const save = showAttendance()
    mark('Alba', 'Vino')
    expect(save).toBeDisabled()
  })
})
describe('Horas', () => {
  it('exige categoría y detalle cuando hay un déficit y guarda la fecha e institución elegidas', async () => {
    render(<Hours schoolId="s" />)
    const save = screen.getByRole('button', { name: 'Guardar horas' })
    expect(save).toBeDisabled()
    fill('Horas planeadas', '4')
    expect(save).toBeDisabled()
    fill('Horas realizadas', '2.5')
    expect(save).toBeDisabled()
    fill('Motivo', 'Salud')
    fill('Detalle del motivo', ' ')
    expect(save).toBeDisabled()
    fill('Detalle del motivo', ' Cita médica ')
    expect(save).toBeEnabled()
    fireEvent.click(save)
    await waitFor(() => expect(api.saveHours).toHaveBeenCalledWith({ date: '2026-04-08', schoolId: 's', plannedHours: 4, workedHours: 2.5, reason: 'Salud: Cita médica' }))
  })
  it('respeta errores del dominio, bloquea dos ceros y limpia el motivo al cumplir las horas', async () => {
    render(<Hours schoolId="s" />)
    const save = screen.getByRole('button', { name: 'Guardar horas' })
    fill('Horas planeadas', '0')
    fill('Horas realizadas', '0')
    expect(save).toBeDisabled()
    fill('Horas planeadas', '2')
    fill('Horas realizadas', '1')
    fill('Motivo', 'Otro')
    fill('Detalle del motivo', 'Reunión')
    vi.mocked(api.validateHours).mockReturnValue('Escribe horas entre 0 y 24.')
    fill('Horas realizadas', '25')
    expect(save).toBeDisabled()
    expect(screen.getByText('Escribe horas entre 0 y 24.')).toBeInTheDocument()
    vi.mocked(api.validateHours).mockReturnValue(null)
    fill('Horas realizadas', '2')
    expect(screen.queryByLabelText('Motivo')).toBeNull()
    fireEvent.click(save)
    await waitFor(() => expect(api.saveHours).toHaveBeenCalledWith(expect.objectContaining({ reason: null, workedHours: 2 })))
  })
})
