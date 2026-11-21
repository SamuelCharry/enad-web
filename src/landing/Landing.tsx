import { useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Icon } from '../ui/Icon'
import { LevelScale } from './LevelScale'
import './landing.css'

const assets = import.meta.env.BASE_URL
const roles = [
  ['Docente', 'Registra la asistencia, las evaluaciones y las horas de clase. Organiza sus grupos y consulta el avance de sus estudiantes.'],
  ['Coordinación', 'Consulta la participación y los niveles de aprendizaje en las instituciones de su región. Su acceso es de solo lectura.'],
  ['Fundación', 'Da seguimiento al programa en todas las regiones. Puede consultar los informes y el detalle de cada estudiante.'],
  ['Administración', 'Gestiona instituciones, sedes, docentes y estudiantes. Carga datos y configura las semanas de implementación.'],
]

function PortalLink({ primary = false }: { primary?: boolean }) {
  return <Link to="/login" className={'ui-link-button landing-cta' + (primary ? ' primary' : '')}>
    Ingresar al portal<Icon name="arrow" size={18} /></Link>
}

export function Landing() {
  const { hash, key } = useLocation()
  useEffect(() => {
    const section = hash && document.getElementById(hash.slice(1))
    if (section) { section.focus({ preventScroll: true }); section.scrollIntoView() }
    else window.scrollTo(0, 0)
  }, [hash, key])
  return <div className="landing">
    <Link className="skip-link" to="/#programa">Saltar al contenido</Link>
    <header className="public-header"><div className="shell-width public-bar">
      <Link className="brand-link" to="/" aria-label="ENAd, inicio"><img src={assets + 'branding/enad_logo.png'} alt="ENAd" /></Link>
      <nav aria-label="Navegación principal"><Link to="/#funcionamiento">Cómo funciona</Link><Link to="/#roles">Roles</Link></nav>
      <PortalLink />
    </div></header>
    <main>
      <section id="programa" className="hero" tabIndex={-1} aria-labelledby="hero-title"><div className="shell-width hero-grid">
        <div className="hero-copy">
          <h1 id="hero-title">Enseñar al<br /><em>nivel adecuado.</em></h1>
          <p>En ENAd, los estudiantes de tercero a quinto aprenden en grupos según su nivel de lectura y matemáticas. Cada evaluación ayuda a decidir qué trabajar en clase.</p>
          <PortalLink primary />
          <p className="foundation-credit">Un programa de la <strong>Fundación Aprender a Quererte</strong></p>
        </div>
        <LevelScale />
      </div></section>
      <section id="funcionamiento" className="shell-width story-section" tabIndex={-1} aria-labelledby="story-title">
        <div className="story-intro"><h2 id="story-title">Del aula al portal.</h2>
          <p>La aplicación y el portal comparten los mismos registros. Con conexión, los cambios se sincronizan en ambos sentidos.</p>
        </div>
        <div className="workflow">
          <figure className="app-sample">
            <img src={assets + 'programa/registro-horas.webp'} width="414" height="810" loading="lazy"
              alt="Pantalla de ENAd Móvil para registrar las horas programadas y realizadas en una semana de implementación." />
            <figcaption>Registro de horas en ENAd Móvil</figcaption>
          </figure>
          <div className="workflow-text">
            <article><h3>Registrar en clase</h3><p>En ENAd Móvil, el docente toma asistencia por grupo, evalúa a cada estudiante y registra sus horas. También puede hacerlo desde el portal.</p></article>
            <article><h3>Seguir el aprendizaje</h3><p>Los informes reúnen los niveles de lectura y matemáticas desde la línea base hasta la línea final. El equipo puede seguir los cambios por institución, sede y grupo.</p></article>
            <article><h3>Trabajar con el mismo registro</h3><p>Cuando vuelve la conexión, los registros pendientes del celular se envían al portal. Las actualizaciones del portal también llegan a la aplicación.</p></article>
          </div>
        </div>
      </section>
      <section id="roles" className="roles-section" tabIndex={-1} aria-labelledby="roles-title"><div className="shell-width roles-grid">
        <h2 id="roles-title">Quién usa<br /> el portal</h2>
        <dl>{roles.map(([role, description]) => <div key={role}><dt>{role}</dt><dd>{description}</dd></div>)}</dl>
      </div></section>
    </main>
    <footer className="landing-footer"><div className="shell-width">
      <img src={assets + 'branding/enad_isotipo_white.png'} alt="ENAd" width="34" height="50" />
      <span>Fundación Aprender a Quererte</span><PortalLink />
    </div></footer>
  </div>
}
