import { ReportTable as Table } from './TableExport'
import { useReportQuery } from './navigation'
import { MovementTable } from './ManagementViews'
import type { ReportFilters, Subject } from '../../domain/types'
import { getAttendanceReport, getHoursReport, getLevels, getSubmissions, getSummary } from '../../data/reports'
import { useProgramConfig } from '../../data/scope'
import { levelColor } from '../../domain/levelPalette'
import { LEVELS, levelLabel, MOMENTS, momentLabel, SUBJECTS, subjectLabel } from '../../domain/levels'
import { colombiaToday, weeksElapsed } from '../../domain/weeks'
import { Chart } from './Chart'
import { Button, Card, EmptyState, Field, Select } from '../../ui/components'
import { hoursRows, number, percent } from './model'
import type { AttendanceReport, WeeklyHours } from './model'
import { LiveState, ReportRead } from './ReportState'

type Props = { filters: ReportFilters }

export function SummaryView({ filters }: Props) {
  return <><h2>Resumen</h2><ReportRead query={JSON.stringify(filters)} load={() => getSummary(filters)}>{r => {
    const metrics = [
      ['Estudiantes', number(r.students)], ['Docentes', number(r.teachers)], ['Instituciones', number(r.schools)], ['Sedes', number(r.campuses)],
      ['Grupos de lectura', number(r.groupsBySubject.lectura)], ['Grupos de matemáticas', number(r.groupsBySubject.matematicas)],
      ['Horas ejecutadas / planeadas', number(r.hoursWorked) + ' / ' + number(r.hoursPlanned)], ['Tasa de asistencia', percent(r.attendanceRate)],
    ]
    return <>{filters.campus && <p>Las horas se registran por institución. La cobertura docente de una sede corresponde a sus grupos asignados.</p>}<dl className="rep-metrics">{metrics.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
      <Card><h3>Estudiantes que asistieron por semana de implementación</h3>
        {r.studentsOverTime.length ? <Chart type="line" axis="Semana de implementación" label="Estudiantes" data={[...r.studentsOverTime].sort((a,b) => a.week - b.week).map(p => ({ label: 'Semana ' + number(p.week), value: p.count }))} />
          : <EmptyState title="Sin asistencia semanal." description="Amplía el período o consulta los envíos pendientes." />}
      </Card></>
  }}</ReportRead></>
}

export function SubmissionsView({ filters }: Props) {
  const { config, loading, error } = useProgramConfig()
  const latest = config ? weeksElapsed(config, colombiaToday()) : 0
  const {params,update} = useReportQuery()
  const input = Number(params.get('week'))
  const selected = Number.isSafeInteger(input) && input > 0 ? input : undefined
  const pending = params.get('pendientes') === '1'
  const teacher = params.get('teacher')
  const week = Math.min(latest, selected ?? Math.max(latest - 1, 1))
  return <><h2>Seguimiento de envíos</h2><LiveState loading={loading} error={error}>
    {latest === 0 ? <EmptyState title="Todavía no hay semanas de implementación." description="Revisa la fecha de inicio en la configuración del programa." /> : <>
      <Field label="Semana de implementación"><Select value={week} onChange={e => update({week:e.target.value})}>
        {Array.from({ length: latest }, (_, i) => latest - i).map(w => <option key={w} value={w}>Semana {number(w)}</option>)}
      </Select></Field>
      <ReportRead query={JSON.stringify([filters, week])} load={() => getSubmissions(filters, week)}>{r => {
        const rows = r.teachers.filter(t => (!teacher || t.uid===teacher) && (!pending || !t.attendanceSent || !t.hoursSent))
        return <Card><h3>Envíos del {r.range.from} al {r.range.to}</h3>
          <p>{number(r.attendanceSent)} de {number(r.total)} docentes enviaron asistencia · {number(r.hoursSent)} de {number(r.total)} enviaron horas</p>
          {teacher && <Button variant="ghost" onClick={() => update({teacher:undefined})}>Ver todos los docentes</Button>}
          <label className="rep-check"><input type="checkbox" checked={pending} onChange={e => update({pendientes:e.target.checked ? '1':undefined})} />Solo pendientes</label>
          {rows.length ? <Table caption="Envíos por docente e institución" headers={['Docente', 'Institución', 'Asistencia', 'Horas']}
            rows={rows.map(t => ({ key: JSON.stringify([t.schoolId, t.uid]), cells: [t.fullName, t.schoolName || t.schoolId, t.attendanceSent ? 'Enviado' : 'Pendiente', t.hoursSent ? 'Enviado' : 'Pendiente'] }))} />
            : <EmptyState title={pending ? 'No hay envíos pendientes.' : 'No hay docentes en esta selección.'} />}
        </Card>
      }}</ReportRead>
    </>}
  </LiveState></>
}

export function WeeklyTable({ weeks }: { weeks: WeeklyHours[] }) {
  return weeks.length ? <Table caption="Horas por semana de implementación" headers={['Semana', 'Planeadas', 'Ejecutadas', 'Acumuladas', 'Cumplimiento']}
    rows={hoursRows(weeks).map(w => ({ key: String(w.week), cells: [number(w.week), number(w.planned), number(w.worked), number(w.cumulative), percent(w.compliance)] }))} />
    : <EmptyState title="Sin semanas registradas." description="Revisa el período y los envíos de horas." />
}

function AttendanceTable({ report }: { report: AttendanceReport }) {
  const {params,update} = useReportQuery()
  const by = params.get('agrupar') || 'school'
  const rows = by === 'school' ? report.bySchool.map(r => ({ key: r.schoolId, cells: [r.name, percent(r.sessions ? r.rate : null), number(r.sessions)] }))
    : by === 'group' ? report.byGroup.map(r => ({ key: r.groupId, cells: [r.name, r.teacherName, percent(r.sessions ? r.rate : null), number(r.sessions)] }))
    : report.byTeacher.map(r => ({ key: r.uid, cells: [r.fullName, percent(r.sessions ? r.rate : null), number(r.sessions)] }))
  return <Card><h3>Tasa de asistencia</h3><Field label="Agrupar por"><Select value={by} onChange={e => update({agrupar:e.target.value})}>
    <option value="school">Institución</option><option value="group">Grupo</option><option value="teacher">Docente</option>
  </Select></Field>
    {rows.length ? <Table caption="Tasas de asistencia" headers={[...(by === 'group' ? ['Grupo', 'Docente'] : [by === 'school' ? 'Institución' : 'Docente']), 'Asistencia', 'Sesiones']} rows={rows} />
      : <EmptyState title="No hay registros de asistencia." description="Revisa el período o consulta Seguimiento de envíos." />}
  </Card>
}
export function HoursView({ filters }: Props) {
  return <><h2>Horas y asistencia</h2><ReportRead query={JSON.stringify(filters)} load={() => Promise.all([getHoursReport(filters), getAttendanceReport(filters)])}>
    {([hours, attendance]) => <>{hours.bySchool.length > 0 && <Card><h3>Horas por institución</h3>
      {filters.campus && <p>La planeación y la ejecución de horas corresponden a la institución completa.</p>}
      <Table caption="Cumplimiento de horas por institución" headers={['Institución','Planeadas','Ejecutadas','Cumplimiento']}
        rows={hours.bySchool.map(s => ({key:s.schoolId,cells:[s.name,s.planned,s.worked,percent(s.planned > 0 ? 100*s.worked/s.planned : null)]}))}/>
      </Card>}<Card><h3>Horas semanales por docente</h3>{filters.campus && <p>Las horas se registran por institución.</p>}
      {!hours.byTeacher.length && <EmptyState title="No hay docentes en esta selección." description="Amplía los filtros o revisa las asignaciones." />}
      {hours.byTeacher.map(t => <details key={t.uid}><summary>{t.fullName} · {number(t.cumulative.worked)} de {number(t.cumulative.planned)} h</summary>
        <WeeklyTable weeks={t.weekly} /></details>)}</Card><AttendanceTable report={attendance} /></>}
  </ReportRead></>
}

export function LevelsView({ filters }: Props) {
  const {params,update} = useReportQuery()
  const subject:Subject = params.get('subject') === 'matematicas' ? 'matematicas':'lectura'
  return <><h2>Niveles de aprendizaje</h2><Field label="Área"><Select value={subject} onChange={e => update({subject:e.target.value})}>
    {SUBJECTS.map(s => <option key={s} value={s}>{subjectLabel(s)}</option>)}</Select></Field>
    <ReportRead query={JSON.stringify([filters, subject])} load={() => getLevels(filters, subject, MOMENTS)}>{r => {
      const ages = Object.keys(r.age).map(Number).filter(n => n >= 5 && n <= 18 && r.age[n] > 0)
      const ageBins = ages.length ? Array.from({ length: Math.max(...ages) - Math.min(...ages) + 1 }, (_, i) => i + Math.min(...ages)) : []
      return <><Card><h3>Distribución de niveles por momento</h3>
        {MOMENTS.map(m => {
          const data = LEVELS[subject].map((l, i) => ({ label: levelLabel(subject, l), value: r.overall.distribution[m]?.[l] ?? 0, color: levelColor(i).bg })).filter(p => p.value > 0)
          return <div key={m}><h4>{momentLabel(m)}</h4>{data.length ? <Chart type="levels" axis="Nivel" label={momentLabel(m)} data={data} /> : <EmptyState title="Sin evaluaciones." description="Revisa el área y el período." />}</div>
        })}</Card><Card><h3>Rezago por institución</h3><p>Porcentaje de estudiantes evaluados en los tres primeros niveles de {subjectLabel(subject).toLocaleLowerCase('es-CO')}.</p>
        {r.bySchool.length ? <Table caption="Rezago por institución y momento" headers={['Institución', 'Línea base', 'Línea media 1']}
          rows={r.bySchool.map(s => ({ key: s.schoolId, cells: [s.name, ...(['linea_base', 'linea_media_1'] as const).map((m, i) => {
            const measured = Object.values(s.distribution[m] ?? {}).some(n => n > 0)
            const value = measured ? s.rezago[m] : null
            return <div className="rep-rate" key={m}>{percent(value)}{value != null && <span aria-hidden="true"><i style={{ width: value + '%', background: i ? '#FFCE00' : '#E52228' }} /></span>}</div>
          })] }))} /> : <EmptyState title="No hay instituciones en esta selección." description="Amplía los filtros geográficos." />}</Card>
        <div className="rep-pair"><Card><h3>Distribución por género</h3>
          {(r.gender.F || r.gender.M) ? <Chart type="bars" axis="Género" label="Estudiantes por género" data={[{ label: 'Femenino', value: r.gender.F ?? 0 }, { label: 'Masculino', value: r.gender.M ?? 0 }]} /> : <EmptyState title="Sin datos de género." description="Revisa las fichas de los estudiantes evaluados." />}</Card>
          <Card><h3>Distribución por edad</h3>{ageBins.length ? <Chart type="bars" axis="Edad" label="Estudiantes por edad" data={ageBins.map(age => ({ label: number(age) + ' años', value: r.age[age] ?? 0 }))} /> : <EmptyState title="Sin edades registradas." description="Revisa las fichas de los estudiantes evaluados." />}</Card></div>
      </>
    }}</ReportRead><MovementTable filters={filters} subject={subject}/></>
}
