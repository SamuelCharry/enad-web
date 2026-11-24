import { useState } from 'react'
import { correctRecord, type Correction } from '../../data/corrections'
import { getAttendanceRows, getEvaluationRows, getHoursRows } from '../../data/reports'
import { cleanDetail, formatReason, parseReason, REASON_CATEGORIES } from '../../domain/hoursReason'
import { LEVELS, levelLabel, momentLabel, subjectLabel } from '../../domain/levels'
import type { ReportFilters } from '../../domain/types'
import { Button, Field, NumberInput, TextInput } from '../../ui/components'
import { Directory } from '../collect/admin/Directory'
import { Choice } from '../collect/common'
import { useAction } from '../collect/useAction'
import { ReportRead } from './ReportState'

const statuses = [{id:'vino',name:'Asistió'},{id:'no_vino',name:'No asistió'},{id:'retirado',name:'Retirado'}] as const
type Entry = {id:string;cells:(string|number)[]; correction:Correction}
async function load(kind:Correction['kind'],f:ReportFilters):Promise<Entry[]> {
  if (kind === 'evaluations') return (await getEvaluationRows(f)).map(r => ({id:r.studentId+'/'+r.id,
    cells:[r.date,r.student,r.school,subjectLabel(r.subject),momentLabel(r.moment),levelLabel(r.subject,r.level)],
    correction:{kind,record:r,level:r.level}}))
  if (kind === 'attendance') return (await getAttendanceRows(f)).map(r => ({id:r.studentId+'/'+r.id,cells:[r.date,r.student,r.school,statuses.find(s => s.id === r.status)?.name || r.status],
    correction:{kind,record:r,status:r.status}}))
  return (await getHoursRows(f)).map(r => ({id:r.id,cells:[r.date,r.teacher,r.school,r.plannedHours,r.workedHours],correction:{kind,record:r,planned:r.plannedHours,worked:r.workedHours,reason:r.reason}}))
}
function Editor({initial,onSaved}:{initial:Correction;onSaved:()=>void}) {
  const [form,set] = useState(initial)
  const saved = parseReason(form.kind === 'hours' ? form.record.reason : null)
  const [cat,setCat] = useState(saved.category || ''), [detail,setDetail] = useState(saved.detail)
  const action = useAction()
  return <form onSubmit={e => { e.preventDefault()
    if (window.confirm('¿Guardar la corrección del '+form.record.date+'?')) void action.run(async () => {
      await correctRecord(form.kind === 'hours' ? {...form,reason:formatReason(cat,cleanDetail(detail))} : form)
      onSaved()
    })
  }}><fieldset disabled={action.busy}><legend>Corregir registro</legend>
    {form.kind === 'attendance' && <Choice label="Asistencia" options={statuses} value={form.status} onChange={status => set({...form,status})}/>}
    {form.kind === 'evaluations' && <Choice label="Nivel" options={LEVELS[form.record.subject].map(id => ({id,name:levelLabel(form.record.subject,id)}))}
      value={form.level} onChange={level => set({...form,level})}/>}
    {form.kind === 'hours' && <>{(['planned','worked'] as const).map(key => <Field key={key} label={key === 'planned' ? 'Horas planeadas' : 'Horas realizadas'}>
      <NumberInput required min={0} max={24} step={0.5} value={Number.isFinite(form[key]) ? form[key] : ''} onChange={e => set({...form,[key]:e.target.valueAsNumber})}/></Field>)}
      {form.worked < form.planned && <><Choice label="Motivo" required value={cat} placeholder="Elige un motivo" options={REASON_CATEGORIES.map(id => ({id,name:id}))} onChange={setCat}/>
        <Field label="Detalle" hint={detail.length+' de 200 caracteres'}><TextInput required maxLength={200} value={detail} onChange={e => setDetail(cleanDetail(e.target.value))}/></Field></>}</>}
    <Button variant="primary" type="submit">Guardar corrección</Button></fieldset>{action.feedback}</form>
}
export function Records({filters,kind}:{filters:ReportFilters;kind:Correction['kind']}) {
  const [revision,setRevision] = useState(0)
  const headers = kind === 'hours' ? ['Fecha','Docente','Colegio','Planeadas','Realizadas'] : ['Fecha','Estudiante','Colegio',...(kind === 'attendance' ? ['Asistencia'] : ['Área','Momento','Nivel'])]
  return <>{revision > 0 && <p role="status">Corrección guardada.</p>}<ReportRead query={JSON.stringify([kind,filters,revision])} load={() => load(kind,filters)}>{rows =>
    <Directory title={{hours:'Horas',attendance:'Asistencia',evaluations:'Evaluaciones'}[kind]} headers={headers}
      rows={rows.map(r => ({...r,search:r.cells.join(' ')}))} editLabel="Corregir" editor={id => {
        const row = rows.find(r => r.id === id)
        return row && <Editor initial={row.correction} onSaved={() => setRevision(v => v+1)}/>
      }}/>}</ReportRead></>
}
