import { Link, Outlet, useOutletContext } from 'react-router-dom'
import type { Role, UserProfile } from '../domain/types'
import { SwitchUser } from './sessionControls'

const roleNames: Record<Role, string> = {
  docente: 'docente', coordinador: 'coordinación', fundacion: 'fundación', admin: 'administración',
}

export function PortalLayout() {
  const profile = useOutletContext<UserProfile>()
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
    <main className="shell-width portal-main" id="portal-main" tabIndex={-1}><Outlet context={profile} /></main>
  </>
}
