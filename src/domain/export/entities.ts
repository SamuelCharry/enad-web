import { utils, writeFile } from 'xlsx'
import { validStoredHours } from '../hoursReason'
import { levelLabel, momentLabel, subjectLabel } from '../levels'
import type { Moment, School, Subject } from '../types'

export const entities = ['Personas','Estudiantes','Grupos','Asistencia','Evaluaciones','Horas','Actividades','Plan'] as const
export type Entity = typeof entities[number]
type Row = Record<string,unknown>
export type EntityRows = Partial<Record<Entity,Row[]>>

const headers:Record<Entity,string[]> = {
  Personas:['Nombre','Perfil','Usuario','Correo','Instituciones','Sedes','Jornada','Estado'],
  Estudiantes:['Nombre','Código','Institución','Sede','Grado','Sexo','Edad','Muestra','Estado','Nivel de lectura','Nivel de matemáticas','Revisión'],
  Grupos:['Grupo','Área','Institución','Sede','Docente','Integrantes'],
  Asistencia:['Fecha','Institución','Estudiante','Grupo','Docente','Asistencia'],
  Evaluaciones:['Fecha','Institución','Estudiante','Grupo','Docente','Área','Momento','Nivel','Muestra'],
  Horas:['Fecha','Institución','Docente','Semana','Horas planeadas','Horas realizadas','Motivo'],
  Actividades:['Actividad','Área','Niveles','Duración (minutos)','Descripción','Material','Estado'],
  Plan:['Fecha','Institución','Grupo','Docente','Actividad']
}
const list = (v:unknown):string[] => Array.isArray(v) ? v.filter((s):s is string => typeof s === 'string') : []
const text = (v:unknown) => typeof v === 'string' || typeof v === 'number' ? v : ''
const subject = (v:unknown):Subject|undefined => v === 'lectura' || v === 'matematicas' ? v : undefined
const lookup = (rows:Row[] = [], field:string) => new Map(rows.map(r => [r.id,String(r[field] || '')]))

export function entityWorkbook(data:EntityRows, schools:School[] = [], selected:readonly Entity[] = entities.filter(e => data[e])) {
  const book = utils.book_new()
  const schoolById = new Map(schools.map(s => [s.id,s]))
  const people = lookup(data.Personas,'fullName'), students = lookup(data.Estudiantes,'fullName'), groups = lookup(data.Grupos,'name')
  const site = (id:unknown,c:unknown) => schoolById.get(String(id))?.campuses.find(v => v.id === c || v.name === c)?.name || (c ? 'Sede sin registro' : '')
  const schoolName = (id:unknown) => schoolById.get(String(id))?.name || 'Institución sin registro'
  const state = (active:unknown) => active === false ? 'Inactivo' : 'Activo'
  function cells(entity:Entity,r:Row) {
    const school = schoolName(r.schoolId), teacher = people.get(r.teacherId) || text(r.teacherName) || 'Sin docente'
    const student = students.get(r.studentId) || 'Estudiante sin registro'
    const group = groups.get(r.groupId) || (r.groupId ? 'Grupo sin registro' : '')
    const area = subject(r.subject), label = area ? subjectLabel(area) : ''
    const level = (v:unknown) => area && typeof v === 'string' ? levelLabel(area,v) : ''
    const base = [text(r.date),school]
    switch (entity) {
      case 'Personas': {
        const roles:Record<string,string> = {docente:'Docente',coordinador:'Coordinación',fundacion:'Fundación'}
        const sites = Object.entries(r.campusIds || {}).flatMap(([id,cs]) => list(cs).map(c => site(id,c)))
        return [text(r.fullName),roles[String(r.rol)],text(r.username),text(r.email),list(r.schoolIds).map(schoolName).join(', '),sites.join(', '),r.rol === 'docente' ? text(r.jornada) : '',state(r.activo)]
      }
      case 'Estudiantes': {
        const levels = r.levels as Partial<Record<Subject,{level?:string;clave?:string}>> | undefined
        const current = (s:Subject) => levelLabel(s,levels?.[s]?.level ?? levels?.[s]?.clave ?? '')
        return [text(r.fullName),text(r.code),school,site(r.schoolId,r.campus),text(r.grade),r.gender === 'F' ? 'Niña' : r.gender === 'M' ? 'Niño' : '',text(r.age),text(r.sample),r.retired ? 'Retirado' : state(r.active),current('lectura'),current('matematicas'),r.needsReview ? 'Por revisar' : 'Sin pendientes']
      }
      case 'Grupos': return [text(r.name),label,school,site(r.schoolId,r.campus),teacher,list(r.studentIds).map(id => students.get(id) || 'Estudiante sin registro').join(', ')]
      case 'Asistencia': return [...base,student,group,teacher,({vino:'Asistió',no_vino:'No asistió',retirado:'Retirado'} as Record<string,string>)[String(r.status)] || 'Sin registrar']
      case 'Evaluaciones': return [...base,student,group,teacher,label,momentLabel(r.moment as Moment),level(r.level),text(r.sample)]
      case 'Horas': return validStoredHours(r) ? [...base,teacher,text(r.week),text(r.plannedHours),text(r.workedHours),text(r.reason)] : ['',school,teacher,'','','','Revisar registro de horas']
      case 'Actividades': return [text(r.title),label,list(r.levels).map(level).join(', '),text(r.minutes),text(r.description),text(r.link),r.active ? 'Disponible' : 'Inactiva']
      case 'Plan': return [...base,group,teacher,text(r.activityTitle)]
    }
  }
  for (const name of selected) {
    const sheet = utils.aoa_to_sheet([headers[name],...(data[name] || []).map(r => cells(name,r))])
    sheet['!cols'] = headers[name].map(h => ({wch:Math.max(18,h.length+3)}))
    utils.book_append_sheet(book,sheet,name)
  }
  return book
}
export const downloadEntities = (data:EntityRows,file:string,schools:School[],selected:readonly Entity[]) =>
  writeFile(entityWorkbook(data,schools,selected),'ENAd-'+file+'.xlsx')
