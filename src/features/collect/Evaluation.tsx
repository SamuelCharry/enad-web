import { useState } from 'react'
import type { Moment, Student, Subject } from '../../domain/types'
import { saveEvaluation } from '../../data/evaluations'
import { useGroups } from '../../data/groups'
import { useStudents } from '../../data/students'
import { levelColor } from '../../domain/levelPalette'
import { levelLabel, LEVELS } from '../../domain/levels'
import { Button, Card } from '../../ui/components'
import { useAction } from './useAction'
import { genders, numbers } from './formValues'
import { Choice, MomentField, SubjectField } from './common'

export function Evaluations({ schoolId, campus }: { schoolId: string; campus: string }) {
  const [subject, setSubject] = useState<Subject>('lectura')
  const [moment, setMoment] = useState<Moment | ''>('')
  const [groupId, setGroup] = useState('')
  const { groups, loading: loadingGroups, error: groupError } = useGroups(schoolId, { mine: true })
  const { students, loading, error } = useStudents(schoolId)
  const options = groups.filter(g => g.subject === subject && g.campus === campus)
  const group = options.find(g => g.id === groupId)
  const roster = students.filter(s => s.schoolId === schoolId && s.campus === campus && !s.retired && s.active && (!group || group.studentIds.includes(s.id)))
  if (error || groupError) return <p role="alert">{error || groupError}</p>
  return <>
    <div className="collect-fields">
      <SubjectField value={subject} onChange={s => {
        setSubject(s)
        setMoment('')
        setGroup('')
      }} />
      <MomentField value={moment} onChange={setMoment} />
      <Choice label="Grupo" value={group?.id ?? ''} options={options} placeholder="Todos los estudiantes de la sede" onChange={setGroup} />
    </div>
    {!moment ? <p>Selecciona el momento para ver a los estudiantes.</p> : loading || loadingGroups ? <p>Cargando estudiantes…</p> :
      roster.length ? roster.map(s => <StudentEvaluation key={JSON.stringify([s.id, subject, moment, group?.id])} student={s} {...{ subject, moment }} groupId={group?.id} />) : <p>No hay estudiantes en esta selección.</p>}</>
}
function StudentEvaluation({ student, subject, moment, groupId }: { student: Student; subject: Subject; moment: Moment; groupId?: string }) {
  const [draft, setDraft] = useState<Partial<Record<'gender' | 'age' | 'sample' | 'level', string>>>({})
  const action = useAction()
  const current = student.levels[subject]
  const level = draft.level ?? (current?.moment === moment ? current.level : '')
  const gender = draft.gender ?? student.gender
  const age = draft.age ?? String(student.age ?? '')
  const sample = draft.sample ?? String(student.sample ?? '')
  const ready = draft.level !== undefined && (gender === 'F' || gender === 'M') && +age >= 5 && +age <= 18 && +sample >= 1 && +sample <= 4 && LEVELS[subject].includes(level)
  function change(key: keyof typeof draft, value: string) { setDraft(d => ({ ...d, [key]: value })) }
  return <Card>
    <h3>{student.fullName}</h3>
    <small>Grado {student.grade}° · {student.code}</small>
    <fieldset disabled={action.busy}>
      <div className="collect-fields">
        <Choice label="Sexo" value={gender} options={genders} placeholder="Selecciona" onChange={v => change('gender', v)} />
        <Choice label="Edad en años" value={age} options={numbers(5, 18)} placeholder="Selecciona" onChange={v => change('age', v)} />
        <Choice label="Muestra" value={sample} options={numbers(1, 4)} placeholder="Selecciona" onChange={v => change('sample', v)} />
      </div>
      <fieldset>
        <legend>Nivel alcanzado</legend>
        <div className="collect-actions">{LEVELS[subject].map((id, i) => {
          const colors = levelColor(i)
          return <Button key={id} aria-pressed={id === level} style={{ backgroundColor: colors.bg, color: colors.fg }} onClick={() => change('level', id)}>{id === level ? '✓ ' : ''}{levelLabel(subject, id)}</Button>
        })}</div>
      </fieldset>
      <Button variant="primary" disabled={!ready} onClick={() => ready && action.run(async () => {
        const receipt = await saveEvaluation({
          studentId: student.id, subject, moment, level, sample: +sample, gender, age: +age, ...(groupId ? { groupId } : {})
        })
        setDraft({})
        return receipt
      }, 'Evaluación guardada')}>Guardar evaluación</Button>
    </fieldset>{action.feedback}</Card>
}
