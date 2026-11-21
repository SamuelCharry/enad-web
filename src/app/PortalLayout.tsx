import { Link, NavLink, Outlet, useLocation, useOutletContext } from 'react-router-dom'
import type { Role, UserProfile } from '../domain/types'
import { Suspense } from 'react'
import { Icon } from '../ui/Icon'
import { useAttendanceDraftCount } from '../features/teacher/useAttendanceDrafts'
import { SwitchUser } from './sessionControls'

const roleNames: Record<Role, string> = {
  docente: 'docente', coordinador: 'coordinación', fundacion: 'fundación', admin: 'administración',
}

function AttendanceBadge({ uid }: { uid: string }) {
  const count = useAttendanceDraftCount(uid)
  return count > 0 ? <small className="teacher-draft-badge" aria-label={count === 1 ? '1 marca de asistencia por guardar' : count + ' marcas de asistencia por guardar'}>{count}</small> : null
}

export function PortalLayout() {
  const profile = useOutletContext<UserProfile>()
  const { pathname } = useLocation()
  const section = pathname.startsWith('/recoleccion') ? 'Recolección' : pathname.startsWith('/visualizacion') ? 'Visualización' : null
  const firstName = profile.fullName.trim().split(/\s+/)[0]
  return <>
    <a className="skip-link" href="#portal-main" onClick={e => { e.preventDefault(); document.getElementById('portal-main')?.focus() }}>Saltar al contenido</a>
    <header className="portal-header"><div className="shell-width portal-bar">
      <Link className="portal-brand" to="/portal" aria-label={'Portal ' + roleNames[profile.rol] + ', inicio'}>
        <img src={import.meta.env.BASE_URL + 'branding/enad_isotipo_white.png'} alt="" width="26" height="38" />
        <span>Portal <span className="role-name">{roleNames[profile.rol]}</span></span>
      </Link>
      <span className="first-name">{firstName}</span><SwitchUser />
    </div></header>
    <main data-teacher={profile.rol === 'docente' || undefined} className="shell-width portal-main" id="portal-main" tabIndex={-1}>{section &&
      <nav className="portal-crumb" aria-label="Ruta de navegación">
        <Link to="/portal"><Icon name="back" size={16} />Volver al inicio</Link>
        <span aria-hidden="true">/</span><span>{section}</span>
      </nav>}
      <Suspense fallback={<p role="status">Cargando sección…</p>}><Outlet context={profile} /></Suspense>
    </main>
    {profile.rol === 'docente' && <nav className="teacher-bottom" aria-label="Pestañas del docente">
      {([['Hoy', '/portal', 'check'], ['Grupos', '/recoleccion/grupos', 'book'], ['Estudiantes', '/recoleccion/estudiantes', 'edit'],
        ['Horas', '/recoleccion/horas', 'clock'], ['Mis datos', '/visualizacion', 'chart']] as const).map(([label, to, icon]) =>
        <NavLink key={to} to={to} aria-label={'Ir a ' + label}><Icon name={icon} size={18} /><span>{label}</span>{label === 'Hoy' && <AttendanceBadge uid={profile.uid} />}</NavLink>)}
    </nav>}
  </>
}
