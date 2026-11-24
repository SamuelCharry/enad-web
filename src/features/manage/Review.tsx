import { useState } from 'react'
import { mergeStudents } from '../../data/functions'
import { resolveReview, reviewReason, type ReviewAction, useReviewQueue } from '../../data/review'
import { cleanName } from '../../domain/text/studentNameRules'
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
    {schoolIds.map(id => <ReviewSchool key={id} schoolId={id} students={list.filter(s => s.schoolId === id)}>{(s,others) => <article key={s.id} className="activity-row"><h2>{s.fullName}</h2><p>{s.code} · Grado {s.grade}°</p>
      {others.length > 0 && <div className="review-pair"><Preview schools={schools} s={s} title="Por revisar"/>{others.map(v => <Preview key={v.id} schools={schools} s={v} title="Posible duplicado"/>)}</div>}
      <p>Se guardará como {cleanName(s.fullName)}</p><ul>{(s.reviewReasons || []).map(r => <li key={r}>{reviewReason(r)}</li>)}</ul><div className="collect-actions">
      <Button disabled={action.busy} onClick={() => save(s,'aprobar')}>Aprobar</Button><Button onClick={() => { setEdit(s); setName(s.fullName) }}>Corregir</Button>
      <Button onClick={() => setMerge(s)}>Unir con…</Button><Button onClick={() => { if (window.confirm('¿Descartar la ficha de '+s.fullName+'? Quedará inactiva.')) save(s,'descartar') }}>Descartar</Button></div></article>}</ReviewSchool>)}
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
