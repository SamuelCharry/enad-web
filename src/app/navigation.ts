import type { Role } from '../domain/types'
import type { IconName } from '../ui/Icon'

type Entry = readonly [slug: string, label: string, icon: IconName]
const teacher: Entry[] = [
  ['hoy','Hoy','home'], ['asistencia','Asistencia','check'], ['evaluacion','Evaluación','edit'],
  ['grupos','Grupos','groups'], ['estudiantes','Estudiantes','student'], ['horas','Horas','clock'],
  ['actividades','Actividades','book'], ['pendientes','Pendientes','upload'], ['mis-datos','Mis datos','chart'], ['ayuda','Ayuda','help'],
]
const management: Entry[] = [
  ['inicio','Inicio','home'], ['colegios','Comunidad','school'], ['reportes','Seguimiento','chart'],
  ['actividades','Actividades','book'], ['programa','Programa','calendar'],
]
type Section = readonly [slug:string, label:string]
const sections: Record<string,Section[]> = {
  colegios: [['colegios','Colegios'], ['personas','Personas'], ['estudiantes','Estudiantes'], ['grupos','Grupos']],
  reportes: [['reportes','Reportes'], ['revision','Revisar nombres']],
  programa: [['programa','Programa'], ['historicas','Evaluaciones históricas'], ['calidad','Calidad de datos'], ['importaciones','Importaciones']],
}
export function navigationState(role:Role, section:string) {
  const entries = roleNav(role)
  for (const [slug,label] of entries) {
    const children = role === 'docente' ? [] : sections[slug] || []
    const child = children.find(([key]) => key === section)
    if (child || slug === section) return { primary:slug, title:child?.[1] || label, children, label }
  }
  return { primary:'', title:section === 'descargas' && role !== 'docente' ? 'Descargas' : entries[0][1], children:[], label:'' }
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
