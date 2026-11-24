import { useState } from 'react'
import { mergeStudents } from '../../data/functions'
import { resolveReview, reviewReason, type ReviewAction, useReviewQueue } from '../../data/review'
import { useStudents } from '../../data/students'
import type { Student } from '../../domain/types'
import { Button, Dialog, Field, TextInput } from '../../ui/components'
import { Choice, Search } from '../collect/common'
import { matches } from '../collect/formValues'
import { useAction } from '../collect/useAction'
import { LiveState } from '../reports/ReportState'

function Preview({s,title}:{s:Student;title:string}) {
  return <section><h3>{title}</h3><strong>{s.fullName}</strong><p>{s.code} · Grado {s.grade}°</p><p>{s.campus || 'Sin sede asignada'}</p></section>
}
function Merge({student,close,done}:{student:Student;close:()=>void;done:()=>void}) {
  const roster = useStudents(student.schoolId), action = useAction()
  const [id,setId] = useState(student.reviewReasons?.find(r => r.startsWith('posible_duplicado:'))?.slice('posible_duplicado:'.length) || '')
  const options = roster.students.filter(s => s.id !== student.id && s.active && !s.mergedInto)
  const target = options.find(s => s.id === id)
  return <Dialog title="Unir estudiantes" onClose={close} busy={action.busy}><LiveState loading={roster.loading} error={roster.error}>
    <Choice label="Ficha que se conservará" options={options.map(s => ({id:s.id,name:s.fullName+' · '+s.code}))} value={target?.id || ''} placeholder="Elige un estudiante" onChange={setId}/>
    <div className="day-actions"><Preview s={student} title="Ficha por revisar"/>{target && <Preview s={target} title="Ficha que se conserva"/>}</div>
    <p>La asistencia, las evaluaciones y los grupos pasarán a la ficha que se conserva.</p>
    <Button variant="primary" disabled={!target || action.busy} onClick={() => target && action.run(async () => { await mergeStudents(student.id,target.id); done() })}>Confirmar unión</Button></LiveState>{action.feedback}</Dialog>
}
export function Review() {
  const queue = useReviewQueue(), action = useAction()
  const [search,setSearch] = useState(''), [edit,setEdit] = useState<Student>(), [merge,setMerge] = useState<Student>(), [name,setName] = useState('')
  const [undo,setUndo] = useState<()=>Promise<void>>()
  function save(s:Student,kind:ReviewAction) {
    void action.run(async () => { const revert = await resolveReview(s.id,kind,name); setUndo(() => revert); setEdit(undefined) },'')
  }
  const list = queue.data.filter(s => matches(search,s.fullName,s.code))
  return <LiveState loading={queue.loading} error={queue.error}><Search value={search} onChange={setSearch}/>
    {list.map(s => <article key={s.id} className="activity-row"><h2>{s.fullName}</h2><p>{s.code} · Grado {s.grade}°</p>
      <ul>{(s.reviewReasons || []).map(r => <li key={r}>{reviewReason(r)}</li>)}</ul><div className="collect-actions">
      <Button disabled={action.busy} onClick={() => save(s,'aprobar')}>Aprobar</Button><Button onClick={() => { setEdit(s); setName(s.fullName) }}>Corregir</Button>
      <Button onClick={() => setMerge(s)}>Unir con…</Button><Button onClick={() => { if (window.confirm('¿Descartar la ficha de '+s.fullName+'? Quedará inactiva.')) save(s,'descartar') }}>Descartar</Button></div></article>)}
    {!list.length && <p>{search ? 'No hay coincidencias.' : 'No quedan nombres por revisar.'}</p>}
    {edit && <Dialog title="Corregir nombre" onClose={() => setEdit(undefined)} busy={action.busy}><Field label="Nombre completo"><TextInput value={name} onChange={e => setName(e.target.value)}/></Field>
      <Button variant="primary" loading={action.busy} onClick={() => save(edit,'corregir')}>Guardar corrección</Button>{action.feedback}</Dialog>}
    {merge && <Merge student={merge} close={() => setMerge(undefined)} done={() => { setMerge(undefined); setUndo(undefined); void action.run(async () => {},'Fichas unidas.') }}/>}
    {!edit && action.feedback}{undo && <div className="ui-toast"><span role="status">Revisión guardada.</span><Button disabled={action.busy} onClick={() => action.run(async () => { await undo(); setUndo(undefined) },'Revisión deshecha.')}>Deshacer revisión</Button></div>}</LiveState>
}
