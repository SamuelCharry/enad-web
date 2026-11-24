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
  const pending = usePending(profile.uid)
  const count = pending.reduce((n,t) => n+t.writes.filter(w => !w.update).length,0)
  return <><nav aria-label="Registro de clase" className="day-actions">{actions.map(([label,path,icon]) =>
    <Link key={path} to={'/portal/'+path}><Icon name={icon}/>{label}<Icon name="arrow" size={18}/></Link>)}</nav>
    <nav className="day-links" aria-label="Mi jornada"><Link to="/portal/pendientes">{count} {count === 1 ? 'registro' : 'registros'} por enviar<Icon name="arrow" size={18}/></Link>
      <Link to="/portal/actividades">Actividad de hoy<Icon name="arrow" size={18}/></Link></nav></>
}
export function Help() {
  return <nav className="shortcut-list" aria-label="Guías de clase">{actions.slice(0,3).map(([label,path]) =>
    <Link key={path} to={'/portal/'+path+'?guide=1'}>{label}<Icon name="arrow"/></Link>)}<Link to="/guia">Guía pública de ENAd<Icon name="book"/></Link></nav>
}
