import { Link } from 'react-router-dom'
import { Icon } from '../ui/Icon'

export function PortalLink({ primary = false }: { primary?: boolean }) {
  return <Link to="/login" className={'ui-link-button landing-cta' + (primary ? ' primary' : '')}>
    Ingresar al portal<Icon name="arrow" size={18} /></Link>
}

export function PublicHeader({ guide = false }: { guide?: boolean }) {
  return <header className="public-header"><div className="shell-width public-bar">
    <Link className="brand-link" to="/" aria-label="ENAd, inicio">
      <img src={import.meta.env.BASE_URL + 'branding/enad_logo.png'} alt="ENAd" />
    </Link>
    <nav aria-label="Navegación principal">
      <Link to="/#funcionamiento">Cómo funciona</Link>
      <Link to="/#roles">Roles</Link>
      <Link to="/guia" aria-current={guide ? 'page' : undefined}>Guía de uso</Link>
    </nav>
    <PortalLink />
  </div></header>
}
