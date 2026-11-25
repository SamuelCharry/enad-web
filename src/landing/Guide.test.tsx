import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { App } from '../app/App'
import { useSession } from '../data/session'
import { monthlyCost } from './deploymentCost'

vi.mock('../data/session', () => ({
  useSession: vi.fn(() => ({ user: null, profile: null, loading: false })),
}))

function open(path: string) {
  window.history.replaceState(null, '', '#' + path)
  render(<App />)
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
})
afterEach(() => { cleanup(); vi.restoreAllMocks() })

describe('Portada y guía pública', () => {
  it('enlaza Roles y diferencia el alcance de las tres cuentas', async () => {
    open('/')
    const section = await screen.findByRole('region', { name: 'Roles' })
    expect(screen.getByRole('link', { name: 'Roles' }).getAttribute('href')).toBe('#/#roles')
    expect(section.id).toBe('roles')
    section.scrollIntoView = vi.fn()
    fireEvent.click(screen.getByRole('link', { name: 'Roles' }))
    expect(document.activeElement).toBe(section)
    expect(section.scrollIntoView).toHaveBeenCalled()
    expect(within(section).getAllByRole('term').map(term => term.textContent)).toEqual([
      'Docente', 'Coordinación', 'Fundación',
    ])
    const descriptions = within(section).getAllByRole('definition')
    expect(descriptions[1].textContent).toMatch(/sus colegios/)
    expect(descriptions[2].textContent).toMatch(/todo el programa/)

    const preview = screen.getByRole('region', { name: 'Guía de despliegue' })
    fireEvent.click(within(preview).getByRole('link', { name: /Consultar la guía/ }))
    expect(await screen.findByRole('heading', { name: 'Calcula un mes de clases' })).toBeTruthy()
    expect(useSession).not.toHaveBeenCalled()
  })

  it('recalcula los tres tamaños y muestra los campos inválidos', async () => {
    open('/guia')
    const photos = await screen.findByLabelText('Fotos por docente al día')
    expect(screen.getByText('14,22')).toBeTruthy()
    fireEvent.change(photos, { target: { value: '0' } })
    expect(screen.queryByText('14,22')).toBeNull()
    expect(screen.getAllByText('0,72')).toHaveLength(2)
    fireEvent.change(photos, { target: { value: '-1' } })
    expect(photos.getAttribute('aria-invalid')).toBe('true')
    expect(screen.getAllByText('—')).toHaveLength(9)
    expect(useSession).not.toHaveBeenCalled()
  })
})

it('aplica la cuota en cada día activo y prorratea el excedente', () => {
  expect(monthlyCost(1, { days: 2, reads: 100000, writes: 40000, photos: 500 }).firestore).toBeCloseTo(0.099)
  expect(monthlyCost(1, { days: 2, reads: 50000, writes: 20000, photos: 500 }).subtotal).toBe(0)
  expect(monthlyCost(1, { days: 0, reads: 90000, writes: 90000, photos: 1000 }).subtotal).toBe(0)
  expect(monthlyCost(500, { days: 20, reads: 0, writes: 0, photos: 1000 }).vision).toBeCloseTo(10498.5)
})
