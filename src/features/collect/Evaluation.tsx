import { LoadError } from '../../ui/LoadError'
import { useState } from 'react'
import type { Evaluation, Moment, School, Student, Subject } from '../../domain/types'
import { saveEvaluation, useSchoolEvaluations } from '../../data/evaluations'
import { addStudentsToGroup, useGroups } from '../../data/groups'
import { patchStudent, useStudents } from '../../data/students'
import { levelColor } from '../../domain/levelPalette'
import { levelLabel, LEVELS, MOMENTS, shouldOverwriteLevel } from '../../domain/levels'
import { Button, Card, Dialog, LevelChip, SyncStatus } from '../../ui/components'
import { useAction } from './useAction'
import { genders, numbers } from './formValues'
import { Choice, MomentField, SubjectField } from './common'

import { Link } from 'react-router-dom'
import { collectLink } from '../teacher/navigation'
import { useGuideReceipt } from '../teacher/guideContext'
import { StudentEditor } from './Students'

export function Evaluations({ schoolId, campus, initialGroup = '', initialSubject, initialMoment, school, studentId }: {
  schoolId: string; campus: string; initialGroup?: string; initialSubject?: string | null; initialMoment?: string | null; school?: School; studentId?: string | null
}) {
  const [subject, setSubject] = useState<Subject>(initialSubject === 'matematicas' ? 'matematicas' : 'lectura')
  const [moment, setMoment] = useState<Moment | ''>(MOMENTS.find(m => m === initialMoment) ?? '')
  const [groupId, setGroup] = useState(initialGroup)
  const [adding, setAdding] = useState(false)
  const { groups, loading: loadingGroups, error: groupError } = useGroups(schoolId, { mine: true })
  const { students, loading, error } = useStudents(schoolId)
  const options = groups.filter(g => g.subject === subject && (!g.campus || g.campus === campus))
  const group = options.find(g => g.id === groupId)
  const roster = students.filter(s => s.schoolId === schoolId && (s.campus === campus || group?.campus === '') && !s.retired && s.active && (!groupId || group?.studentIds.includes(s.id)))
  const events = useSchoolEvaluations(schoolId, subject, moment, roster.map(s => s.id))
  const latest = new Map<string, Evaluation>()
  for (const event of events.data) {
    if (event.moment === moment && (!latest.has(event.studentId) || latest.get(event.studentId)!.savedAt < event.savedAt)) latest.set(event.studentId, event)
  }
  if (error || groupError || events.error) return <LoadError message={error || groupError || events.error} />
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
    {school && moment && <Button onClick={() => setAdding(true)}>Añadir estudiante</Button>}
    {school && adding && <StudentEditor classRegistration school={school} campus={campus} admin={false} onClose={() => setAdding(false)} onSaved={async id => { if (group) await addStudentsToGroup(group.id,[id]) }} />}
    {!moment ? <p>Selecciona el momento para ver a los estudiantes.</p> : loading || loadingGroups || events.loading ? <p>Cargando estudiantes…</p> :
      roster.length ? roster.map(s => <StudentEvaluation key={JSON.stringify([s.id, subject, moment, group?.id])} student={s} event={latest.get(s.id)} initiallyOpen={s.id === studentId} {...{ subject, moment }} groupId={group?.id} />) : <p>Añade un estudiante o elige otro grupo para evaluar.</p>}</>
}
function StudentEvaluation({ student, subject, moment, groupId, event, initiallyOpen }: { event?: Evaluation; initiallyOpen: boolean; student: Student; subject: Subject; moment: Moment; groupId?: string }) {
  const [draft, setDraft] = useState<Partial<Record<'gender' | 'age' | 'sample' | 'level', string>>>({})
  const action = useAction()
  const guideSaved = useGuideReceipt()
  const current = student.levels[subject]
  const savedLevel = event?.level ?? (current?.moment === moment ? current.level : '')
  const level = draft.level ?? savedLevel
  const [expanded, setExpanded] = useState(initiallyOpen)
  const [retiring, setRetiring] = useState(false)
  const gender = draft.gender ?? student.gender
  const age = draft.age ?? String(student.age ?? '')
  const sample = draft.sample ?? String(student.sample ?? '')
  const ready = draft.level !== undefined && (gender === 'F' || gender === 'M') && +age >= 5 && +age <= 18 && +sample >= 1 && +sample <= 4 && LEVELS[subject].includes(level)
  function change(key: keyof typeof draft, value: string) { setDraft(d => ({ ...d, [key]: value })) }
  return <Card>
    <h3><Button data-guide="student" variant="ghost" aria-expanded={expanded} onClick={() => setExpanded(!expanded)}>{student.fullName}</Button></h3>
    <LevelChip subject={subject} level={savedLevel} />
    {event && <SyncStatus pending={'syncState' in event && event.syncState === 'pending'} />}
    <small>Grado {student.grade}° · {student.code}</small>
    {expanded && <fieldset disabled={action.busy}>
      <Link className="ui-link-button" to={collectLink('estudiantes', { school: student.schoolId, campus: student.campus, student: student.id })}>Ver perfil e historial</Link>
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
      {!shouldOverwriteLevel(current?.moment, moment) && <p>Esta evaluación quedará en el historial y conservará el nivel actual.</p>}
      <Button variant="danger" onClick={() => setRetiring(true)}>Retirar estudiante</Button>
      <div className="teacher-save"><Button variant="primary" disabled={!ready} onClick={() => ready && action.run(async () => {
        const receipt = await saveEvaluation({
          studentId: student.id, subject, moment, level, sample: +sample, gender, age: +age, ...(groupId ? { groupId } : {})
        })
        guideSaved?.(receipt.syncState === 'pending')
        setDraft({})
      }, '')}>Guardar evaluación</Button></div>
    </fieldset>}
    {retiring && <Dialog title={'¿Retirar a ' + student.fullName + '?'} busy={action.busy} onClose={() => setRetiring(false)}><p>El historial permanecerá disponible.</p>
      <Button variant="danger" loading={action.busy} onClick={() => action.run(async () => { const result = await patchStudent(student.id,{ retired: true }); setRetiring(false); return result })}>Confirmar retiro</Button>
      {action.feedback}</Dialog>}{!retiring && action.feedback}</Card>
}
