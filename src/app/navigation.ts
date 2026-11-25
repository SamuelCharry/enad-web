import type { Role } from '../domain/types'
import type { IconName } from '../ui/Icon'

type Entry = readonly [slug: string, label: string, icon: IconName]
const teacher: Entry[] = [
  ['hoy','Hoy','home'], ['asistencia','Asistencia','check'], ['evaluacion','Evaluación','edit'],
  ['grupos','Grupos','groups'], ['estudiantes','Estudiantes','student'], ['horas','Horas','clock'],
  ['actividades','Actividades de clase','book'], ['pendientes','Pendientes','upload'], ['mis-datos','Mis datos','chart'], ['ayuda','Ayuda','help'],
]
const management: Entry[] = [
  ['inicio','Inicio','home'], ['colegios','Colegios y personas','school'], ['reportes','Reportes y alertas','chart'],
  ['actividades','Actividades de clase','book'], ['programa','Calendario','calendar'],
]
type Section = readonly [slug:string, label:string, foundationOnly?:boolean]
const sections: Record<string,Section[]> = {
  colegios: [['colegios','Colegios'], ['personas','Personas'], ['estudiantes','Estudiantes'], ['grupos','Grupos'], ['importaciones','Historial de importaciones',true]],
  reportes: [['reportes','Reportes'], ['revision','Alertas de nombres'], ['historicas','Evaluaciones históricas',true], ['calidad','Calidad de datos',true]],
}
export const sectionPurpose: Record<string,string> = {
  colegios: 'Consulta los colegios, sus sedes y las personas que participan en cada uno.',
  reportes: 'Consulta la asistencia, las horas de clase y los resultados de evaluación por institución.',
  actividades: 'Encuentra actividades de clase según el nivel de aprendizaje de cada grupo.',
  revision: 'Corrige nombres de estudiantes y revisa posibles fichas duplicadas.',
  historicas: 'Consulta y carga evaluaciones de períodos anteriores.',
  calidad: 'Encuentra registros incompletos o inconsistentes que requieren revisión.',
  importaciones: 'Consulta quién cargó cada archivo, cuántos registros se guardaron y si hubo errores.',
  programa: 'Define la fecha de inicio y las pausas que se usan para contar las semanas del programa.',
}
export function navigationState(role:Role, section:string) {
  const entries = roleNav(role)
  for (const [slug,label] of entries) {
    const children = role === 'docente' ? [] : (sections[slug] || []).filter(([, ,foundationOnly]) => !foundationOnly || role === 'fundacion')
    const child = children.find(([key]) => key === section)
    if (child || slug === section) return { primary:slug, title:child?.[1] || label, children, label }
  }
  return { primary:'', title:section === 'despliegue' && role === 'fundacion' ? 'Información técnica' : section === 'descargas' && role !== 'docente' ? 'Descargas' : entries[0][1], children:[], label:'' }
}
export const roleNav = (role:Role) => role === 'docente' ? teacher : management.filter(([slug]) => role === 'fundacion' || slug !== 'programa')
export const homePath = (role:Role) => '/portal/' + roleNav(role)[0][0]
export function legacyPath(path:string, role:Role) {
  const [, base, ...rest] = path.split('/')
  const section = rest.filter(Boolean).join('/')
  if (base === 'visualizacion') return role === 'docente' ? '/portal/mis-datos' : '/portal/reportes' + (section ? '/' + section : '')
  if (base === 'recoleccion') {
    const aliases:Record<string,string> = { instituciones:'colegios', docentes:'personas', configuracion:'programa', evaluaciones:'historicas', calidad:'calidad', importaciones:'importaciones' }
    const slug = aliases[section] || section || (role === 'docente' ? 'asistencia' : 'personas')
    if (navigationState(role,slug).primary || (role !== 'docente' && slug === 'descargas')) return '/portal/' + slug
  }
  return homePath(role)
}
