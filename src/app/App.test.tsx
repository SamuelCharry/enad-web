import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { useSchools, useProgramConfig } from '../data/scope'
import { App } from './App'
import { ApiError, type Role, type UserProfile } from '../domain/types'
import { signIn, signOut, useSession } from '../data/session'

vi.mock('../data/session', () => ({ signIn: vi.fn(), signOut: vi.fn(), useSession: vi.fn() }))
vi.mock('../data/scope', () => ({ useSchools: vi.fn(), useProgramConfig: vi.fn() }))
vi.mock('../data/review', () => ({useReviewQueue:() => ({data:[]})}))
vi.mock('../features/collect', () => ({ CollectRoutes: () => <p>Contenido de recolección</p> }))
vi.mock('../features/reports', () => ({ ReportRoutes: () => <p>Contenido del informe</p> }))

const signedOut = { loading: false, user: null, profile: null }
function signedIn(rol: Role = 'docente', activo = true) {
  const profile: UserProfile = {
    uid: 'test-docente', fullName: 'Ana María', email: 'ana@example.test', rol, activo,
    schoolIds: [], campusIds: {}, jornada: 'mañana',
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
  vi.mocked(useSchools).mockReturnValue({ schools: [], loading: false, error: undefined })
  vi.mocked(useProgramConfig).mockReturnValue({ config: null, loading: false, error: undefined })
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
    expect(await screen.findByText('Verificando tu sesión…')).toBeTruthy()
    vi.mocked(useSession).mockReturnValue(signedIn())
    view.rerender(<App />)
    expect(await screen.findByText('Contenido del informe')).toBeTruthy()
    vi.mocked(useSession).mockReturnValue(signedIn('docente', false))
    view.rerender(<App />)
    expect(screen.getByRole('heading', { name: 'Tu cuenta está desactivada' })).toBeTruthy()
    expect(screen.queryByText('Contenido del informe')).toBeNull()
    vi.mocked(signOut).mockImplementation(async () => { vi.mocked(useSession).mockReturnValue(signedOut) })
    fireEvent.click(screen.getByRole('button', { name: 'Cambiar de cuenta' }))
    expect(await screen.findByLabelText('Usuario o correo electrónico')).toBeTruthy()
  })

  it('no muestra contenido con un perfil ausente o de otro usuario', async () => {
    const session = signedIn()
    vi.mocked(useSession).mockReturnValue({ ...session, profile: null })
    const view = open('/recoleccion')
    vi.mocked(useSession).mockReturnValue({ ...session, profile: { ...session.profile, uid: 'otro' } })
    view.rerender(<App />)
    expect(await screen.findByRole('heading', { name: 'No se pudo acceder al portal' })).toBeTruthy()
    expect(screen.queryByText('Contenido de recolección')).toBeNull()
  })

  it('explica el bloqueo cuando el servicio rechaza un perfil inactivo', async () => {
    vi.mocked(useSession).mockReturnValue({ ...signedIn(), profile: null, error: 'Tu cuenta está inactiva. Comunícate con la fundación.' })
    open('/portal')
    expect(await screen.findByText(/Tu cuenta está inactiva/)).toBeTruthy()
    expect(screen.queryByRole('link', { name: /Recolección/ })).toBeNull()
  })

  it.each(['docente','coordinador','fundacion'] as const)('muestra las secciones de %s', async role => {
    vi.mocked(useSession).mockReturnValue(signedIn(role))
    open('/portal')
    expect(await screen.findByText('Ana María')).toBeTruthy()
    await waitFor(() => expect(window.location.hash).toBe(role === 'docente' ? '#/portal/hoy' : '#/portal/inicio'))
    const nav = within(screen.getByRole('navigation',{name:'Menú principal'}))
    const labels = role === 'docente' ? ['Hoy','Asistencia','Evaluación','Grupos','Estudiantes','Horas','Actividades','Pendientes','Mis datos','Ayuda']
      : ['Inicio','Personas','Colegios y sedes','Estudiantes','Revisar nombres','Grupos','Actividades','Reportes','Descargas',...(role === 'fundacion' ? ['Programa'] : [])]
    expect(nav.getAllByRole('link').map(a => a.textContent)).toEqual(labels)
    expect(!!nav.queryByRole('link',{name:'Ayuda'})).toBe(role === 'docente')
    expect(!!nav.queryByRole('link',{name:'Programa'})).toBe(role === 'fundacion')
    fireEvent.click(screen.getByRole('button',{name:'Contraer barra lateral'}))
    expect(screen.getByRole('button',{name:'Ampliar barra lateral'})).toBeTruthy()
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
    expect(window.location.hash).toBe('#/portal/mis-datos')
  })

  it('valida el formulario, muestra el mensaje del servicio y lo borra al corregir', async () => {
    vi.mocked(signIn).mockRejectedValue(new ApiError(401, 'Usuario o contraseña incorrectos.'))
    open('/login')
    const submit = await screen.findByRole('button', { name: 'Ingresar' })
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
  expect(await screen.findByText('Comprensión')).toBeTruthy()
  fireEvent.click(screen.getByLabelText('Matemáticas'))
  expect(screen.getByText('Problema escrito')).toBeTruthy()
  expect(screen.queryByText('Comprensión')).toBeNull()
  fireEvent.click(screen.getAllByRole('link', { name: 'Ingresar al portal' })[0])
  expect(await screen.findByLabelText('Contraseña')).toBeTruthy()
})

it('conserva el grupo y la fecha al redirigir un enlace de clase',async () => {
  vi.mocked(useSession).mockReturnValue(signedIn())
  open('/recoleccion/asistencia?school=s&group=g&date=2026-09-04')
  await waitFor(() => expect(window.location.hash).toBe('#/portal/asistencia?school=s&group=g&date=2026-09-04'))
})

it('contiene el foco del menú móvil y lo devuelve al cerrar',async () => {
  vi.stubGlobal('matchMedia',() => ({matches:true,addEventListener:vi.fn(),removeEventListener:vi.fn()}))
  Object.defineProperties(HTMLDialogElement.prototype,{
    showModal:{configurable:true,value:function(this:HTMLDialogElement){this.open=true}},
    close:{configurable:true,value:function(this:HTMLDialogElement){this.open=false}},
  })
  try {
    vi.mocked(useSession).mockReturnValue(signedIn())
    open('/portal/hoy')
    const trigger = await screen.findByRole('button',{name:'Abrir menú'})
    fireEvent.click(trigger)
    const drawer = screen.getByRole('dialog',{name:'Menú de navegación'})
    const links = within(drawer), first = links.getByRole('link',{name:'ENAd, inicio'}), last = links.getByRole('button',{name:'Cambiar de cuenta'})
    last.focus()
    fireEvent.keyDown(last,{key:'Tab'})
    expect(document.activeElement).toBe(first)
    fireEvent.keyDown(first,{key:'Tab',shiftKey:true})
    expect(document.activeElement).toBe(last)
    fireEvent(drawer,new Event('cancel',{cancelable:true}))
    expect(document.activeElement).toBe(trigger)
    expect(screen.queryByRole('dialog')).toBeNull()
   } finally {
    Reflect.deleteProperty(HTMLDialogElement.prototype,'showModal')
    Reflect.deleteProperty(HTMLDialogElement.prototype,'close')
    vi.unstubAllGlobals()
  }
})
