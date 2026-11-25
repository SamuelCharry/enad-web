import { LoadError } from '../../ui/LoadError'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { beginnerList, decliningStudents, readDashboard } from '../../data/dashboard'
import { ReportRead } from '../reports/ReportState'
import { milestones } from '../../data/managementMetrics'
import { useSchools, useProgramConfig } from '../../data/scope'
import { momentLabel, SUBJECTS, subjectLabel } from '../../domain/levels'
import type { Moment, ProgramConfig, School, Subject, UserProfile } from '../../domain/types'
import { classDate, colombiaToday, weekOf } from '../../domain/weeks'
import { Button, Field, Select } from '../../ui/components'
import { getMovement } from '../../data/reports'
import { percent } from '../reports/model'
import { savedTime } from '../reports/navigation'
import { Territory } from './Territory'
import './manage.css'

function StudentAlerts({ school, subject, moment, from, to, declines }: {
  school: School; subject: Subject; moment: Moment; from: string; to: string; declines?: boolean
}) {
  return <ReportRead query={JSON.stringify([school.id, subject, moment, from, to, declines])} load={() => declines
    ? decliningStudents(school.id, subject, moment, from, to) : beginnerList(school.id, subject, moment)}>{students =>
      <><h4>{school.name} · {subjectLabel(subject)}</h4>{students.length ? <ul>{students.map(s =>
        <li key={s.id}><Link to={'/portal/reportes/estudiante?' + new URLSearchParams({ schoolId: school.id, student: s.id, subject })}>{s.fullName}</Link></li>)}</ul>
        : <p>Sin estudiantes en esta selección. Revisa otro momento.</p>}</>}</ReportRead>
}
function Declines({ schools, moment, from, to }: { schools: School[]; moment: Moment; from: string; to: string }) {
  const [schoolId, setSchool] = useState('')
  const [subject, setSubject] = useState<Subject>('lectura')
  const school = schools.find(s => s.id === schoolId)
  return <><Field label="Institución para revisar"><Select value={schoolId} onChange={e => setSchool(e.target.value)}>
    <option value="">Selecciona una institución</option>{schools.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</Select></Field>
    {school && <><Field label="Área por revisar"><Select value={subject} onChange={e => setSubject(e.target.value as Subject)}>
      {SUBJECTS.map(s => <option key={s} value={s}>{subjectLabel(s)}</option>)}</Select></Field>
      <StudentAlerts {...{ school, subject, moment, from, to }} declines /></>}</>
}
function FollowUp({ profile, config, today, schools }: { profile: UserProfile; config: ProgramConfig | null; today: string; schools: School[] }) {
  const [selected, setSelected] = useState<Moment>()
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  return <ReportRead query={JSON.stringify([schools, config, today, selected])} load={() => readDashboard(profile, schools, config, today, selected)}>{data => {
    const { alerts, moment, feed } = data
    const missing = (key:string) => data.unavailable.includes(key)
    return <>
      {data.unavailable.length > 0 && <p role="alert">No disponible · {data.unavailable.join(', ')}</p>}
      <section className="foundation-totals" aria-label="Comunidad del programa">
        <dl>{[['Colegios',schools.length],['Sedes',schools.reduce((n,s) => n+s.campuses.length,0)],['Docentes',missing('Docentes') ? '—' : data.teachers],['Estudiantes activos',missing('Estudiantes activos') ? '—' : data.students]].map(([name,count]) =>
          <div key={name}><dt>{name}</dt><dd>{count}</dd></div>)}</dl>
      </section>
      <section className="foundation-week"><h2>Esta semana</h2>
        <div className="week-insights"><div className="week-attendance">{['Asistencia hasta hoy','Mismos días de la semana pasada'].map((label,i) => {
          const value = data.insights.attendance[i]
          return <div key={label}><span>{label}</span><strong>{missing('Asistencia') ? 'No disponible' : percent(value)}</strong>
            {!missing('Asistencia') && value != null && <meter min="0" max="100" value={value} aria-label={label}/>}</div>
        })}</div>
        <dl><div><dt>Horas realizadas / planeadas</dt><dd>{missing('Horas') ? 'No disponible' : data.insights.planned || data.insights.worked ? data.insights.worked.toLocaleString('es-CO')+' / '+data.insights.planned.toLocaleString('es-CO') : 'Sin registros'}</dd></div>
        <div><dt>Docentes que enviaron asistencia</dt><dd>{missing('Envíos') || missing('Docentes') ? 'No disponible' : percent(config && weekOf(today,config) && data.teachers ? 100*data.insights.reporters/data.teachers : null)}</dd></div></dl></div>
      </section>
      {config && moment !== 'linea_base' && <details onToggle={e => {const open=e.currentTarget.open;setExpanded(v => ({...v,movement:open}))}}>
        <summary>Cambios de nivel · {momentLabel(moment)}</summary>{expanded.movement && SUBJECTS.map(subject => {
          const prior = milestones[milestones.indexOf(moment)-1]
          return <ReportRead key={subject} query={subject+moment} load={() => getMovement({from:config.implementationStartDate,to:today},subject,prior,moment)}>{([m]) =>
            <p>{subjectLabel(subject)} · {m?.total ? m.up+' subieron, '+m.stable+' conservaron su nivel y '+m.down+' bajaron desde '+momentLabel(prior)+'.' : 'Sin estudiantes evaluados en ambos momentos.'}</p>}</ReportRead>
        })}</details>}
      <div className="manage-columns"><section><h2>Alertas de seguimiento</h2>
        {config ? <><Field label="Momento de evaluación"><Select value={moment} onChange={e => setSelected(e.target.value as Moment)}>
          {milestones.map(m => <option key={m} value={m}>{momentLabel(m)}</option>)}</Select></Field>
          {[...new Set(alerts.map(a => a.category))].map(category => {
            const matches = alerts.filter(a => a.category === category)
            return <details key={category} onToggle={e => { const open = e.currentTarget.open; setExpanded(v => ({ ...v, [category]: open })) }}>
              <summary>{category} <strong>{matches.reduce((n, a) => n + a.count, 0)}</strong></summary>
              {expanded[category] && <ul>{matches.map(a => <li key={a.schoolId + a.path + (a.subject ?? '')}>{a.subject
                ? <StudentAlerts school={schools.find(s => s.id === a.schoolId)!} subject={a.subject} moment={moment} from={config.implementationStartDate} to={today} />
                : <Link to={a.path}>{a.label}</Link>}</li>)}</ul>}</details>
          })}
          {!alerts.length && !data.unavailable.length && <p>Sin alertas en esta selección. Consulta los envíos para revisar el detalle semanal.</p>}
          {moment !== 'linea_base' && <details onToggle={e => { const open = e.currentTarget.open; setExpanded(v => ({ ...v, declines: open })) }}>
            <summary>Consultar descensos de nivel</summary>{expanded.declines && <Declines schools={schools} moment={moment} from={config.implementationStartDate} to={today} />}</details>}
        </> : <p>Configura la fecha de inicio y las pausas para calcular las alertas del programa.</p>}
      </section><section><h2>Actividad reciente</h2>{missing('Actividad reciente') && <p>No se pudo cargar toda la actividad.</p>}{feed.length ? <ol className="manage-feed">{feed.map(e => <li key={e.key}><strong>{e.kind} · {e.detail}</strong>
        <span>{e.author} · {e.school}</span><time dateTime={e.savedAt}>{savedTime(e.savedAt)}</time></li>)}</ol>
        : !missing('Actividad reciente') && <p>Los registros aparecerán aquí cuando se guarden asistencias, evaluaciones u horas.</p>}</section></div>
    </>
  }}</ReportRead>
}
export function ManagerHome({ profile }: { profile: UserProfile }) {
  const { schools, loading, error } = useSchools()
  const calendar = useProgramConfig()
  const [showActivity, setShowActivity] = useState(false)
  const today = colombiaToday(), config = calendar.config, week = config && weekOf(today, config)
  return <div className="manage"><section className="manage-scope">
      {calendar.error ? <LoadError message={calendar.error} /> : config ? <p><time dateTime={today}>{classDate(today)}</time> · {week ? 'Semana ' + week + ' de implementación' : today < config.implementationStartDate ? 'Inicio el ' + config.implementationStartDate : 'Semana de receso'}</p>
        : !calendar.loading && <p>Aún falta el calendario del programa.</p>}
      {error ? <LoadError message={error} /> : loading ? <p role="status">Cargando instituciones y sedes…</p> : !schools.length ?
        <p>Aún no hay instituciones en tu ámbito de consulta. Consulta la asignación con la fundación.</p> :
        <>
          <Territory schools={schools} />
          {(config || showActivity) ? <FollowUp key={JSON.stringify([profile.uid, profile.schoolIds, schools.map(s => s.id)])} profile={profile} config={config} today={today} schools={schools} /> : !calendar.loading && <Button onClick={() => setShowActivity(true)}>Consultar docentes, estudiantes y actividad</Button>}</>}
    </section>
    <nav className="shortcut-list" aria-label="Informes"><Link to="/portal/reportes/seguimiento">Seguimiento de envíos</Link>
      <Link to="/portal/reportes/docentes">Seguimiento docente</Link>{profile.rol === 'fundacion' && <Link to="/portal/calidad">Calidad de datos</Link>}</nav>
  </div>
}
