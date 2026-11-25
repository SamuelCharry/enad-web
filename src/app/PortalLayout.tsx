import { preference, remember } from '../domain/preferences'
import { classDate, colombiaToday } from '../domain/weeks'
import { Link, NavLink, Navigate, Outlet, useLocation, useOutletContext } from 'react-router-dom'
import { Suspense, useEffect, useRef, useState } from 'react'
import type { UserProfile } from '../domain/types'
import { Icon } from '../ui/Icon'
import { SwitchUser } from './sessionControls'
import { homePath, legacyPath, navigationState, roleNav, sectionPurpose } from './navigation'
import { useReviewQueue } from '../data/review'

export function LegacyRedirect() {
  const {rol} = useOutletContext<UserProfile>()
  const {pathname,search} = useLocation()
  return <Navigate replace to={legacyPath(pathname,rol) + search} />
}
function ReviewCount() {
  const queue = useReviewQueue()
  return queue.data.length ? <small aria-label={queue.data.length + ' por revisar'}>{queue.data.length}</small> : null
}
export function PortalLayout() {
  const profile = useOutletContext<UserProfile>()
  const {pathname} = useLocation()
  const entries = roleNav(profile.rol)
  const section = pathname.split('/')[2]
  const {primary,title,children,label:groupLabel} = navigationState(profile.rol,section)
  const [collapsed,setCollapsed] = useState(() => preference('sidebar') === 'collapsed')
  const [drawer,setDrawer] = useState(false)
  const dialog = useRef<HTMLDialogElement>(null)
  const toggle = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    if (drawer) {
      dialog.current?.showModal()
      const size = window.matchMedia('(max-width: 900px)')
      const resize = () => { if (!size.matches) setDrawer(false) }
      size.addEventListener('change',resize)
      return () => size.removeEventListener('change',resize)
    }
    dialog.current?.close()
  },[drawer])
  function close() { dialog.current?.close(); setDrawer(false); toggle.current?.focus() }
  const sidebar = (mobile:boolean) => <>
    <div className="side-brand"><Link to={homePath(profile.rol)} onClick={mobile ? close : undefined} aria-label="ENAd, inicio">
      <img src={import.meta.env.BASE_URL + 'branding/enad_logo.png'} alt="ENAd" /></Link>
      <button type="button" className="shell-icon" aria-label={mobile ? 'Cerrar menú' : collapsed ? 'Ampliar barra lateral' : 'Contraer barra lateral'}
        onClick={mobile ? close : () => { remember('sidebar',collapsed ? 'open' : 'collapsed'); setCollapsed(!collapsed) }}><Icon name={collapsed && !mobile ? 'arrow' : 'back'} /></button></div>
    <nav aria-label="Menú principal">{entries.map(([slug,label,icon]) => <Link key={slug} className={primary === slug ? 'active' : undefined} aria-current={primary === slug ? (slug === section ? 'page' : 'location') : undefined} aria-label={label} title={label} to={'/portal/' + slug} onClick={mobile ? close : undefined}>
      <Icon name={icon} size={20}/><span>{label}</span></Link>)}</nav>
    <footer><strong>{profile.fullName}</strong><span>{{ docente:'Docente',coordinador:'Coordinación',fundacion:'Fundación' }[profile.rol]}</span>{profile.rol === 'fundacion' && <NavLink className="technical-link" aria-label="Información técnica" title="Información técnica" to="/portal/despliegue" onClick={mobile ? close : undefined}><Icon name="help" size={18}/><span>Información técnica</span></NavLink>}<SwitchUser /></footer>
  </>
  return <div className="workspace" data-collapsed={collapsed}>
    <a className="skip-link" href="#portal-main" onClick={e => { e.preventDefault(); document.getElementById('portal-main')?.focus() }}>Saltar al contenido</a>
    <aside className="side-panel">{sidebar(false)}</aside>
    {drawer && <dialog ref={dialog} className="side-drawer" aria-label="Menú de navegación" onCancel={e => { e.preventDefault(); close() }}
      onKeyDown={e => {
        if (e.key !== 'Tab') return
        const items = e.currentTarget.querySelectorAll<HTMLElement>('a[href],button:not(:disabled)')
        const first = items[0], last = items[items.length-1]
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus() }
        if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus() }
      }} onClick={e => { if (e.target === dialog.current) close() }}><div>{sidebar(true)}</div></dialog>}
    <div className="workspace-body"><header className="workspace-top">
      <button ref={toggle} className="shell-icon menu-toggle" aria-label="Abrir menú" aria-expanded={drawer} onClick={() => setDrawer(true)}><Icon name="menu"/></button>
      <h1>{title}</h1>{section === 'hoy' && <time>{classDate(colombiaToday())}</time>}
      {profile.rol !== 'docente' && <NavLink className="shell-icon" to="/portal/descargas" aria-label="Descargas" title="Descargas"><Icon name="download"/></NavLink>}
    </header><main id="portal-main" tabIndex={-1} key={JSON.stringify([profile.uid,profile.rol,profile.schoolIds,section])}>
      {sectionPurpose[section] && <p className="section-purpose">{sectionPurpose[section]}</p>}
      {children.length > 0 && <nav className="section-nav" aria-label={groupLabel}>{children.map(([slug,label]) =>
        <NavLink key={slug} to={'/portal/' + slug}>{label}{slug === 'revision' && <ReviewCount/>}</NavLink>)}</nav>}
      <Suspense fallback={<p role="status">Cargando sección…</p>}><Outlet context={profile}/></Suspense></main></div>
  </div>
}
