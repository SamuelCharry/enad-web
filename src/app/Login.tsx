import { useState, type FormEvent } from 'react'
import { Link, Navigate, useLocation } from 'react-router-dom'
import { signIn, useSession } from '../data/session'
import { ApiError } from '../domain/types'
import { Button, Field, TextInput } from '../ui/components'
import { Icon } from '../ui/Icon'
import { CheckingSession } from './sessionControls'

function loginError(error: unknown) {
  if (error instanceof ApiError) return error.message
  const code = error && typeof error === 'object' && 'code' in error ? error.code : ''
  switch (code) {
    case 'auth/invalid-credential': case 'auth/invalid-email': case 'auth/wrong-password': case 'auth/user-not-found':
      return 'Usuario o contraseña incorrectos.'
    case 'auth/user-disabled': return 'Tu cuenta está desactivada. Contacta al administrador.'
    case 'auth/too-many-requests': return 'Demasiados intentos. Espera unos minutos e intenta de nuevo.'
    case 'auth/network-request-failed': return 'No pudimos conectar. Revisa tu conexión.'
    default: return 'No pudimos abrir la sesión. Revisa tus datos e intenta de nuevo.'
  }
}

export function Login() {
  const { user, loading, error: sessionError } = useSession()
  const { state } = useLocation()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [visible, setVisible] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  if (loading) return <CheckingSession />
  if (user) {
    const from: unknown = state?.from
    const target = typeof from === 'string' && /^\/(?:portal|recoleccion|visualizacion)(?:[/?]|$)/.test(from) ? from : '/portal'
    return <Navigate to={target} replace />
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy) return
    const login = username.trim()
    const validLogin = /^(?:[\w.-]+|[^\s@]+@[^\s@]+\.[^\s@]+)$/.test(login)
    if (!validLogin || !password) {
      const field = event.currentTarget.elements.namedItem(!validLogin ? 'usuario' : 'clave')
      if (field instanceof HTMLInputElement) field.focus()
      setError('Escribe tu usuario o correo y tu contraseña.')
      return
    }
    setBusy(true)
    setError('')
    try { await signIn(login, password) }
    catch (failure) { setError(loginError(failure)) }
    finally { setBusy(false) }
  }
  return <main className="login-page">
    <Link className="back-link" to="/"><Icon name="back" size={18} />Volver al inicio</Link>
    <div className="login-form">
      <img className="login-logo" src={import.meta.env.BASE_URL + 'branding/enad_logo.png'} alt="ENAd, Enseñar al nivel adecuado" />
      <h1>Ingresar al portal</h1><p>Usa la misma cuenta de ENAd Móvil.</p>
      <form onSubmit={submit} noValidate onChange={() => setError('')}>
        <Field label="Usuario o correo electrónico"><TextInput name="usuario" autoComplete="username" autoCapitalize="none" spellCheck={false} required
          value={username} onChange={e => setUsername(e.target.value)} /></Field>
        <Field label="Contraseña"><div className="password-control"><TextInput name="clave" type={visible ? 'text' : 'password'} required
          autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} />
          <button type="button" aria-label={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'} onClick={() => setVisible(!visible)}>
            {visible ? 'Ocultar' : 'Mostrar'}</button></div></Field>
        {(error || sessionError) && <p className="ui-error" role="alert">{error || 'No pudimos recuperar tu sesión. Intenta ingresar de nuevo.'}</p>}
        <Button type="submit" variant="primary" loading={busy}>Ingresar</Button>
      </form>
    </div>
  </main>
}
