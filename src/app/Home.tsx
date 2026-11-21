import { Link, useOutletContext } from 'react-router-dom'
import { useProgramConfig, useSchools } from '../data/scope'
import type { UserProfile, Role } from '../domain/types'
import { colombiaToday, weekOf } from '../domain/weeks'
import { Badge, PageHeader } from '../ui/components'
import { Icon } from '../ui/Icon'

const descriptions: Record<Role, [string, string]> = {
  docente: ['Registra la asistencia, las evaluaciones y las horas de tus grupos.', 'Consulta tus indicadores y el historial de tus estudiantes.'],
  coordinador: ['Los docentes registran aquí la información de clase.', 'Revisa los niveles y la participación en las instituciones de tu región.'],
  fundacion: ['Los docentes registran aquí la información de clase.', 'Sigue el avance del programa en todas las instituciones.'],
  admin: ['Administra instituciones, docentes, estudiantes y grupos.', 'Consulta los informes de implementación y aprendizaje.'],
}

const teacherLinks = [
  ['Asistencia', '/recoleccion/asistencia'], ['Evaluación formativa', '/recoleccion/evaluacion'], ['Horas', '/recoleccion/horas'],
] as const
const reportLinks = [
  ['Seguimiento de envíos', '/visualizacion/seguimiento'], ['Instituciones', '/visualizacion/instituciones'],
  ['Horas y asistencia', '/visualizacion/horas'], ['Niveles de aprendizaje', '/visualizacion/niveles'],
] as const

function Calendar() {
  const { config, loading, error } = useProgramConfig()
  const today = colombiaToday()
  const week = config && weekOf(today, config)
  return <section className="home-context"><h2>Hoy en el aula</h2>
    <time dateTime={today}>{today}</time>
    {error ? <p role="alert">{error}</p> : loading ? <p role="status">Cargando calendario…</p> :
      <p>{!config ? 'El calendario aún no está disponible.' : week ? 'Semana ' + week + ' de implementación' :
        today < config.implementationStartDate ? 'La implementación comienza el ' + config.implementationStartDate + '.' : 'Semana de receso'}</p>}
  </section>
}

function Coverage({ regional }: { regional: boolean }) {
  const { schools, loading, error } = useSchools()
  return <section className="home-context"><h2>{regional ? 'Cobertura de tu región' : 'Cobertura del programa'}</h2>
    {error ? <p role="alert">{error}</p> : loading ? <p role="status">Cargando instituciones y sedes…</p> :
      !schools.length ? <p>Aún no hay instituciones en tu ámbito de consulta.</p> :
      <dl className="coverage-counts">
        <div><dt>Instituciones</dt><dd>{schools.length.toLocaleString('es-CO')}</dd></div>
        <div><dt>Sedes</dt><dd>{schools.reduce((n, s) => n + (s.campuses?.length ?? 0), 0).toLocaleString('es-CO')}</dd></div>
      </dl>}
  </section>
}

export function Home() {
  const { rol } = useOutletContext<UserProfile>()
  const [collection, reports] = descriptions[rol]
  const teacher = rol === 'docente'
  const readOnly = rol === 'coordinador' || rol === 'fundacion'
  const collectAction = ['/recoleccion', 'Recolección de datos', collection, 'edit'] as const
  const reportAction = ['/visualizacion', 'Visualización de datos', reports, 'chart'] as const
  const actions = readOnly ? [reportAction, collectAction] : [collectAction, reportAction]
  return <div className="portal-home">
    <PageHeader title="Inicio del portal" />
    <div className="home-actions">{actions.map(([to, title, detail, icon], index) => <Link key={to} className="home-action" data-featured={index === 0} to={to}>
      <div className="action-icons"><Icon name={icon} size={28} /><Icon name="arrow" /></div>
      <h2>{title}</h2><p>{detail}</p>{to === '/recoleccion' && readOnly && <Badge>Solo lectura</Badge>}
    </Link>)}</div>
    <div className="home-details">
      {teacher ? <Calendar /> : <Coverage regional={rol === 'coordinador'} />}
      <nav className="shortcut-list" aria-labelledby="shortcut-title">
        <h2 id="shortcut-title">{teacher ? 'Registro de clase' : 'Informes'}</h2>
        {(teacher ? teacherLinks : reportLinks).map(([label, to]) => <Link key={to} to={to}>{label}<Icon name="arrow" size={18} /></Link>)}
      </nav>
    </div>
  </div>
}
