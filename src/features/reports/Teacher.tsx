import { useState } from 'react'
import type { FormEvent } from 'react'
import type { UserProfile } from '../../domain/types'
import { useGroups } from '../../data/groups'
import { useMyHours } from '../../data/hours'
import { updateMyName } from '../../data/profile'
import { getTeacherMetrics } from '../../data/reports'
import { useProgramConfig, useSchools } from '../../data/scope'
import { subjectLabel } from '../../domain/levels'
import { colombiaToday } from '../../domain/weeks'
import { LineChart } from '../../ui/charts'
import { Button, Card, EmptyState, Field, PageHeader, Table, TextInput } from '../../ui/components'
import { number, percent, ratio, shiftDay } from './model'
import { LiveState, ReportRead } from './ReportState'
import { Roster } from './Roster'

function NameEditor({ profile }: { profile: UserProfile }) {
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  async function save(event: FormEvent) {
    event.preventDefault()
    if (busy) return
    if (!name.trim()) { setMessage('Escribe tu nombre.'); return }
    setBusy(true)
    try {
      const result = await updateMyName(name.trim())
      setEditing(false)
      setMessage(result.syncState === 'pending' ? 'Nombre guardado. Pendiente de envío.' : 'Nombre guardado.')
    }
    catch { setMessage('No pudimos guardar el nombre. Intenta de nuevo.') }
    finally { setBusy(false) }
  }
  return <><div className="rep-between"><h2>{profile.fullName}</h2>
    {!editing && <Button onClick={() => { setEditing(true); setName(profile.fullName); setMessage('') }}>Editar nombre</Button>}
  </div>{editing && <form onSubmit={save}><Field label="Nombre completo"><TextInput value={name} required disabled={busy} onChange={e => setName(e.target.value)} /></Field>
    <div className="rep-actions"><Button type="submit" variant="primary" loading={busy}>Guardar nombre</Button>
      <Button disabled={busy} onClick={() => { setEditing(false); setMessage('') }}>Cancelar</Button></div>
  </form>}{message && <p role="status">{message}</p>}</>
}

function TeacherHours({ uid, schoolNames, schoolIds }: { uid: string; schoolNames: Map<string, string>; schoolIds: string[] }) {
  const to = colombiaToday()
  const from = shiftDay(to, -29)
  const { hours, loading, error } = useMyHours(from, to)
  const rows = hours.filter(h => h.teacherId === uid && schoolIds.includes(h.schoolId) && h.date >= from && h.date <= to).sort((a,b) => b.date.localeCompare(a.date))
  const days = new Map<string, { planned: number; worked: number }>()
  let planned = 0, worked = 0
  for (const h of rows) {
    planned += h.plannedHours
    worked += h.workedHours
    const day = days.get(h.date) ?? { planned: 0, worked: 0 }
    day.planned += h.plannedHours
    day.worked += h.workedHours
    days.set(h.date, day)
  }
  const trend = [...days].sort(([a], [b]) => a.localeCompare(b)).flatMap(([date, day]) =>
    day.planned > 0 ? [{ label: date, value: 100 * day.worked / day.planned }] : [])
  return <Card><h2>Cumplimiento de horas · últimos 30 días</h2><p>Del {from} al {to}</p>
    <LiveState loading={loading} error={error}>{rows.length ? <>
      <p><strong>{planned ? percent(ratio(worked, planned)) : 'Sin horas planeadas'}</strong> · {number(worked)} de {number(planned)} h</p>
      {trend.length > 0 && <><h3>Cumplimiento diario (%)</h3><LineChart label="Horas ejecutadas (% de las planeadas)" data={trend} /></>}
      <Table caption="Reportes de horas de los últimos 30 días" headers={['Fecha', 'Institución', 'Planeadas', 'Ejecutadas', 'Motivo']} rows={rows.map(h => ({
        key: JSON.stringify([h.schoolId, h.date]), cells: [h.date, schoolNames.get(h.schoolId) ?? h.schoolId, number(h.plannedHours), number(h.workedHours), h.reason ?? '—'],
      }))} />
    </> : <EmptyState title="Sin reportes de horas en este periodo." />}</LiveState>
  </Card>
}

export function Teacher({ profile }: { profile: UserProfile }) {
  const schools = useSchools()
  const program = useProgramConfig()
  const groups = useGroups(undefined, { mine: true })
  const [groupId, setGroup] = useState('')
  const mine = groups.groups.filter(g => g.teacherId === profile.uid && profile.schoolIds.includes(g.schoolId))
  const group = mine.find(g => g.id === groupId)
  const schoolNames = new Map(schools.schools.map(s => [s.id, s.name]))
  return <><PageHeader title="Mis datos" />
    <Card><NameEditor profile={profile} /><dl className="rep-facts">
      <div><dt>Correo</dt><dd>{profile.email}</dd></div>
      <div><dt>Proyecto</dt><dd>{program.config?.projectName || profile.projectId || 'Sin registrar'}</dd></div>
      <div><dt>Jornada</dt><dd>{profile.jornada}</dd></div>
    </dl><LiveState loading={schools.loading} error={schools.error}>
      {schools.schools.filter(s => profile.schoolIds.includes(s.id)).map(s => <p key={s.id}><strong>{s.name}</strong>{s.campuses.filter(c => profile.campusIds[s.id]?.includes(c.id)).map(c => ' · ' + c.name).join('')}</p>)}
    </LiveState></Card>
    <Card><h2>Mis grupos</h2><LiveState loading={groups.loading} error={groups.error}>
      {group ? <><Button onClick={() => setGroup('')}>Volver a mis grupos</Button><Roster key={group.id} group={group} filters={{}} profiles /></> :
        mine.length ? <Table caption="Mis grupos asignados" headers={['Grupo', 'Área', 'Institución', 'Estudiantes']} rows={mine.map(g => ({
          key: g.id, cells: [<Button key="open" variant="ghost" onClick={() => setGroup(g.id)}>{g.name}</Button>, subjectLabel(g.subject), schoolNames.get(g.schoolId) ?? g.schoolId, number(g.studentIds.length)],
        }))} /> : <EmptyState title="Todavía no tienes grupos asignados." />}
    </LiveState></Card>
    <Card><h2>Mis indicadores</h2><ReportRead query={JSON.stringify([profile.uid, mine.map(g => [g.id, g.studentIds])])} load={() => getTeacherMetrics(profile.uid)}>
      {metrics => <><h3>Tasa de asistencia de mis grupos</h3>
        {metrics.recorded > 0 ? <p><strong>{percent(ratio(metrics.present, metrics.recorded))}</strong> · {number(metrics.present)} de {number(metrics.recorded)} registros</p> : <EmptyState title="Sin sesiones registradas." />}
        <details><summary>Historial de reportes</summary>
          {metrics.history.length ? <ul>{[...metrics.history].sort((a,b) => b.date.localeCompare(a.date)).map((h, i) =>
            <li key={i}>{h.date} · {h.label} · {h.pending ? 'Pendiente de envío' : 'Enviado'}</li>)}</ul> : <EmptyState title="Sin reportes registrados." />}
        </details></>}
    </ReportRead></Card>
    <TeacherHours uid={profile.uid} schoolIds={profile.schoolIds} schoolNames={schoolNames} />
  </>
}
