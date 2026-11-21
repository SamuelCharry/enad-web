import { Link, useOutletContext } from 'react-router-dom'
import type { UserProfile, Role } from '../domain/types'
import { Badge, PageHeader } from '../ui/components'
import { Icon } from '../ui/Icon'

const descriptions: Record<Role, [string, string]> = {
  docente: ['Registra asistencia, evaluaciones y horas de tus grupos.', 'Consulta tus indicadores y el historial de tus estudiantes.'],
  coordinador: ['Los docentes registran los datos de clase de tu región.', 'Revisa niveles y participación en las instituciones de tu región.'],
  fundacion: ['El equipo docente y administrativo registra los datos del programa.', 'Sigue el avance del programa en todas las instituciones.'],
  admin: ['Carga instituciones, docentes, estudiantes y grupos.', 'Consulta los informes de todas las instituciones del programa.'],
}

export function Home() {
  const { rol } = useOutletContext<UserProfile>()
  const [collection, reports] = descriptions[rol]
  const readOnly = rol === 'coordinador' || rol === 'fundacion'
  return <div className="portal-home"><PageHeader title="Inicio del portal" />
    <div className="home-actions">{([
      ['/recoleccion', 'Recolección de datos', collection, 'edit'],
      ['/visualizacion', 'Visualización de datos', reports, 'chart'],
    ] as const).map(([to, title, detail, icon]) => <Link key={to} className="home-action" to={to}>
      <div className="action-icons"><Icon name={icon} size={30} /><Icon name="arrow" /></div>
      <h2>{title}</h2><p>{detail}</p>{to === '/recoleccion' && readOnly && <Badge>Solo lectura</Badge>}
    </Link>)}</div>
  </div>
}
