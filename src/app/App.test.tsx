import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { App } from './App'
import { ApiError, type Role, type UserProfile } from '../domain/types'
import { signIn, signOut, useSession } from '../data/session'

vi.mock('../data/session', () => ({ signIn: vi.fn(), signOut: vi.fn(), useSession: vi.fn() }))
vi.mock('../features/collect', () => ({ CollectRoutes: () => <p>Contenido de recolección</p> }))
vi.mock('../features/reports', () => ({ ReportRoutes: () => <p>Contenido del informe</p> }))

const signedOut = { loading: false, user: null, profile: null }
function signedIn(rol: Role = 'docente', activo = true) {
  const profile: UserProfile = {
    uid: 'test-docente', fullName: 'Ana María', email: 'ana@example.test', rol, activo,
    schoolIds: [], campusIds: {}, jornada: 'mañana', regions: [],
  }
  // The shell reads only the UID from the Firebase User object.
  return { loading: false, user: { uid: profile.uid } as NonNullable<ReturnType<typeof useSession>['user']>, profile }
}
function open(path: string) {
  window.history.replaceState(null, '', '#' + path)
  return render(<App />)
}
beforeEach(() => {
  vi.resetAllMocks()
  vi.mocked(useSession).mockReturnValue(signedOut)
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
})
afterEach(() => { cleanup(); vi.restoreAllMocks() })

describe('Acceso al portal', () => {
  it.each(['/portal', '/recoleccion/asistencia', '/visualizacion/niveles'])('requiere sesión en %s', async path => {
    open(path)
    expect(await screen.findByRole('heading', { name: 'Ingresar al portal' })).toBeTruthy()
    expect(window.location.hash).toBe('#/login')
  })

  it('espera la sesión y bloquea la ruta si se desactiva la cuenta durante la consulta', async () => {
    vi.mocked(useSession).mockReturnValue({ ...signedOut, loading: true })
    const view = open('/visualizacion/niveles')
    expect(screen.getByText('Verificando tu sesión…')).toBeTruthy()
    vi.mocked(useSession).mockReturnValue(signedIn())
    view.rerender(<App />)
    expect(screen.getByText('Contenido del informe')).toBeTruthy()
    vi.mocked(useSession).mockReturnValue(signedIn('docente', false))
    view.rerender(<App />)
    expect(screen.getByRole('heading', { name: 'Tu cuenta está desactivada' })).toBeTruthy()
    expect(screen.queryByText('Contenido del informe')).toBeNull()
    vi.mocked(signOut).mockImplementation(async () => { vi.mocked(useSession).mockReturnValue(signedOut) })
    fireEvent.click(screen.getByRole('button', { name: 'Cambiar usuario' }))
    expect(await screen.findByLabelText('Usuario o correo electrónico')).toBeTruthy()
  })

  it('no muestra contenido con un perfil ausente o de otro usuario', () => {
    const session = signedIn()
    vi.mocked(useSession).mockReturnValue({ ...session, profile: null })
    const view = open('/recoleccion')
    vi.mocked(useSession).mockReturnValue({ ...session, profile: { ...session.profile, uid: 'otro' } })
    view.rerender(<App />)
    expect(screen.getByRole('heading', { name: 'No se pudo acceder al portal' })).toBeTruthy()
    expect(screen.queryByText('Contenido de recolección')).toBeNull()
  })

  it('explica el bloqueo cuando el servicio rechaza un perfil inactivo', () => {
    vi.mocked(useSession).mockReturnValue({ ...signedIn(), profile: null, error: 'Tu cuenta está inactiva. Contacta al administrador.' })
    open('/portal')
    expect(screen.getByText(/Tu cuenta está inactiva/)).toBeTruthy()
    expect(screen.queryByRole('link', { name: /Recolección/ })).toBeNull()
  })

  it.each([
    ['docente', 'docente', false], ['coordinador', 'coordinación', true],
    ['fundacion', 'fundación', true], ['admin', 'administración', false],
  ] as const)('muestra nombre, portal y accesos de %s', (role, title, readOnly) => {
    vi.mocked(useSession).mockReturnValue(signedIn(role))
    open('/portal')
    expect(screen.getByText('Ana')).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Portal ' + title + ', inicio' })).toBeTruthy()
    const collect = screen.getByRole('link', { name: /Recolección de datos/ })
    expect(collect.getAttribute('href')).toBe('#/recoleccion')
    expect(Boolean(within(collect).queryByText('Solo lectura'))).toBe(readOnly)
    expect(screen.getByRole('link', { name: /Visualización de datos/ }).getAttribute('href')).toBe('#/visualizacion')
  })

  it.each(['ana', 'ana@example.test'])('admite %s y regresa a la ruta solicitada', async login => {
    const view = open('/visualizacion/niveles')
    fireEvent.change(await screen.findByLabelText('Usuario o correo electrónico'), { target: { value: login } })
    fireEvent.change(screen.getByLabelText('Contraseña'), { target: { value: ' contraseña ' } })
    fireEvent.click(screen.getByRole('button', { name: 'Ingresar' }))
    await waitFor(() => expect(signIn).toHaveBeenCalledWith(login, ' contraseña '))
    vi.mocked(useSession).mockReturnValue(signedIn())
    view.rerender(<App />)
    expect(await screen.findByText('Contenido del informe')).toBeTruthy()
    expect(window.location.hash).toBe('#/visualizacion/niveles')
  })

  it('valida el formulario, muestra el mensaje del servicio y lo borra al corregir', async () => {
    vi.mocked(signIn).mockRejectedValue(new ApiError(401, 'Usuario o contraseña incorrectos.'))
    open('/login')
    const submit = screen.getByRole('button', { name: 'Ingresar' })
    fireEvent.click(submit)
    expect(screen.getByRole('alert').textContent).toContain('Escribe tu usuario')
    expect(signIn).not.toHaveBeenCalled()
    fireEvent.change(screen.getByLabelText('Usuario o correo electrónico'), { target: { value: 'ana' } })
    fireEvent.change(screen.getByLabelText('Contraseña'), { target: { value: 'prueba' } })
    fireEvent.click(submit)
    expect((await screen.findByRole('alert')).textContent).toBe('Usuario o contraseña incorrectos.')
    fireEvent.change(screen.getByLabelText('Contraseña'), { target: { value: 'corregida' } })
    expect(screen.queryByRole('alert')).toBeNull()
  })
})

it('permite explorar las dos escalas e ingresar desde la portada pública', async () => {
  open('/')
  expect(useSession).not.toHaveBeenCalled()
  expect(screen.getByText('Comprensión')).toBeTruthy()
  fireEvent.click(screen.getByLabelText('Matemáticas'))
  expect(screen.getByText('Problema escrito')).toBeTruthy()
  expect(screen.queryByText('Comprensión')).toBeNull()
  fireEvent.click(screen.getAllByRole('link', { name: 'Ingresar al portal' })[0])
  expect(await screen.findByLabelText('Contraseña')).toBeTruthy()
})
