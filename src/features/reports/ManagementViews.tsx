import { useState } from 'react'
import { ReportTable as Table } from './TableExport'
import { Link } from 'react-router-dom'
import { getComparison, getFollowup, getMovement } from '../../data/reports'
import { milestones } from '../../data/managementMetrics'
import { momentLabel, subjectLabel } from '../../domain/levels'
import type { ReportFilters, Subject } from '../../domain/types'
import { Button, Card, EmptyState, Field, Select } from '../../ui/components'
import { ReportRead } from './ReportState'
import { number, percent, ratio } from './model'
import { reportLink, savedTime, useReportQuery } from './navigation'

type Props = { filters: ReportFilters }
export function MovementTable({ filters, subject }: Props & { subject: Subject }) {
  const { params, update } = useReportQuery()
  const start = milestones.slice(0,-1).find(m => m === params.get('inicio')) ?? milestones[0]
  const later = milestones.slice(milestones.indexOf(start)+1)
  const end = later.find(m => m === params.get('fin')) ?? later[0]
  const [open, setOpen] = useState(false)
  return <Card><h3>Cambios de nivel por estudiante</h3>
    <div className="rep-filter-grid">{([['Primer momento',start,'inicio'],['Segundo momento',end,'fin']] as const).map(([label,value,key]) =>
      <Field key={key} label={label}><Select value={value} onChange={e => update({[key]:e.target.value})}>
        {(key === 'inicio' ? milestones.slice(0,-1) : later).map(m => <option key={m} value={m}>{momentLabel(m)}</option>)}</Select></Field>)}</div>
    <p>Compara la última evaluación de {subjectLabel(subject).toLowerCase()} de cada estudiante en ambos momentos del período.</p>
    {!open ? <Button onClick={() => setOpen(true)}>Comparar momentos</Button> : <ReportRead query={JSON.stringify([filters, subject,start,end])} load={() => getMovement(filters, subject,start,end)}>{rows =>
      rows.some(m => m.total > 0) ? <Table caption="Movimiento entre momentos" headers={['Momentos', 'Con ambas evaluaciones', 'Subieron', 'Se mantuvieron', 'Bajaron']}
        rows={rows.map(m => ({ key: m.from + m.to, cells: [momentLabel(m.from) + ' → ' + momentLabel(m.to), m.total, m.up, m.stable, m.down] }))} /> : <EmptyState title="Aún no hay estudiantes con dos momentos comparables." description="Amplía el período o revisa si se registró la evaluación siguiente." />
    }</ReportRead>}</Card>
}
export function TeacherFollowUp({ filters }: Props) {
  const { params, update } = useReportQuery()
  const sort = params.get('orden') || 'nombre', teacher = params.get('teacher')
  const selected = milestones.find(m => m === params.get('moment'))
  return <><h2>Seguimiento docente</h2><ReportRead query={JSON.stringify([filters,selected,teacher])} load={() => getFollowup(filters,selected,teacher || undefined)}>{data => {
    const moment = data.moment, rows = [...data.teachers]
    type Row = typeof rows[number]
    const value = (t: Row) => sort === 'asistencia' ? t.attendanceRate : sort === 'horas' ? ratio(t.worked, t.planned) : t.coverage
    rows.sort((a, b) => {
      if (sort === 'actividad') return b.last.localeCompare(a.last)
      if (sort === 'nombre') return a.fullName.localeCompare(b.fullName, 'es')
      return (value(a) ?? Infinity) - (value(b) ?? Infinity)
    })
    return <>{data.unavailable.length > 0 && <p role="alert">No disponible · {data.unavailable.join(', ')}</p>}<p>{data.from} al {data.to}. La toma de asistencia cuenta semanas de implementación con registro. La cobertura cuenta estudiantes de cada área asignada.</p>
      <div className="rep-filter-grid"><Field label="Ordenar por"><Select value={sort} onChange={e => update({ orden: e.target.value })}>
        <option value="nombre">Nombre</option><option value="actividad">Actividad más reciente</option><option value="asistencia">Menor toma de asistencia</option>
        <option value="horas">Menor cumplimiento de horas</option><option value="cobertura">Menor cobertura de evaluación</option></Select></Field>
        <Field label="Momento de evaluación"><Select value={moment} onChange={e => update({ moment: e.target.value })}>{milestones.map(m => <option key={m} value={m}>{momentLabel(m)}</option>)}</Select></Field></div>
      {teacher && <Link to={reportLink('docentes', filters)}>Ver todos los docentes</Link>}
      {filters.campus && <p>Las horas corresponden a toda la institución.</p>}
      {rows.length ? <Table caption="Seguimiento por docente e institución" headers={['Docente e institución', 'Último guardado', 'Semanas con asistencia', 'Horas ejecutadas / planeadas', 'Evaluaciones cubiertas', 'Grupos']}
        rows={rows.map(t => ({
          key: JSON.stringify([t.school.id, t.uid]), cells: [<>{t.fullName}<small>{t.school.name}</small></>, data.unavailable.includes('Último guardado') ? 'No disponible' : savedTime(t.last),
          data.unavailable.includes('Asistencia') ? 'No disponible' : t.weeks + ' / ' + t.expected + ' · ' + percent(t.attendanceRate), data.unavailable.includes('Horas') ? 'No disponible' : number(t.worked) + ' / ' + number(t.planned) + ' · ' + percent(ratio(t.worked, t.planned)),
          data.unavailable.includes('Evaluaciones') ? 'No disponible' : t.evaluated + ' / ' + t.members + ' · ' + percent(t.coverage), t.groups.length ? t.groups.map(g => <Link key={g.id} to={reportLink('instituciones', filters, { schoolId: t.school.id, campus: t.school.campuses.find(c => c.name === g.campus)?.id ?? g.campus, group: g.id })}>{g.name}</Link>) : 'Sin grupos asignados']
        }))} /> :
        <EmptyState title="No hay docentes en esta selección." description="Amplía los filtros o revisa las asignaciones en Carga de datos." />}</>
  }}</ReportRead></>
}
export function CompareView({ filters }: Props) {
  const { params, update } = useReportQuery()
  const sites = !!filters.campus || params.get('por') === 'sede'
  return <><h2>Comparación de cobertura</h2><Field label="Comparar por"><Select value={sites ? 'sede' : 'institucion'} disabled={!!filters.campus} onChange={e => update({ por: e.target.value })}>
    <option value="institucion">Institución</option><option value="sede">Sede</option></Select></Field>
    <ReportRead query={JSON.stringify([filters,sites])} load={() => getComparison(filters,sites)}>{data => {
      const rows = data.map(({school,campus,students,groups,evaluated,attendance}) => ({
        key: JSON.stringify([school.id,campus?.id]), cells: [<Link key="institucion" to={reportLink('instituciones',filters,{schoolId:school.id,...(campus ? {campus:campus.id} : {})})}>{school.name}{campus && ' · ' + campus.name}</Link>,
          students,groups,evaluated,percent(attendance)]
      }))
      return rows.length ? <Table caption="Comparación de instituciones y sedes" headers={[sites ? 'Institución y sede' : 'Institución', 'Estudiantes activos', 'Grupos', 'Estudiantes evaluados', 'Asistencia']} rows={rows} /> :
        <EmptyState title="Sin instituciones para comparar." description="Amplía la selección geográfica." />
    }}</ReportRead></>
}
