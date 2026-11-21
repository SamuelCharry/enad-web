import { Button } from '../ui/components'
import { Link, Navigate, Outlet, useLocation } from 'react-router-dom'
import { useSession } from '../data/session'
import { CheckingSession, SwitchUser } from './sessionControls'
import { Icon } from '../ui/Icon'

export function RequireSession() {
  const { loading, user, profile, error } = useSession()
  const location = useLocation()
  if (loading) return <CheckingSession />
  if (!user && !error) return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />
  if (error || !profile || profile.activo !== true || profile.uid !== user?.uid) {
    const inactive = profile?.uid === user?.uid && profile?.activo === false
    return <main className="session-state">
      <Icon name="lock" size={32} /><h1>{inactive ? 'Tu cuenta está desactivada' : 'No se pudo acceder al portal'}</h1>
      <p>{inactive ? 'Comunícate con la persona que administra ENAd para activar tu cuenta.'
        : error || 'Revisa tu conexión. Si el problema continúa, pide que verifiquen tu perfil de ENAd.'}</p>
      {error && <Button onClick={() => window.location.reload()}>Reintentar</Button>}
      {user ? <SwitchUser /> : <Link className="ui-link-button" to="/login">Volver al ingreso</Link>}
    </main>
  }
  return <Outlet context={profile} />
}
