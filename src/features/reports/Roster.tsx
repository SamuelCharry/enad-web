import { getGroupRoster } from '../../data/reports'
import { useGroups } from '../../data/groups'
import { useState } from 'react'
import type { Group, ReportFilters, Student } from '../../domain/types'
import { getStudentHistory, useStudents } from '../../data/students'
import { momentLabel, SUBJECTS, subjectLabel } from '../../domain/levels'
import { Button, Card, EmptyState, LevelChip, Table } from '../../ui/components'
import { number, percent } from './model'
import { LiveState, ReportRead } from './ReportState'

const statusLabels = { vino: 'Asistió', no_vino: 'No asistió', retirado: 'Retirado' }

export function StudentDetail({ student, onBack, backLabel = 'Volver al grupo' }: { student: Student; onBack: () => void; backLabel?: string }) {
  const { groups, loading, error } = useGroups(student.schoolId)
  const memberships = groups.filter(g => g.studentIds.includes(student.id))
  return <><Button onClick={onBack}>{backLabel}</Button><Card><h3>{student.fullName}</h3>
    <dl className="rep-facts">{[
      ['Código', student.code], ['Grado', number(student.grade)], ['Edad', student.age == null ? 'Sin registrar' : number(student.age) + ' años'],
      ['Género', { F: 'Femenino', M: 'Masculino', '': 'Sin registrar' }[student.gender]], ['Estado', student.retired ? 'Retirado' : student.active ? 'Activo' : 'Inactivo'],
      ['Muestra', student.sample == null ? 'Sin registrar' : number(student.sample)],
    ].map(([key, value]) => <div key={key}><dt>{key}</dt><dd>{value}</dd></div>)}</dl>
    {SUBJECTS.map(s => <p key={s}>{subjectLabel(s)} · <LevelChip subject={s} level={student.levels[s]?.level} /></p>)}
    <h3>Grupos</h3><LiveState loading={loading} error={error}>{memberships.length ? memberships.map(g =>
      <p key={g.id}>{g.name} · {subjectLabel(g.subject)}</p>) : <p>Añade al estudiante desde el detalle de su grupo.</p>}</LiveState>
  </Card><ReportRead query={student.id} load={() => getStudentHistory(student.id)}>{h => <>
    <Card><h3>Historial de evaluaciones</h3>{h.evaluations.length ? [...h.evaluations]
      .sort((a,b) => b.date.localeCompare(a.date) || b.savedAt.localeCompare(a.savedAt))
      .map(e => <div className="teacher-record" key={e.id}><strong>{subjectLabel(e.subject)} · {momentLabel(e.moment)}</strong>
        <p><time>{e.date}</time> · <LevelChip subject={e.subject} level={e.level} /></p></div>) :
      <EmptyState title="Registra el primer nivel desde Evaluación formativa." />}</Card>
    <Card><h3>Historial de asistencia</h3>
      {h.attendance.some(m => m.status !== 'retirado') && <p>{h.attendance.filter(m => m.status === 'vino').length} de {h.attendance.filter(m => m.status !== 'retirado').length} sesiones con asistencia</p>}
      {h.attendance.length ? [...h.attendance].sort((a,b) => b.date.localeCompare(a.date)).map(a =>
        <div className="teacher-record" key={JSON.stringify([a.groupId,a.date])}><strong>{a.date} · {groups.find(g => g.id === a.groupId)?.name || a.groupId}</strong>
          <p>{statusLabels[a.status]}</p></div>) : <EmptyState title="Toma asistencia desde el grupo del estudiante." />}</Card>
  </>}</ReportRead></>
}

export function Roster({ group, filters, profiles = false }: { group: Group; filters: ReportFilters; profiles?: boolean }) {
  const { students, loading, error } = useStudents(group.schoolId)
  const [selected, select] = useState('')
  const members = new Set(group.studentIds)
  const roster = students.filter(s => s.schoolId === group.schoolId && members.has(s.id)).sort((a,b) => a.fullName.localeCompare(b.fullName, 'es-CO'))
  const student = profiles && roster.find(s => s.id === selected)
  function table(rates?: Map<string, number | null>) {
    return <Table caption={'Estudiantes de ' + group.name} headers={['Estudiante', 'Código', 'Lectura', 'Matemáticas', ...(rates ? ['Asistencia en el grupo'] : [])]}
      rows={roster.map(s => ({ key: s.id, cells: [
        s.fullName, s.code,
        ...SUBJECTS.map(subject => <LevelChip key={subject} subject={subject} level={s.levels[subject]?.level} />),
        ...(rates ? [percent(rates.get(s.id))] : []),
      ] }))} />
  }
  return <LiveState loading={loading} error={error}>
    {student ? <StudentDetail student={student} onBack={() => select('')} />
      : <><h3>{group.name}</h3><p>{subjectLabel(group.subject)} · {group.teacherName}</p>
        {!roster.length ? <EmptyState title="Este grupo aún no tiene estudiantes." /> : profiles ? roster.map(s => <div className="teacher-record" key={s.id}>
            <Button variant="ghost" onClick={() => select(s.id)}>{s.fullName}</Button><p>{s.code} · Grado {s.grade}°</p>
            {SUBJECTS.map(subject => <p key={subject}>{subjectLabel(subject)} · <LevelChip subject={subject} level={s.levels[subject]?.level} /></p>)}</div>) :
          <ReportRead query={JSON.stringify([group.id, filters, roster.map(s => s.id)])} load={() => getGroupRoster(group, filters)}>{rows => table(new Map(rows.map(r => [r.student.id, r.rate])))}</ReportRead>}
      </>}
  </LiveState>
}
