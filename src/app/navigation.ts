import type { Role } from '../domain/types'
import type { IconName } from '../ui/Icon'

type Entry = readonly [slug: string, label: string, icon: IconName]
const teacher: Entry[] = [
  ['hoy','Hoy','home'], ['asistencia','Asistencia','check'], ['evaluacion','Evaluación','edit'],
  ['grupos','Grupos','groups'], ['estudiantes','Estudiantes','student'], ['horas','Horas','clock'],
  ['actividades','Actividades','book'], ['pendientes','Pendientes','upload'], ['mis-datos','Mis datos','chart'], ['ayuda','Ayuda','help'],
]
const management: Entry[] = [
  ['inicio','Inicio','home'], ['personas','Personas','person'], ['colegios','Colegios y sedes','school'],
  ['estudiantes','Estudiantes','student'], ['revision','Revisar nombres','edit'], ['grupos','Grupos','groups'],
  ['actividades','Actividades','book'], ['reportes','Reportes','chart'], ['descargas','Descargas','download'], ['programa','Programa','calendar'],
]
export const roleNav = (role:Role) => role === 'docente' ? teacher : management.filter(([slug]) => role === 'fundacion' || slug !== 'programa')
export const homePath = (role:Role) => '/portal/' + roleNav(role)[0][0]
export function legacyPath(path:string, role:Role) {
  const [, base, ...rest] = path.split('/')
  const section = rest.filter(Boolean).join('/')
  if (base === 'visualizacion') return role === 'docente' ? '/portal/mis-datos' : '/portal/reportes' + (section ? '/' + section : '')
  if (base === 'recoleccion') {
    const aliases:Record<string,string> = { instituciones:'colegios', docentes:'personas', configuracion:'programa', evaluaciones:'historicas', calidad:'calidad', importaciones:'importaciones' }
    const slug = aliases[section] || section || (role === 'docente' ? 'asistencia' : 'personas')
    if (roleNav(role).some(([key]) => slug === key) || (role === 'fundacion' && ['historicas','calidad','importaciones'].includes(slug))) return '/portal/' + slug
  }
  return homePath(role)
}
