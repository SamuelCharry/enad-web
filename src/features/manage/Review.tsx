import { useState } from 'react'
import { mergeStudents } from '../../data/functions'
import { resolveReview, reviewReason, type ReviewAction, useReviewQueue } from '../../data/review'
import { cleanName, validateName } from '../../domain/text/studentNameRules'
import { useSchools } from '../../data/scope'
import { useStudents } from '../../data/students'
import type { School, Student } from '../../domain/types'
import { Button, Dialog, Field, TextInput } from '../../ui/components'
import { Choice, Search } from '../collect/common'
import { matches } from '../collect/formValues'
import { useAction } from '../collect/useAction'
import { LiveState } from '../reports/ReportState'

function Preview({s,title,schools}:{s:Student;title:string;schools:School[]}) {
  const site = schools.find(x => x.id === s.schoolId)?.campuses.find(c => c.id === s.campus || c.name === s.campus)
  return <section><h3>{title}</h3><strong>{s.fullName}</strong><p>{s.code} · Grado {s.grade}°</p><p>{site?.name || 'Sin sede asignada'}</p></section>
}
function Merge({student,schools,close,done}:{schools:School[];student:Student;close:()=>void;done:()=>void}) {
  const roster = useStudents(student.schoolId), action = useAction()
  const [id,setId] = useState(student.reviewReasons?.find(r => r.startsWith('posible_duplicado:'))?.slice('posible_duplicado:'.length) || '')
  const options = roster.students.filter(s => s.id !== student.id && s.active && !s.mergedInto)
  const target = options.find(s => s.id === id)
  return <Dialog title="Unir estudiantes" onClose={close} busy={action.busy}><LiveState loading={roster.loading} error={roster.error}>
    <Choice label="Ficha que se conservará" options={options.map(s => ({id:s.id,name:s.fullName+' · '+s.code}))} value={target?.id || ''} placeholder="Elige un estudiante" onChange={setId}/>
    <div className="day-actions"><Preview schools={schools} s={student} title="Ficha por revisar"/>{target && <Preview schools={schools} s={target} title="Ficha que se conserva"/>}</div>
    {target && target.grade !== student.grade && <p role="status">Los grados son diferentes. Confirma que es el mismo estudiante.</p>}
    <p>La asistencia, las evaluaciones y los grupos pasarán a la ficha que se conserva.</p>
    <Button variant="primary" loading={action.busy} disabled={!target || action.busy} onClick={() => target && action.run(async () => { await mergeStudents(student.id,target.id); done() })}>{action.busy ? 'Uniendo fichas…' : 'Confirmar unión'}</Button></LiveState>{action.feedback}</Dialog>
}
type RowProps = {
  student: Student
  candidates: Student[]
  school?: School
  busy: boolean
  approve: () => void
  edit: () => void
  merge: () => void
  discard: () => void
}

function ReviewRow({student, candidates, school, busy, approve, edit, merge, discard}: RowProps) {
  const [info, setInfo] = useState(false)
  const [more, setMore] = useState(false)
  const corrected = cleanName(student.fullName)
  const valid = !validateName(corrected).includes('formato_nombre') && corrected.length <= 80
  const duplicate = student.reviewReasons?.some(reason => reason.startsWith('posible_duplicado:'))
  const reasons = [...new Set(student.reviewReasons?.map(reviewReason))]
  const source = student.source && {manual:'Registro manual',ocr:'Lectura de foto',import:'Importación'}[student.source]
  return <article className="review-row" aria-label={student.fullName}>
    <div className="review-pair">
      <div><small>Por revisar</small><h2>{student.fullName}</h2>
        <p>{[student.code, `Grado ${student.grade}°`, school?.name].filter(Boolean).join(' · ')}</p></div>
      {candidates.map(candidate => <div key={candidate.id}><small>Posible coincidencia</small>
        <h3>{candidate.fullName}</h3><p>{candidate.code} · Grado {candidate.grade}°</p></div>)}
      {!duplicate && valid && corrected !== student.fullName && <div><small>Nombre corregido</small><h3>{corrected}</h3></div>}
    </div>
    <div className="review-actions">
      <Button variant="primary" disabled={busy} onClick={duplicate ? merge : valid ? approve : edit}>
        {duplicate ? 'Comparar fichas' : valid ? 'Aprobar nombre' : 'Corregir nombre'}</Button>
      <Button variant="ghost" disabled={busy} aria-expanded={more} onClick={() => setMore(!more)}>Más opciones</Button>
      <Button variant="ghost" aria-label={'Información sobre '+student.fullName} onClick={() => setInfo(true)}>
        <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.7">
          <circle cx="12" cy="12" r="9"/><path strokeLinecap="round" d="M12 11v5m0-9v.2"/></svg></Button>
    </div>
    {more && <div className="review-options">
      {duplicate && valid && <Button disabled={busy} onClick={approve}>Aprobar como ficha separada</Button>}
      {(duplicate || valid) && <Button disabled={busy} onClick={edit}>Corregir nombre</Button>}
      {!duplicate && <Button disabled={busy} onClick={merge}>Unir con otra ficha</Button>}
      <Button disabled={busy} onClick={discard}>Descartar ficha</Button></div>}
    {info && <Dialog title="Información del nombre" onClose={() => setInfo(false)}>
      <p><strong>{student.fullName}</strong></p>
      {source && <p>{source}</p>}
      {reasons.length > 0 && <ul>{reasons.map(reason => <li key={reason}>{reason}</li>)}</ul>}
      {duplicate && valid && corrected !== student.fullName && <p>Al aprobar la ficha separada, se guardará como {corrected}.</p>}
      {!source && !reasons.length && <p>Sin detalles del registro.</p>}
    </Dialog>}
  </article>
}
export function Review() {
  const {schools} = useSchools()
  const queue = useReviewQueue(), action = useAction()
  const [search,setSearch] = useState(''), [edit,setEdit] = useState<Student>(), [merge,setMerge] = useState<Student>(), [name,setName] = useState('')
  const [undo,setUndo] = useState<()=>Promise<void>>()
  function save(s:Student,kind:ReviewAction) {
    void action.run(async () => { const revert = await resolveReview(s.id,kind,name); setUndo(() => revert); setEdit(undefined) },'')
  }
  const list = queue.data.filter(s => matches(search,s.fullName,s.code))
  const schoolIds = [...new Set(list.map(s => s.schoolId))]
  return <LiveState loading={queue.loading} error={queue.error}><Search value={search} onChange={setSearch}/>
    {schoolIds.map(id => <ReviewSchool key={id} schoolId={id} students={list.filter(s => s.schoolId === id)}>{(s,others) =>
      <ReviewRow key={s.id} student={s} candidates={others} school={schools.find(school => school.id === id)} busy={action.busy}
        approve={() => save(s,'aprobar')} edit={() => { setEdit(s); setName(s.fullName) }} merge={() => setMerge(s)}
        discard={() => { if (window.confirm('¿Descartar la ficha de '+s.fullName+'? Quedará inactiva.')) save(s,'descartar') }}/>}
    </ReviewSchool>)}
    {!list.length && <p>{search ? 'No hay coincidencias.' : 'No quedan nombres por revisar.'}</p>}
    {edit && <Dialog title="Corregir nombre" onClose={() => setEdit(undefined)} busy={action.busy}><Field label="Nombre completo"><TextInput value={name} onChange={e => setName(e.target.value)}/></Field>
      <Button variant="primary" loading={action.busy} onClick={() => save(edit,'corregir')}>Guardar corrección</Button>{action.feedback}</Dialog>}
    {merge && <Merge schools={schools} student={merge} close={() => setMerge(undefined)} done={() => { setMerge(undefined); setUndo(undefined); void action.run(async () => {},'Fichas unidas.') }}/>}
    {!edit && action.feedback}{undo && <div className="ui-toast"><span role="status">Revisión guardada.</span><Button disabled={action.busy} onClick={() => action.run(async () => { await undo(); setUndo(undefined) },'Revisión deshecha.')}>Deshacer revisión</Button></div>}</LiveState>
}

type ReviewSchoolProps = {schoolId:string;students:Student[];children:(s:Student,others:Student[])=>React.ReactNode}
function ReviewSchool(props: ReviewSchoolProps) {
  if (props.students.some(s => s.reviewReasons?.some(r => r.startsWith('posible_duplicado:')))) return <RelatedRecords {...props}/>
  return <>{props.students.map(s => props.children(s,[]))}</>
}
function RelatedRecords({schoolId,students,children}:ReviewSchoolProps) {
  const roster = useStudents(schoolId)
  return <>{roster.error && <p role="alert">No se pudieron cargar las posibles coincidencias.</p>}{students.map(s =>
    children(s,roster.students.filter(candidate => s.reviewReasons?.includes('posible_duplicado:'+candidate.id))))}</>
}
