import { getGroupRoster, getStudentReport } from '../../data/reports'
import { ReportTable as Table } from './TableExport'
import { Link } from 'react-router-dom'
import { levelLabel, momentLabel, subjectLabel } from '../../domain/levels'
import type { Group, Moment, ReportFilters } from '../../domain/types'
import { LevelChip } from '../../ui/components'
import { ReportRead } from './ReportState'
import { milestones } from '../../data/managementMetrics'
import { percent } from './model'
import { reportLink, useReportQuery } from './navigation'

export function GroupRoster({ group, filters }: { group: Group; filters: ReportFilters }) {
  const { params } = useReportQuery()
  const moment = params.get('moment') as Moment
  const showMoment = milestones.includes(moment)
  return <><h3>{group.name}</h3><p>{subjectLabel(group.subject)} · {group.teacherName}</p>
    <ReportRead query={JSON.stringify([group,filters,moment])} load={() => getGroupRoster(group,filters,showMoment ? moment : undefined)}>{roster =>
      roster.length ? <Table caption={'Estudiantes de ' + group.name} headers={['Estudiante', 'Código', 'Lectura', 'Matemáticas', 'Asistencia en el grupo', ...(showMoment ? [momentLabel(moment)] : [])]}
        rows={roster.map(({student:s,rate,level}) => ({
          key: s.id, cells: [<Link key="estudiante" to={reportLink('estudiante', filters, { group: group.id, student: s.id })}>{s.fullName}</Link>, s.code,
          <LevelChip key="lectura" subject="lectura" level={s.levels?.lectura?.level} />, <LevelChip key="matematicas" subject="matematicas" level={s.levels?.matematicas?.level} />, percent(rate), ...(showMoment ? [level ? levelLabel(group.subject, level) : 'Sin evaluación'] : [])]
        }))} /> : <p>Solicita la asignación de estudiantes a este grupo en Carga de datos.</p>}</ReportRead></>
}
export function StudentHistory({ filters }: { filters: ReportFilters }) {
  const { params } = useReportQuery()
  if (!filters.schoolId || !params.get('student')) return <Link to="/visualizacion/instituciones">Selecciona una institución y un estudiante</Link>
  return <History schoolId={filters.schoolId} id={params.get('student')!} filters={filters} group={params.get('group')} />
}
function History({ schoolId, id, filters, group }: { schoolId: string; id: string; filters: ReportFilters; group: string | null }) {
  return <><Link to={reportLink('instituciones', filters, group ? { group } : {})}>{group ? 'Volver al grupo' : 'Volver a la institución'}</Link>
    <ReportRead query={JSON.stringify([schoolId,id,filters])} load={() => getStudentReport(schoolId,id,filters)}>{({student:s,attendance:marks,evaluations}) => <>
      <h2>{s.fullName}</h2><p>Código {s.code} · Grado {s.grade} · {s.retired ? 'Retirado' : s.active === false ? 'Inactivo' : 'Matriculado'}</p>
      <dl className="rep-facts"><div><dt>Lectura</dt><dd><LevelChip subject="lectura" level={s.levels?.lectura?.level} /></dd></div>
        <div><dt>Matemáticas</dt><dd><LevelChip subject="matematicas" level={s.levels?.matematicas?.level} /></dd></div>
        <div><dt>Edad</dt><dd>{s.age == null ? 'Sin registrar' : s.age + ' años'}</dd></div>
        <div><dt>Muestra</dt><dd>{s.sample ?? 'Sin asignar'}</dd></div></dl>
      <h3>Historial de evaluaciones</h3>{evaluations.length ? <Table caption="Historial de evaluaciones" headers={['Fecha', 'Área', 'Momento', 'Nivel']} rows={evaluations.map(e => ({ key: e.id, cells: [e.date, subjectLabel(e.subject), momentLabel(e.moment), levelLabel(e.subject, e.level)] }))} /> : <p>Sin evaluaciones en este período. Revisa las fechas seleccionadas.</p>}
          <h3>Historial de asistencia</h3>{marks.length ? <Table caption="Historial de asistencia" headers={['Fecha', 'Grupo', 'Estado']} rows={marks.map(m => ({ key: JSON.stringify([m.groupId, m.date]), cells: [m.date, m.groupId, { vino: 'Asistió', no_vino: 'No asistió', retirado: 'Retirado' }[m.status]] }))} /> : <p>Sin asistencia en este período. Revisa las fechas seleccionadas.</p>}</>
    }</ReportRead></>
}
