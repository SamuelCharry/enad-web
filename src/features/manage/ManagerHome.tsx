import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { activityFeed, enrolled, useManagementActivity } from '../../data/activity'
import { dashboardAlerts, milestones, observedMoment } from '../../data/managementMetrics'
import { useSchools, useProgramConfig } from '../../data/scope'
import { momentLabel } from '../../domain/levels'
import type { Moment, ProgramConfig, UserProfile } from '../../domain/types'
import { colombiaToday, weekOf } from '../../domain/weeks'
import { Badge, Button, Field, PageHeader, Select } from '../../ui/components'
import { Icon } from '../../ui/Icon'
import { savedTime } from '../reports/navigation'
import './manage.css'

function FollowUp({ config, today }: { config: ProgramConfig | null; today: string }) {
  const { data, loading, error } = useManagementActivity()
  const [selected, setSelected] = useState<Moment>()
  const moment = selected ?? (config ? observedMoment(data, config.implementationStartDate, today) : milestones[0])
  const alerts = useMemo(() => config ? dashboardAlerts(data, config, today, moment) : [], [data, config, today, moment])
  const feed = useMemo(() => activityFeed(data), [data])
  if (error) return <p role="alert">{error}</p>
  if (loading) return <p role="status">Cargando docentes, estudiantes y registros…</p>
  const categories = [...new Set(alerts.map(a => a.category))]
  return <>
    <dl className="coverage-counts"><div><dt>Docentes</dt><dd>{new Set(data.flatMap(s => s.teachers.map(t => t.uid))).size}</dd></div>
      <div><dt>Estudiantes activos</dt><dd>{data.reduce((n, s) => n + s.students.filter(enrolled).length, 0)}</dd></div></dl>
    <div className="manage-columns"><section><h2>Alertas de seguimiento</h2>
      {config ? <><Field label="Momento de evaluación"><Select value={moment} onChange={e => setSelected(e.target.value as Moment)}>
        {milestones.map(m => <option key={m} value={m}>{momentLabel(m)}</option>)}</Select></Field>
      <p className="manage-note">Se propone el momento más avanzado registrado desde el inicio del programa.</p>
      {categories.length ? categories.map(category => <details key={category}><summary>{category} <strong>{alerts.filter(a => a.category === category).length}</strong></summary>
        <ul>{alerts.filter(a => a.category === category).map(a => <li key={a.path + a.label}><Link to={a.path}>{a.label}</Link></li>)}</ul></details>)
        : <p>Sin alertas en esta selección. Consulta los envíos para revisar el detalle semanal.</p>}</> : <p>Configura la fecha de inicio y las pausas para calcular las alertas del programa.</p>}
    </section><section><h2>Actividad reciente</h2>
        {feed.length ? <ol className="manage-feed">{feed.map(e => <li key={e.key}><strong>{e.kind} · {e.detail}</strong>
          <span>{e.author} · {e.school}</span><time dateTime={e.savedAt}>{savedTime(e.savedAt)}</time></li>)}</ol>
          : <p>Los registros aparecerán aquí cuando se guarden asistencias, evaluaciones u horas.</p>}
      </section></div>
  </>
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
      {calendar.error ? <p role="alert">{calendar.error}</p> : config ? <p><time dateTime={today}>{today}</time> · {week ? 'Semana ' + week + ' de implementación' : today < config.implementationStartDate ? 'Inicio el ' + config.implementationStartDate : 'Semana de receso'}</p>
        : !calendar.loading && <p>Solicita la configuración del calendario al administrador.</p>}
      {error ? <p role="alert">{error}</p> : loading ? <p role="status">Cargando instituciones y sedes…</p> : !schools.length ?
        <p>Aún no hay instituciones en tu ámbito de consulta. Revisa la asignación con administración.</p> :
        <><dl className="coverage-counts"><div><dt>Instituciones</dt><dd>{schools.length}</dd></div><div><dt>Sedes</dt><dd>{schools.reduce((n, s) => n + s.campuses.length, 0)}</dd></div></dl>
          {(config || showActivity) ? <FollowUp key={JSON.stringify([profile.uid, profile.regions, schools.map(s => s.id)])} config={config} today={today} /> : !calendar.loading && <Button onClick={() => setShowActivity(true)}>Consultar docentes, estudiantes y actividad</Button>}</>}
    </section>
    <nav className="shortcut-list" aria-label="Informes"><Link to="/visualizacion/seguimiento">Seguimiento de envíos</Link>
      <Link to="/visualizacion/docentes">Seguimiento docente</Link>{admin && <Link to="/recoleccion/calidad">Calidad de datos</Link>}</nav>
  </div>
}
