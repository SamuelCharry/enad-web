import { ReportTable as Table } from './TableExport'
import { Link } from 'react-router-dom'
import { getStudentHistory, useStudents } from '../../data/students'
import { levelLabel, momentLabel, subjectLabel } from '../../domain/levels'
import type { Group, Moment, ReportFilters } from '../../domain/types'
import { LevelChip } from '../../ui/components'
import { LiveState, ReportRead } from './ReportState'
import { latestLevels, milestones } from '../../data/managementMetrics'
import { percent, studentRate } from './model'
import { reportLink, useReportQuery } from './navigation'

export function GroupRoster({ group, filters }: { group: Group; filters: ReportFilters }) {
  const { params } = useReportQuery()
  const moment = params.get('moment') as Moment
  const showMoment = milestones.includes(moment)
  const { students, loading, error } = useStudents(group.schoolId)
  const roster = students.filter(s => group.studentIds.includes(s.id))
  return <LiveState loading={loading} error={error}><h3>{group.name}</h3><p>{subjectLabel(group.subject)} · {group.teacherName}</p>
    {roster.length ? <ReportRead query={JSON.stringify([group.id, filters, roster.map(s => s.id)])} load={async signal => {
      const rates = new Map<string, { rate: number | null; level?: string }>()
      for (let i = 0; i < roster.length; i += 5) {
        signal.throwIfAborted()
        await Promise.all(roster.slice(i, i + 5).map(async s => {
          const h = await getStudentHistory(s.id)
          const evaluations = h.evaluations.filter(e => (!e.groupId || e.groupId === group.id) && (!filters.from || e.date >= filters.from) && (!filters.to || e.date <= filters.to))
          const level = showMoment ? latestLevels(evaluations, group.subject).get(s.id)?.get(moment)?.level : undefined
          rates.set(s.id, { rate: studentRate(h.attendance, group.id, filters), level })
        }))
      }
      return rates
    }}>{rates => <Table caption={'Estudiantes de ' + group.name} headers={['Estudiante', 'Código', 'Lectura', 'Matemáticas', 'Asistencia en el grupo', ...(showMoment ? [momentLabel(moment)] : [])]}
      rows={roster.map(s => ({
        key: s.id, cells: [<Link key="estudiante" to={reportLink('estudiante', filters, { group: group.id, student: s.id })}>{s.fullName}</Link>, s.code,
        <LevelChip key="lectura" subject="lectura" level={s.levels?.lectura?.level} />, <LevelChip key="matematicas" subject="matematicas" level={s.levels?.matematicas?.level} />, percent(rates.get(s.id)?.rate), ...(showMoment ? [rates.get(s.id)?.level ? levelLabel(group.subject, rates.get(s.id)!.level!) : 'Sin evaluación'] : [])]
      }))} />}</ReportRead> :
      <p>Solicita la asignación de estudiantes a este grupo en Carga de datos.</p>}</LiveState>
}
export function StudentHistory({ filters }: { filters: ReportFilters }) {
  const { params } = useReportQuery()
  if (!filters.schoolId || !params.get('student')) return <Link to="/visualizacion/instituciones">Selecciona una institución y un estudiante</Link>
  return <History schoolId={filters.schoolId} id={params.get('student')!} filters={filters} group={params.get('group')} />
}
function History({ schoolId, id, filters, group }: { schoolId: string; id: string; filters: ReportFilters; group: string | null }) {
  const { students, loading, error } = useStudents(schoolId)
  const s = students.find(v => v.id === id)
  const inside = (e: { date: string }) => (!filters.from || e.date >= filters.from) && (!filters.to || e.date <= filters.to)
  return <LiveState loading={loading} error={error}><Link to={reportLink('instituciones', filters, group ? { group } : {})}>{group ? 'Volver al grupo' : 'Volver a la institución'}</Link>
    {!s ? <p>El estudiante no está en esta institución. Revisa la selección.</p> : <><h2>{s.fullName}</h2><p>Código {s.code} · Grado {s.grade} · {s.retired ? 'Retirado' : s.active === false ? 'Inactivo' : 'Matriculado'}</p>
      <dl className="rep-facts"><div><dt>Lectura</dt><dd><LevelChip subject="lectura" level={s.levels?.lectura?.level} /></dd></div>
        <div><dt>Matemáticas</dt><dd><LevelChip subject="matematicas" level={s.levels?.matematicas?.level} /></dd></div>
        <div><dt>Edad</dt><dd>{s.age == null ? 'Sin registrar' : s.age + ' años'}</dd></div>
        <div><dt>Muestra</dt><dd>{s.sample ?? 'Sin asignar'}</dd></div></dl>
      <ReportRead query={JSON.stringify([schoolId, id])} load={() => getStudentHistory(id)}>{data => {
        const evaluations = data.evaluations.filter(inside).reverse(), marks = data.attendance.filter(inside).reverse()
        return <><h3>Historial de evaluaciones</h3>{evaluations.length ? <Table caption="Historial de evaluaciones" headers={['Fecha', 'Área', 'Momento', 'Nivel']} rows={evaluations.map(e => ({ key: e.id, cells: [e.date, subjectLabel(e.subject), momentLabel(e.moment), levelLabel(e.subject, e.level)] }))} /> : <p>Sin evaluaciones en este período. Revisa las fechas seleccionadas.</p>}
          <h3>Historial de asistencia</h3>{marks.length ? <Table caption="Historial de asistencia" headers={['Fecha', 'Grupo', 'Estado']} rows={marks.map(m => ({ key: JSON.stringify([m.groupId, m.date]), cells: [m.date, m.groupId, { vino: 'Asistió', no_vino: 'No asistió', retirado: 'Retirado' }[m.status]] }))} /> : <p>Sin asistencia en este período. Revisa las fechas seleccionadas.</p>}</>
      }}</ReportRead></>}</LiveState>
}
