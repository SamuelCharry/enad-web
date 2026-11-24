import { LoadError } from '../../ui/LoadError'
import { useState } from 'react'
import type { Evaluation, Moment, School, Student, Subject } from '../../domain/types'
import { saveEvaluation, useSchoolEvaluations } from '../../data/evaluations'
import { addStudentsToGroup, useGroups } from '../../data/groups'
import { useStudents } from '../../data/students'
import { levelColor } from '../../domain/levelPalette'
import { levelLabel, LEVELS, MOMENTS, shouldOverwriteLevel } from '../../domain/levels'
import { Button, Card, LevelChip, SyncStatus } from '../../ui/components'
import { useAction } from './useAction'
import { Choice, MomentField, SubjectField } from './common'

import { Link } from 'react-router-dom'
import { collectLink } from '../teacher/navigation'
import { useGuideReceipt } from '../teacher/guideContext'
import { StudentEditor } from './Students'

export function Evaluations({ schoolId, campus, initialGroup = '', initialSubject, initialMoment, school, studentId }: {
  schoolId: string; campus: string; initialGroup?: string; initialSubject?: string | null; initialMoment?: string | null; school?: School; studentId?: string | null
}) {
  const [chosenSubject, setSubject] = useState<Subject | undefined>(initialSubject === 'matematicas' || initialSubject === 'lectura' ? initialSubject : undefined)
  const [moment, setMoment] = useState<Moment | ''>(MOMENTS.find(m => m === initialMoment) ?? '')
  const [groupId, setGroup] = useState(initialGroup)
  const [adding, setAdding] = useState(false)
  const { groups, loading: loadingGroups, error: groupError } = useGroups(schoolId, { mine: true })
  const { students, loading, error } = useStudents(schoolId)
  const campusName = school?.campuses.find(c => c.id === campus)?.name
  const localGroups = groups.filter(g => !g.campus || g.campus === campus || g.campus === campusName || g.id === initialGroup)
  const subject = localGroups.find(g => g.id === groupId)?.subject || chosenSubject || localGroups[0]?.subject || 'lectura'
  const options = localGroups.filter(g => g.subject === subject)
  const group = groupId ? options.find(g => g.id === groupId) : options[0]
  const roster = students.filter(s => s.schoolId === schoolId && !s.retired && s.active && group?.studentIds.includes(s.id))
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
      <Choice label="Grupo" value={group?.id ?? ''} options={options} placeholder={options.length ? undefined : "Sin grupos en esta sede"} onChange={setGroup} />
    </div>
    {school && group && moment && <Button onClick={() => setAdding(true)}>Añadir estudiante</Button>}
    {school && adding && <StudentEditor classRegistration school={school} campus={group?.campus || campus} admin={false} onClose={() => setAdding(false)} onSaved={async id => { if (group) await addStudentsToGroup(group.id,[id]) }} />}
    {!moment ? <p>Selecciona el momento para ver a los estudiantes.</p> : loading || loadingGroups || events.loading ? <p>Cargando estudiantes…</p> :
      roster.length ? roster.map(s => <StudentEvaluation key={JSON.stringify([s.id, subject, moment, group?.id])} student={s} event={latest.get(s.id)} initiallyOpen={s.id === studentId} {...{ subject, moment }} groupId={group?.id} />) : <p>Añade un estudiante o elige otro grupo para evaluar.</p>}</>
}
function StudentEvaluation({ student, subject, moment, groupId, event, initiallyOpen }: { event?: Evaluation; initiallyOpen: boolean; student: Student; subject: Subject; moment: Moment; groupId?: string }) {
  const [draft, setDraft] = useState<string>()
  const action = useAction()
  const guideSaved = useGuideReceipt()
  const current = student.levels[subject]
  const savedLevel = event?.level ?? (current?.moment === moment ? current.level : '')
  const level = draft ?? savedLevel
  const [expanded, setExpanded] = useState(initiallyOpen)
  const ready = draft !== undefined && LEVELS[subject].includes(level)
  return <Card>
    <h3><Button data-guide="student" variant="ghost" aria-expanded={expanded} onClick={() => setExpanded(!expanded)}>{student.fullName}</Button></h3>
    <LevelChip subject={subject} level={savedLevel} />
    {(event || draft) && <SyncStatus dirty={draft !== undefined} pending={!!event && 'syncState' in event && event.syncState === 'pending'} />}
    <small>Grado {student.grade}° · {student.code}</small>
    {expanded && <fieldset disabled={action.busy}>
      <Link className="ui-link-button" to={collectLink('estudiantes', { school: student.schoolId, campus: student.campus, student: student.id })}>Ver perfil e historial</Link>
      <fieldset>
        <legend>Nivel alcanzado</legend>
        <div className="collect-actions">{LEVELS[subject].map((id, i) => {
          const colors = levelColor(i)
          return <Button key={id} aria-pressed={id === level} style={{ backgroundColor: colors.bg, color: colors.fg }} onClick={() => setDraft(id)}>{id === level ? '✓ ' : ''}{levelLabel(subject, id)}</Button>
        })}</div>
      </fieldset>
      {!shouldOverwriteLevel(current?.moment, moment) && <p>Esta evaluación quedará en el historial y conservará el nivel actual.</p>}
      <div className="teacher-save"><Button variant="primary" disabled={!ready} onClick={() => ready && action.run(async () => {
        const receipt = await saveEvaluation({
          studentId: student.id, subject, moment, level, ...(groupId ? { groupId } : {})
        })
        guideSaved?.(receipt.syncState === 'pending')
        setDraft(undefined)
      }, '')}>Guardar evaluación</Button></div>
    </fieldset>}
    {action.feedback}</Card>
}
