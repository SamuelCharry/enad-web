import { LoadError } from '../../ui/LoadError'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useSchoolAttendance } from '../../data/attendance'
import { useSchoolEvaluations } from '../../data/evaluations'
import { useGroups } from '../../data/groups'
import { useMyHours } from '../../data/hours'
import { useSchools, useProgramConfig } from '../../data/scope'
import { useStudents } from '../../data/students'
import type { Group, Moment, School, Subject, UserProfile } from '../../domain/types'
import { subjectLabel } from '../../domain/levels'
import { colombiaToday, rangeOf, weekOf } from '../../domain/weeks'
import { Button, Card, Dialog, PageHeader, SyncStatus } from '../../ui/components'
import { Icon } from '../../ui/Icon'
import { MomentField } from '../collect/common'
import { collectLink, groupLink } from './navigation'
import { draftDates } from './useAttendanceDrafts'
import './teacher.css'

function EvaluationTasks({ groups, schoolId, subject, moment }: { groups: Group[]; schoolId: string; subject: Subject; moment: Moment }) {
  const events = useSchoolEvaluations(schoolId, subject, moment, groups.flatMap(g => g.studentIds))
  const roster = useStudents(schoolId)
  if (events.error || roster.error) return <LoadError message={events.error || roster.error} />
  if (events.loading || roster.loading) return <p role="status">Consultando evaluaciones de {subjectLabel(subject)}…</p>
  const done = new Set(events.data.filter(e => e.moment === moment).map(e => e.studentId))
  const active = new Set(roster.students.filter(s => s.active && !s.retired).map(s => s.id))
  for (const s of roster.students) if (s.levels[subject]?.moment === moment) done.add(s.id)
  return <>{groups.map(g => {
    const missing = g.studentIds.filter(id => active.has(id) && !done.has(id)).length
    return <p key={g.id}>{missing ? <Link to={groupLink('evaluacion', g, { moment })}>{g.name} · Evaluar a {missing} {missing === 1 ? 'estudiante' : 'estudiantes'}</Link> : g.name + ' · Sin evaluaciones pendientes'}</p>
  })}</>
}

function SchoolWork({ school, today, groups, from, hours }: { school: School; today: string; groups: Group[]; from?: string; hours: ReturnType<typeof useMyHours> }) {
  const attendance = useSchoolAttendance(school.id, today, groups.map(g => g.id))
  const [moment, setMoment] = useState<Moment | ''>('')
  return <section className="teacher-school"><h3>{school.name}</h3>
    {attendance.error && <LoadError message={attendance.error} />}
    <div className="teacher-groups">{groups.map(g => {
      const marks = attendance.data.filter(m => m.groupId === g.id && g.studentIds.includes(m.studentId))
      const complete = g.studentIds.length > 0 && new Set(marks.map(m => m.studentId)).size === g.studentIds.length
      return <Card key={g.id}><Link className="teacher-group-link" to={groupLink('grupos', g)}><strong>{g.name}</strong><Icon name="arrow" /></Link>
        <p>{subjectLabel(g.subject)} · {school.campuses.find(c => c.id === g.campus)?.name || g.campus || 'Sin sede asignada'}</p>
        <p>{g.studentIds.length} estudiantes</p>
        {!g.studentIds.length ? <Link to={groupLink('grupos', g)}>Añadir integrantes</Link> : attendance.loading ? <p>Consultando asistencia…</p> : !attendance.error &&
          <Link to={groupLink('asistencia', g)}>{complete ? 'Asistencia completa' : 'Tomar asistencia de hoy'}</Link>}
        {draftDates(g.teacherId,school.id,g.id).map(date => <Link key={date} to={groupLink('asistencia',g,{date})}>Continuar asistencia del {date}</Link>)}
        {complete && <SyncStatus pending={marks.some(m => m.syncState === 'pending')} />}
      </Card>
    })}</div>
    {!groups.length && <p>Aún no tienes grupos en esta institución. <Link to={collectLink('grupos', { school: school.id })}>Crear un grupo</Link></p>}
    {from && (hours.error ? <LoadError message={hours.error} /> : hours.loading ? <p>Consultando horas…</p> :
      <Link to={collectLink('horas', { school: school.id })}>{hours.hours.some(h => h.schoolId === school.id) ? 'Ver las horas de esta semana' : 'Pendiente · Registrar horas de esta semana'}</Link>)}
    {groups.length > 0 && <details><summary>Evaluaciones pendientes</summary><MomentField value={moment} onChange={setMoment} />
      {moment && (['lectura', 'matematicas'] as const).map(subject => {
        const selected = groups.filter(g => g.subject === subject)
        return selected.length > 0 && <EvaluationTasks key={subject} groups={selected} schoolId={school.id} {...{ subject, moment }} />
      })}</details>}
  </section>
}
function MyGroups({ today, from, to }: { today: string; from?: string; to?: string }) {
  const schools = useSchools()
  const hours = useMyHours(from ?? today, to ?? today)
  const groups = useGroups(undefined, { mine: true })
  if (schools.error || groups.error) return <LoadError message={schools.error || groups.error} />
  if (schools.loading || groups.loading) return <p role="status">Cargando tus grupos…</p>
  if (!schools.schools.length) return <p>Solicita a coordinación que revise las instituciones asignadas a tu cuenta.</p>
  return <>{schools.schools.map(s => <SchoolWork key={s.id} school={s} groups={groups.groups.filter(g => g.schoolId === s.id)} {...{ today, from, hours }} />)}</>
}

function ScanSchool({ onClose }: { onClose: () => void }) {
  const { schools, error, loading } = useSchools()
  const navigate = useNavigate()
  return <Dialog title="¿De qué institución es la lista?" onClose={onClose}>
    {error ? <LoadError message={error} /> : loading ? <p role="status">Cargando instituciones…</p> : !schools.length ? <p>Solicita a coordinación que asigne tu institución.</p> :
      schools.map(s => <Button key={s.id} onClick={() => navigate(collectLink('estudiantes',{ school: s.id, scan: '1' }))}>{s.name}</Button>)}
  </Dialog>
}

export function TeacherHome({ profile }: { profile: UserProfile }) {
  const [selectSchool, setSelectSchool] = useState(false)
  const { config, loading, error } = useProgramConfig()
  const today = colombiaToday()
  const week = config && weekOf(today, config)
  const range = config && week ? rangeOf(week, config) : {}
  return <div className="teacher-work"><PageHeader title="Hoy" />
    <div className="teacher-dateline"><time dateTime={today}>{today}</time>
      {error ? <span role="alert">{error}</span> : <span>{loading ? 'Cargando calendario…' : !config ? 'Consulta con coordinación la fecha de inicio.' :
        week ? 'Semana ' + week + ' de implementación' : today < config.implementationStartDate ? 'La implementación comienza el ' + config.implementationStartDate : 'Semana de receso'}</span>}</div>
    <div className="teacher-dashboard"><section><h2>Mis grupos</h2>
      {profile.schoolIds.length ? <MyGroups {...{ today, ...range }} /> : <p>Solicita a coordinación que asigne tu institución para comenzar.</p>}</section>
      <aside><h2>Registro de clase</h2><nav className="shortcut-list" aria-label="Acciones rápidas">
        {[['Asistencia','asistencia'], ['Evaluación formativa','evaluacion'], ['Horas','horas']].map(([label, path]) =>
          <Link key={path} to={'/recoleccion/' + path}>{label}<Icon name="arrow" size={18}/></Link>)}
          {profile.schoolIds.length > 1 ? <Button variant="ghost" onClick={() => setSelectSchool(true)}>Escanear lista<Icon name="arrow" size={18}/></Button> :
            <Link to={collectLink('estudiantes',{ scan: '1' })}>Escanear lista<Icon name="arrow" size={18}/></Link>}</nav>
          {selectSchool && <ScanSchool onClose={() => setSelectSchool(false)} />}
        <details><summary>Ayuda para registrar una clase</summary><nav className="shortcut-list" aria-label="Guías paso a paso">
          {[['asistencia','Guía de asistencia'], ['evaluacion','Guía de evaluación'], ['horas','Guía de horas']].map(([section,label]) =>
            <Link key={section} to={collectLink(section,{ guide: '1' })}>{label}<Icon name="arrow" size={18}/></Link>)}</nav></details>
      </aside></div>
    <nav className="teacher-entries" aria-label="Portal docente"><Link to="/recoleccion">Recolección de datos <Icon name="edit" /></Link><Link to="/visualizacion">Visualización de datos <Icon name="chart" /></Link></nav>
  </div>
}
