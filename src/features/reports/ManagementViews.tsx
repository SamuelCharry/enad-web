import { ReportTable as Table } from './TableExport'
import { Link } from 'react-router-dom'
import { getManagement, getMovement } from '../../data/reports'
import { comparison, milestones, observedMoment, teacherFollowup } from '../../data/managementMetrics'
import { momentLabel, subjectLabel } from '../../domain/levels'
import type { Moment, ReportFilters, Subject } from '../../domain/types'
import { Card, EmptyState, Field, Select } from '../../ui/components'
import { ReportRead } from './ReportState'
import { number, percent, ratio } from './model'
import { reportLink, savedTime, useReportQuery } from './navigation'

type Props = { filters: ReportFilters }
export function MovementTable({ filters, subject }: Props & { subject: Subject }) {
  return <ReportRead query={JSON.stringify([filters, subject])} load={() => getMovement(filters, subject)}>{rows => {
    return <Card><h3>Cambios de nivel por estudiante</h3><p>Se compara la última evaluación de {subjectLabel(subject).toLowerCase()} de cada estudiante en ambos momentos.</p>
      {rows.some(m => m.total > 0) ? <Table caption="Movimiento entre momentos" headers={['Momentos', 'Con ambas evaluaciones', 'Subieron', 'Se mantuvieron', 'Bajaron']}
        rows={rows.map(m => ({ key: m.from + m.to, cells: [momentLabel(m.from) + ' → ' + momentLabel(m.to), m.total, m.up, m.stable, m.down] }))} /> : <EmptyState title="Aún no hay estudiantes con dos momentos comparables." description="Amplía el período o revisa si se registró la evaluación siguiente." />}</Card>
  }}</ReportRead>
}
export function TeacherFollowUp({ filters }: Props) {
  const { params, update } = useReportQuery()
  const sort = params.get('orden') || 'nombre', teacher = params.get('teacher')
  return <><h2>Seguimiento docente</h2><ReportRead query={JSON.stringify(filters)} load={() => getManagement(filters)}>{data => {
    const selected = params.get('moment') as Moment
    const moment = milestones.includes(selected) ? selected : observedMoment(data.schools, data.from, data.to)
    const rows = data.schools.flatMap(s => teacherFollowup(s, data.config, data.from, data.to, moment)).filter(t => !teacher || t.uid === teacher)
    type Row = typeof rows[number]
    const value = (t: Row) => sort === 'asistencia' ? t.attendanceRate : sort === 'horas' ? ratio(t.worked, t.planned) : t.coverage
    rows.sort((a, b) => {
      if (sort === 'actividad') return b.last.localeCompare(a.last)
      if (sort === 'nombre') return a.fullName.localeCompare(b.fullName, 'es')
      return (value(a) ?? Infinity) - (value(b) ?? Infinity)
    })
    return <><p>{data.from} al {data.to}. La toma de asistencia cuenta semanas de implementación con registro. La cobertura cuenta estudiantes de cada área asignada.</p>
      <div className="rep-filter-grid"><Field label="Ordenar por"><Select value={sort} onChange={e => update({ orden: e.target.value })}>
        <option value="nombre">Nombre</option><option value="actividad">Actividad más reciente</option><option value="asistencia">Menor toma de asistencia</option>
        <option value="horas">Menor cumplimiento de horas</option><option value="cobertura">Menor cobertura de evaluación</option></Select></Field>
        <Field label="Momento de evaluación"><Select value={moment} onChange={e => update({ moment: e.target.value })}>{milestones.map(m => <option key={m} value={m}>{momentLabel(m)}</option>)}</Select></Field></div>
      {teacher && <Link to={reportLink('docentes', filters)}>Ver todos los docentes</Link>}
      {filters.campus && <p>Las horas corresponden a toda la institución.</p>}
      {rows.length ? <Table caption="Seguimiento por docente e institución" headers={['Docente e institución', 'Último guardado', 'Semanas con asistencia', 'Horas ejecutadas / planeadas', 'Evaluaciones cubiertas', 'Grupos']}
        rows={rows.map(t => ({
          key: JSON.stringify([t.school.id, t.uid]), cells: [<>{t.fullName}<small>{t.school.name}</small></>, savedTime(t.last),
          t.weeks + ' / ' + t.expected + ' · ' + percent(t.attendanceRate), number(t.worked) + ' / ' + number(t.planned) + ' · ' + percent(ratio(t.worked, t.planned)),
          t.evaluated + ' / ' + t.members + ' · ' + percent(t.coverage), t.groups.length ? t.groups.map(g => <Link key={g.id} to={reportLink('instituciones', filters, { schoolId: t.school.id, campus: t.school.campuses.find(c => c.name === g.campus)?.id ?? g.campus, group: g.id })}>{g.name}</Link>) : 'Sin grupos asignados']
        }))} /> :
        <EmptyState title="No hay docentes en esta selección." description="Amplía los filtros o revisa las asignaciones en Carga de datos." />}</>
  }}</ReportRead></>
}
export function CompareView({ filters }: Props) {
  const { params, update } = useReportQuery()
  const sites = !!filters.campus || params.get('por') === 'sede'
  return <><h2>Comparación de cobertura</h2><Field label="Comparar por"><Select value={sites ? 'sede' : 'institucion'} disabled={!!filters.campus} onChange={e => update({ por: e.target.value })}>
    <option value="institucion">Institución</option><option value="sede">Sede</option></Select></Field>
    <ReportRead query={JSON.stringify(filters)} load={() => getManagement(filters)}>{data => {
      const rows = data.schools.flatMap(s => (sites ? s.school.campuses.filter(c => !filters.campus || c.id === filters.campus) : [undefined]).map(c => {
        const v = comparison(s, c?.id)
        return {
          key: JSON.stringify([s.school.id, c?.id]), cells: [<Link key="institucion" to={reportLink('instituciones', filters, { schoolId: s.school.id, ...(c ? { campus: c.id } : {}) })}>{s.school.name}{c && ' · ' + c.name}</Link>,
          v.students, v.groups, v.evaluated, percent(v.attendance)]
        }
      }))
      return rows.length ? <Table caption="Comparación de instituciones y sedes" headers={[sites ? 'Institución y sede' : 'Institución', 'Estudiantes activos', 'Grupos', 'Estudiantes evaluados', 'Asistencia']} rows={rows} /> :
        <EmptyState title="Sin instituciones para comparar." description="Amplía la selección geográfica." />
    }}</ReportRead></>
}
