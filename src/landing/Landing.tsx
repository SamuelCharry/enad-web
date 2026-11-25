import { useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Icon } from '../ui/Icon'
import { PortalLink, PublicHeader } from './PublicHeader'
import { LevelScale } from './LevelScale'
import './landing.css'

const assets = import.meta.env.BASE_URL
const roles = [
  ['Docente', 'Organiza sus grupos, toma asistencia, evalúa y registra sus horas.'],
  ['Coordinación', 'Acompaña a los docentes y gestiona los grupos de sus colegios.'],
  ['Fundación', 'Gestiona cuentas, carga actividades y consulta informes de todo el programa.'],
]

export function Landing() {
  const { hash, key } = useLocation()
  useEffect(() => {
    const section = hash && document.getElementById(hash.slice(1))
    if (section) { section.focus({ preventScroll: true }); section.scrollIntoView() }
    else window.scrollTo(0, 0)
  }, [hash, key])
  return <div className="landing">
    <Link className="skip-link" to="/#programa">Saltar al contenido</Link>
    <PublicHeader />
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
        <div><h2 id="roles-title">Roles</h2><p>En ENAd Móvil y en el portal, tu cuenta define lo que puedes hacer.</p></div>
        <dl>{roles.map(([role, description]) => <div key={role}><dt>{role}</dt><dd>{description}</dd></div>)}</dl>
      </div></section>
      <section id="guia" className="shell-width guide-invitation" tabIndex={-1} aria-labelledby="guide-invitation-title">
        <div><h2 id="guide-invitation-title">Guía de despliegue</h2>
          <p>Compara los costos para 20, 100 y 500 docentes y consulta los pasos para publicar ENAd.</p>
        </div>
        <div className="guide-entry-links">
          <Link to="/guia"><strong>Consultar la guía</strong><span>Servicios, costos y publicación</span><Icon name="arrow" /></Link>
        </div>
      </section>
    </main>
    <footer className="landing-footer"><div className="shell-width">
      <img src={assets + 'branding/enad_isotipo_white.png'} alt="ENAd" width="34" height="50" />
      <span>Fundación Aprender a Quererte</span><PortalLink />
    </div></footer>
  </div>
}
