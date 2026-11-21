import { useState } from 'react'
import type { Group, ReportFilters, Student } from '../../domain/types'
import { getStudentHistory, levelLabel, momentLabel, SUBJECTS, subjectLabel, useStudents } from './_pending'
import { Button, Card, EmptyState, LevelChip, Table } from './_pendingUi'
import { number, percent, studentRate } from './model'
import { LiveState, ReportRead } from './ReportState'

const statusLabels = { vino: 'Asistió', no_vino: 'No asistió', retirado: 'Retirado' }

function StudentDetail({ student, onBack }: { student: Student; onBack: () => void }) {
  return <><Button onClick={onBack}>Volver al grupo</Button><Card><h3>{student.fullName}</h3>
    <dl className="rep-facts">{[
      ['Código', student.code], ['Grado', number(student.grade)], ['Edad', student.age == null ? 'Sin registrar' : number(student.age) + ' años'],
      ['Género', { F: 'Femenino', M: 'Masculino', '': 'Sin registrar' }[student.gender]], ['Estado', student.retired ? 'Retirado' : student.active ? 'Activo' : 'Inactivo'],
      ['Muestra', student.sample == null ? 'Sin registrar' : number(student.sample)],
    ].map(([key, value]) => <div key={key}><dt>{key}</dt><dd>{value}</dd></div>)}</dl>
    {SUBJECTS.map(s => <p key={s}>{subjectLabel(s)} · <LevelChip subject={s} level={student.levels[s]?.level} /></p>)}
  </Card><ReportRead query={student.id} load={() => getStudentHistory(student.id)}>{h => <>
    <Card><h3>Historial de evaluaciones</h3>{h.evaluations.length ? <Table caption="Evaluaciones del estudiante" headers={['Fecha', 'Área', 'Momento', 'Nivel']}
      rows={[...h.evaluations].sort((a,b) => b.date.localeCompare(a.date) || b.savedAt.localeCompare(a.savedAt)).map(e => ({
        key: e.id, cells: [e.date, subjectLabel(e.subject), momentLabel(e.moment), levelLabel(e.subject, e.level)],
      }))} /> : <EmptyState title="Sin evaluaciones registradas." />}</Card>
    <Card><h3>Historial de asistencia</h3>{h.attendance.length ? <Table caption="Asistencia del estudiante" headers={['Fecha', 'Grupo', 'Estado']}
      rows={[...h.attendance].sort((a,b) => b.date.localeCompare(a.date)).map(a => ({ key: JSON.stringify([a.groupId, a.date]), cells: [a.date, a.groupId, statusLabels[a.status]] }))} />
      : <EmptyState title="Sin registros de asistencia." />}</Card>
  </>}</ReportRead></>
}

async function readRates(students: Student[], groupId: string, filters: ReportFilters, signal: AbortSignal) {
  const rates = new Map<string, number | null>()
  for (let i = 0; i < students.length; i += 5) {
    signal.throwIfAborted()
    await Promise.all(students.slice(i, i + 5).map(async student => {
      const h = await getStudentHistory(student.id)
      rates.set(student.id, studentRate(h.attendance, groupId, filters))
    }))
  }
  return rates
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
        profiles ? <Button variant="ghost" onClick={() => select(s.id)}>{s.fullName}</Button> : s.fullName, s.code,
        ...SUBJECTS.map(subject => <LevelChip key={subject} subject={subject} level={s.levels[subject]?.level} />),
        ...(rates ? [percent(rates.get(s.id))] : []),
      ] }))} />
  }
  return <LiveState loading={loading} error={error}>
    {student ? <StudentDetail student={student} onBack={() => select('')} />
      : <><h3>{group.name}</h3><p>{subjectLabel(group.subject)} · {group.teacherName}</p>
        {!roster.length ? <EmptyState title="Este grupo aún no tiene estudiantes." /> : profiles ? table() :
          <ReportRead query={JSON.stringify([group.id, filters, roster.map(s => s.id)])} load={signal => readRates(roster, group.id, filters, signal)}>{rates => table(rates)}</ReportRead>}
      </>}
  </LiveState>
}
