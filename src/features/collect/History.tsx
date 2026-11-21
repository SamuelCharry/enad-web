import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import type { Evaluation, Moment, Student, Subject } from '../../domain/types'
import { adminImport } from '../../data/admin'
import { getStudentHistory, useStudents } from '../../data/students'
import { levelLabel, LEVELS, momentLabel, subjectLabel } from '../../domain/levels'
import { colombiaToday } from '../../domain/weeks'
import { Button, Card, DateInput, Dialog, Field } from '../../ui/components'
import { useAction } from './useAction'
import { matches, numbers } from './formValues'
import { Choice, MomentField, Search, SubjectField } from './common'

export function History({ schoolId }: { schoolId: string }) {
  const { students, loading, error } = useStudents(schoolId)
  const [q, setQ] = useState('')
  const [params, setParams] = useSearchParams()
  const id = params.get('student') ?? ''
  const setId = (student:string) => setParams({schoolId,student})
  const rows = students.filter(s => matches(q, s.fullName, s.code))
  const student = rows.find(s => s.id === id)
  if (error) return <p role="alert">{error}</p>
  return <>
    <div className="collect-fields">
      <Search value={q} onChange={setQ} />
      <Choice label="Estudiante" placeholder="Selecciona el estudiante" value={student?.id ?? ''}
        options={rows.map(s => ({ id: s.id, name: s.fullName + ' · ' + s.code }))} onChange={setId} />
    </div>
    {loading ? <p>Cargando estudiantes…</p> : student ? <HistoryList key={student.id} student={student} /> : <p>Selecciona un estudiante para consultar sus evaluaciones.</p>}</>
}
function HistoryList({ student }: { student: Student }) {
  const [notice,setNotice] = useState('')
  const [version, setVersion] = useState(0)
  const [items, setItems] = useState<Evaluation[] | null>(null)
  const [error, setError] = useState('')
  const [edit, setEdit] = useState<Evaluation | 'new' | null>(null)
  function reload() {
    setItems(null)
    setError('')
    setVersion(v => v + 1)
  }
  useEffect(() => {
    let active = true
    void getStudentHistory(student.id).then(h => { if (active) setItems(h.evaluations) }).catch((e: unknown) => {
      if (active) setError(e instanceof Error ? e.message : 'No se pudo cargar el historial.')
    })
    return () => { active = false }
  }, [student.id, version])
  return <>
    <Button variant="primary" onClick={() => setEdit('new')}>Registrar evaluación histórica</Button>
    {notice && <p role="status">{notice}</p>}{error ? <p role="alert">{error} <Button onClick={() => reload()}>Reintentar</Button>
    </p> : !items ? <p>Cargando historial…</p> : !items.length && <p>Sin evaluaciones registradas.</p>}
    {items?.map(ev => <Card key={ev.id}>
      <h3>{subjectLabel(ev.subject)} · {momentLabel(ev.moment)}</h3>
      <p>{ev.date} · {levelLabel(ev.subject, ev.level)}</p>
      {ev.id === 'imp_' + ev.subject + '_' + ev.moment && <Button onClick={() => setEdit(ev)}>Editar evaluación histórica</Button>}</Card>)}
    {edit && <HistoricalEditor student={student} evaluation={edit === 'new' ? undefined : edit} saved={() => {
      setNotice('Evaluación histórica guardada.')
      reload()
      setEdit(null)
    }} onClose={() => setEdit(null)} />}</>
}
function HistoricalEditor({ student, evaluation, saved, onClose }: { student: Student; evaluation?: Evaluation; saved: () => void; onClose: () => void }) {
  const [subject, setSubject] = useState<Subject>(evaluation?.subject ?? 'lectura')
  const [moment, setMoment] = useState<Moment | ''>(evaluation?.moment ?? '')
  const [level, setLevel] = useState(evaluation?.level ?? '')
  const [date, setDate] = useState(evaluation?.date ?? colombiaToday())
  const [sample, setSample] = useState(String(evaluation?.sample ?? ''))
  const action = useAction()
  return <Dialog title="Evaluación histórica" {...{ onClose }} busy={action.busy}>
    <p>{student.fullName}</p>
    <form onSubmit={e => {
      e.preventDefault()
      if (!window.confirm('¿Guardar la evaluación histórica de '+student.fullName+'? Si ya existe un registro importado para esta área y momento, se reemplazará.')) return
      void action.run(async () => {
        const result = await adminImport('evaluations', [{ schoolId: student.schoolId, studentId: student.id, code: student.code, subject, moment, level, date, sample: sample ? +sample : null }])
        if (result.errors.length) throw new Error(result.errors.map(e => e.message).join(' · '))
        saved()
      })
    }}>
      <fieldset disabled={action.busy}>
        <SubjectField disabled={!!evaluation} value={subject} onChange={s => {
          setSubject(s)
          setLevel('')
        }} />
        <MomentField disabled={!!evaluation} value={moment} onChange={setMoment} />
        <Choice required label="Nivel" placeholder="Selecciona el nivel" value={level} options={LEVELS[subject].map(id => ({ id, name: levelLabel(subject, id) }))} onChange={setLevel} />
        <Field label="Fecha de evaluación">
          <DateInput required value={date} onChange={e => setDate(e.target.value)} />
        </Field>
        <Choice label="Muestra" placeholder="Sin asignar" value={sample} options={numbers(1, 4)} onChange={setSample} />
        <p>Al guardar se actualiza el registro histórico de esta área y momento.</p>
        <Button type="submit" variant="primary">Guardar evaluación histórica</Button>
      </fieldset>{action.feedback}</form>
  </Dialog>
}
