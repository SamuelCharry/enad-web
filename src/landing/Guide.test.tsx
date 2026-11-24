import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { App } from '../app/App'
import { useSession } from '../data/session'
import { guideRoleFromParam } from './guideContent'

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

    const preview = screen.getByRole('region', { name: 'Guía de uso' })
    fireEvent.click(within(preview).getByRole('link', { name: /Gestión de la fundación/ }))
    expect(await screen.findByRole('heading', { name: 'Descargar la plantilla' })).toBeTruthy()
    expect(useSession).not.toHaveBeenCalled()
  })

  it('abre /guia sin sesión y cambia de recorrido y de paso', async () => {
    open('/guia')
    await screen.findByRole('heading', { name: 'Ingresar con tu cuenta' })
    expect(window.location.hash).toBe('#/guia')
    fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }))
    expect(screen.getByRole('heading', { name: 'Empezar desde Hoy' })).toBeTruthy()
    fireEvent.change(screen.getByLabelText('Ir al paso'), { target: { value: '2' } })
    expect(screen.getByRole('heading', { name: 'Guardar la asistencia' })).toBeTruthy()
    fireEvent.click(screen.getByRole('radio', { name: 'Coordinación / Fundación' }))
    expect(screen.getByRole('heading', { name: 'Consultar el resumen' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /Exportar a Excel/ }))
    expect(screen.getByRole('heading', { name: 'Exportar a Excel' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Siguiente' })).toBeNull()
    fireEvent.click(screen.getByRole('radio', { name: 'Gestión de la fundación' }))
    expect(screen.getByRole('heading', { name: 'Descargar la plantilla' })).toBeTruthy()
    expect(screen.queryByRole('heading', { name: 'Consultar el resumen' })).toBeNull()
    expect(useSession).not.toHaveBeenCalled()
  })

  it('identifica cada captura y reserva el espacio de la pantalla original', async () => {
    const assets = import.meta.glob('/public/guia/*.webp')
    const seen = new Set<string>()
    open('/guia')
    await screen.findByRole('heading', { name: 'Ingresar con tu cuenta' })
    for (const role of screen.getAllByRole('radio')) {
      fireEvent.click(role)
      for (const button of within(screen.getByRole('navigation', { name: 'Pasos de la guía' })).getAllByRole('button')) {
        fireEvent.click(button)
        const image = screen.getByRole('article').querySelector('img')
        if (!image) continue
        expect(image.alt.trim().length).toBeGreaterThan(20)
        expect([image.width, image.height]).toEqual([414, 900])
        const asset = '/public/guia/' + image.src.split('/').pop()
        expect(asset in assets).toBe(true)
        seen.add(asset)
      }
    }
    expect([...seen].sort()).toEqual(Object.keys(assets).sort())
  })

  it('explica el guardado sin señal y el acceso desde un navegador de celular', async () => {
    open('/guia')
    expect(await screen.findByRole('heading', { name: 'El portal en tu celular' })).toBeTruthy()
    expect(screen.getByText(/Si aparece Instalar app/)).toBeTruthy()
    expect(screen.getByText(/toca Compartir/)).toBeTruthy()
    const question = screen.getByText('¿Se pierde lo que registro sin señal?')
    fireEvent.click(question)
    expect(question.closest('details')?.open).toBe(true)
    expect(screen.getByText(/el registro quedó en ese dispositivo/)).toBeTruthy()
  })
})

it.each([[null, 'docente'], ['inexistente', 'docente'], ['administracion', 'administracion'], ['seguimiento', 'seguimiento']])(
  'resuelve el recorrido público %s', (input, expected) => {
    expect(guideRoleFromParam(input)).toBe(expected)
  },
)
