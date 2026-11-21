import { LoadError } from '../../ui/LoadError'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { beginnerList, decliningStudents, readDashboard } from '../../data/dashboard'
import { ReportRead } from '../reports/ReportState'
import { milestones } from '../../data/managementMetrics'
import { useSchools, useProgramConfig } from '../../data/scope'
import { momentLabel, SUBJECTS, subjectLabel } from '../../domain/levels'
import type { Moment, ProgramConfig, School, Subject, UserProfile } from '../../domain/types'
import { colombiaToday, weekOf } from '../../domain/weeks'
import { Badge, Button, Field, PageHeader, Select } from '../../ui/components'
import { Icon } from '../../ui/Icon'
import { savedTime } from '../reports/navigation'
import './manage.css'

function StudentAlerts({ school, subject, moment, from, to, declines }: {
  school: School; subject: Subject; moment: Moment; from: string; to: string; declines?: boolean
}) {
  return <ReportRead query={JSON.stringify([school.id, subject, moment, from, to, declines])} load={() => declines
    ? decliningStudents(school.id, subject, moment, from, to) : beginnerList(school.id, subject, moment)}>{students =>
      <><h4>{school.name} · {subjectLabel(subject)}</h4>{students.length ? <ul>{students.map(s =>
        <li key={s.id}><Link to={'/visualizacion/estudiante?' + new URLSearchParams({ schoolId: school.id, student: s.id, subject })}>{s.fullName}</Link></li>)}</ul>
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
    return <>
      <dl className="coverage-counts"><div><dt>Docentes</dt><dd>{data.teachers}</dd></div>
        <div><dt>Estudiantes activos</dt><dd>{data.students}</dd></div></dl>
      <div className="manage-columns"><section><h2>Alertas de seguimiento</h2>
        {config ? <><Field label="Momento de evaluación"><Select value={moment} onChange={e => setSelected(e.target.value as Moment)}>
          {milestones.map(m => <option key={m} value={m}>{momentLabel(m)}</option>)}</Select></Field>
          <p className="manage-note">Se propone el momento más avanzado registrado desde el inicio del programa.</p>
          {[...new Set(alerts.map(a => a.category))].map(category => {
            const matches = alerts.filter(a => a.category === category)
            return <details key={category} onToggle={e => { const open = e.currentTarget.open; setExpanded(v => ({ ...v, [category]: open })) }}>
              <summary>{category} <strong>{matches.reduce((n, a) => n + a.count, 0)}</strong></summary>
              {expanded[category] && <ul>{matches.map(a => <li key={a.path + (a.subject ?? '')}>{a.subject
                ? <StudentAlerts school={schools.find(s => s.id === a.schoolId)!} subject={a.subject} moment={moment} from={config.implementationStartDate} to={today} />
                : <Link to={a.path}>{a.label}</Link>}</li>)}</ul>}</details>
          })}
          {!alerts.length && <p>Sin alertas en esta selección. Consulta los envíos para revisar el detalle semanal.</p>}
          {moment !== 'linea_base' && <details onToggle={e => { const open = e.currentTarget.open; setExpanded(v => ({ ...v, declines: open })) }}>
            <summary>Consultar descensos de nivel</summary>{expanded.declines && <Declines schools={schools} moment={moment} from={config.implementationStartDate} to={today} />}</details>}
        </> : <p>Configura la fecha de inicio y las pausas para calcular las alertas del programa.</p>}
      </section><section><h2>Actividad reciente</h2>{feed.length ? <ol className="manage-feed">{feed.map(e => <li key={e.key}><strong>{e.kind} · {e.detail}</strong>
        <span>{e.author} · {e.school}</span><time dateTime={e.savedAt}>{savedTime(e.savedAt)}</time></li>)}</ol>
        : <p>Los registros aparecerán aquí cuando se guarden asistencias, evaluaciones u horas.</p>}</section></div>
    </>
  }}</ReportRead>
}
export function ManagerHome({ profile }: { profile: UserProfile }) {
  const { schools, loading, error } = useSchools()
  const calendar = useProgramConfig()
  const [showActivity, setShowActivity] = useState(false)
  const today = colombiaToday(), config = calendar.config, week = config && weekOf(today, config)
  const admin = profile.rol === 'admin'
  const actions = [
    { to: '/visualizacion', label: 'Visualización de datos', note: 'Consulta envíos, niveles y asistencia.', icon: 'chart' as const },
    { to: '/recoleccion', label: 'Recolección de datos', note: admin ? 'Administra las instituciones y los registros del programa.' : '', icon: 'edit' as const },
  ]
  if (admin) actions.reverse()
  return <div className="portal-home manage"><PageHeader title="Inicio del portal" />
    <div className="home-actions">{actions.map((a, i) => <Link key={a.to} className="home-action" data-featured={i === 0} to={a.to}>
      <div className="action-icons"><Icon name={a.icon} size={28} /><Icon name="arrow" /></div><h2>{a.label}</h2>{a.note && <p>{a.note}</p>}
      {!admin && a.to === '/recoleccion' && <Badge>Solo lectura</Badge>}</Link>)}</div>
    <section className="manage-scope"><h2>{profile.rol === 'coordinador' ? 'Cobertura de tu región' : 'Cobertura del programa'}</h2>
      {calendar.error ? <LoadError message={calendar.error} /> : config ? <p><time dateTime={today}>{today}</time> · {week ? 'Semana ' + week + ' de implementación' : today < config.implementationStartDate ? 'Inicio el ' + config.implementationStartDate : 'Semana de receso'}</p>
        : !calendar.loading && <p>Solicita la configuración del calendario al administrador.</p>}
      {error ? <LoadError message={error} /> : loading ? <p role="status">Cargando instituciones y sedes…</p> : !schools.length ?
        <p>Aún no hay instituciones en tu ámbito de consulta. Revisa la asignación con administración.</p> :
        <><dl className="coverage-counts"><div><dt>Instituciones</dt><dd>{schools.length}</dd></div><div><dt>Sedes</dt><dd>{schools.reduce((n, s) => n + s.campuses.length, 0)}</dd></div></dl>
          {(config || showActivity) ? <FollowUp key={JSON.stringify([profile.uid, profile.regions, schools.map(s => s.id)])} profile={profile} config={config} today={today} schools={schools} /> : !calendar.loading && <Button onClick={() => setShowActivity(true)}>Consultar docentes, estudiantes y actividad</Button>}</>}
    </section>
    <nav className="shortcut-list" aria-label="Informes"><Link to="/visualizacion/seguimiento">Seguimiento de envíos</Link>
      <Link to="/visualizacion/docentes">Seguimiento docente</Link>{admin && <Link to="/recoleccion/calidad">Calidad de datos</Link>}</nav>
  </div>
}
