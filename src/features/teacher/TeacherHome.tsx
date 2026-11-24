import { colombiaToday } from '../../domain/weeks'
import { useTodayPlans } from '../../data/activities'
import { Link } from 'react-router-dom'
import { usePending } from '../../data/pending'
import type { UserProfile } from '../../domain/types'
import { Icon, type IconName } from '../../ui/Icon'
import './teacher.css'

const actions: [string,string,IconName][] = [
  ['Evaluación formativa','evaluacion','edit'],['Reportar asistencia','asistencia','check'],
  ['Reportar horas','horas','clock'],['Escanear lista','estudiantes?scan=1','scan'],
]
export function TeacherHome({profile}:{profile:UserProfile}) {
  const plans = useTodayPlans(colombiaToday())
  const pending = usePending(profile.uid)
  const count = pending.reduce((n,t) => n+t.writes.filter(w => !w.update).length,0)
  return <><nav aria-label="Registro de clase" className="day-actions">{actions.map(([label,path,icon]) =>
    <Link key={path} to={'/portal/'+path}><Icon name={icon}/>{label}<Icon name="arrow" size={18}/></Link>)}</nav>
    <nav className="day-links" aria-label="Mi jornada"><Link to="/portal/pendientes">{count} {count === 1 ? 'registro' : 'registros'} por enviar<Icon name="arrow" size={18}/></Link>
      <Link to="/portal/actividades">Actividad de hoy{plans.loading ? ' · Cargando…' : plans.error ? ' · No disponible' : plans.data.length ? ' · '+[...new Set(plans.data.map(p => p.activityTitle))].join(' · ') : ''}<Icon name="arrow" size={18}/></Link></nav></>
}
export function Help() {
  return <nav className="shortcut-list" aria-label="Guías de clase">{actions.slice(0,3).map(([label,path]) =>
    <Link key={path} to={'/portal/'+path+'?guide=1'}>{label}<Icon name="arrow"/></Link>)}<details><summary>Escanear una lista</summary><p>Elige una foto, revisa cada nombre y guarda la lista.</p><Link to="/portal/estudiantes?scan=1">Escanear lista</Link></details>
    <details><summary>Crear un grupo</summary><p>En Grupos, pulsa Crear grupo. Elige el área, guarda el nombre y añade los estudiantes.</p><Link to="/portal/grupos">Ver grupos</Link></details><Link to="/guia">Guía pública de ENAd<Icon name="book"/></Link></nav>
}
