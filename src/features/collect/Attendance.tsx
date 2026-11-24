import { LoadError } from '../../ui/LoadError'
import { useId, useState } from 'react'
import { Link } from 'react-router-dom'
import type { AttendanceStatus, Group, School, Student } from '../../domain/types'
import { saveGroupAttendance, useSchoolAttendance } from '../../data/attendance'
import { addStudentsToGroup, useGroups } from '../../data/groups'
import { useStudents } from '../../data/students'
import { colombiaToday } from '../../domain/weeks'
import { Button, Card, Dialog, SyncStatus } from '../../ui/components'
import { useAction } from './useAction'
import { validDay } from './formValues'
import { Field, TextInput } from '../../ui/components'
import { useSchools } from '../../data/scope'
import { Choice, SessionDate } from './common'
import { StudentEditor } from './Students'
import { collectLink } from '../teacher/navigation'
import { useGuideReceipt } from '../teacher/guideContext'
import { useAttendanceDrafts } from '../teacher/useAttendanceDrafts'
import { shiftDay } from '../reports/model'

type Marks = Record<string, AttendanceStatus>
interface AttendanceProps { initialDate?:string|null; uid?:string; schoolId?:string; initialGroup?:string; school?:School }
export function TeacherAttendance(props:AttendanceProps) {
  const schools = useSchools()
  if (schools.error) return <LoadError message={schools.error}/>
  if (schools.loading) return <p role="status">Cargando colegios…</p>
  return <Attendance {...props} schools={schools.schools}/>
}
export function Attendance({ schoolId, initialGroup = '', initialDate, school, schools = [], uid }: AttendanceProps & {schools?:School[]}) {
  const { groups, loading, error } = useGroups(schoolId, { mine: true })
  const today = colombiaToday()
  const [date, setDate] = useState(() => {
    if (!initialDate || !validDay(initialDate, today)) return today
    const parsed = new Date(initialDate + 'T00:00:00Z')
    return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0,10) === initialDate ? initialDate : today
  })
  const [typed,setTyped] = useState<string>()
  const list = useId()
  const [id, setId] = useState(initialGroup)
  const [saving, setSaving] = useState(false)
  const group = groups.find(g => g.id === id)
  const optionText = (g:Group) => [g.name,schools.find(s => s.id === g.schoolId)?.name,g.campus].filter(Boolean).join(' · ')
  const labels = groups.map(g => optionText(g))
  const options = groups.map((g,i) => ({id:g.id,name:labels.indexOf(labels[i]) === labels.lastIndexOf(labels[i]) ? labels[i] : labels[i]+' · '+g.id}))
  const activeSchool = school || schools.find(s => s.id === group?.schoolId)
  const { drafts, update } = useAttendanceDrafts(uid,group?.schoolId || '')
  const key = JSON.stringify([id, date])
  const valid = validDay(date, today)
  if (error) return <LoadError message={error} />
  return <>
    <fieldset disabled={saving} className="collect-fields">
      {groups.length > 5 ? <Field label="Grupo"><TextInput data-guide="group" list={list} type="search" placeholder="Busca tu grupo" value={typed ?? options.find(o => o.id === id)?.name ?? ''}
        onChange={e => {setTyped(e.target.value);setId(options.find(o => o.name === e.target.value)?.id || '')}} data-complete={!!group}/>
        <datalist id={list}>{options.map(o => <option key={o.id} value={o.name}/>)}</datalist></Field> :
        <Choice guide="group" label="Grupo" placeholder="Selecciona un grupo" options={options} value={group?.id || ''} onChange={setId}/>}
      <SessionDate {...{ date, today, setDate }} />
    </fieldset>
    <div className="teacher-tools">
      <Button disabled={saving || !valid || date.endsWith('-01-01')} onClick={() => setDate(shiftDay(date,-1))}>Día anterior</Button>
      <Button disabled={saving || !valid || date >= today} onClick={() => setDate(shiftDay(date,1))}>Día siguiente</Button>
      {date !== today && <Button disabled={saving} onClick={() => setDate(today)}>Volver a hoy</Button>}
    </div>
    {loading ? <p>Cargando lista…</p> : !valid ? <p>Selecciona una fecha entre el primero de enero y hoy.</p> : group ?
      <RosterSheet key={key} {...{ date, group, setSaving }} school={activeSchool} draft={drafts[key] ?? {}} setDraft={v => update(key, v)} /> :
      <p>{groups.length ? 'Selecciona el grupo para tomar asistencia.' : 'Crea un grupo y añade estudiantes para tomar asistencia.'}</p>}</>
}
function RosterSheet(props:Omit<Parameters<typeof AttendanceSheet>[0],'students'>) {
  const roster = useStudents(props.group.schoolId)
  if (roster.loading) return <p role="status">Cargando estudiantes…</p>
  if (roster.error) return <LoadError message={roster.error}/>
  return <AttendanceSheet {...props} students={roster.students}/>
}
function AttendanceSheet({ date, group, students, draft, setDraft, setSaving, school }: { date: string; group: Group; students: Student[]; draft: Marks; setDraft: (v: Marks) => void; setSaving: (v: boolean) => void; school?: School }) {
  const live = useSchoolAttendance(group.schoolId, date, [group.id])
  const action = useAction()
  const guideSaved = useGuideReceipt()
  const [receipt, setReceipt] = useState<{ snapshot: typeof live.data; marks: Marks; pending: boolean } | null>(null)
  const [retiring, setRetiring] = useState<Student | null>(null)
  const [confirmSave, setConfirmSave] = useState(false)
  const [adding, setAdding] = useState(false)
  if (live.loading) return <p role="status">Cargando asistencia…</p>
  if (live.error) return <LoadError message={live.error} />
  const saved = live.data.filter(m => m.groupId === group.id)
  const pending = new Set(saved.filter(m => m.syncState === 'pending').map(m => m.studentId))
  const baseline: Marks = Object.fromEntries(saved.map(m => [m.studentId, m.status]))
  if (receipt?.snapshot === live.data) {
    Object.assign(baseline, receipt.marks)
    if (receipt.pending) Object.keys(receipt.marks).forEach(id => pending.add(id))
  }
  const members = new Set(group.studentIds)
  const roster = students.filter(s => s.schoolId === group.schoolId && members.has(s.id))
  const status = (id: string) => draft[id] ?? baseline[id]
  const missing = roster.filter(s => !status(s.id)).length
  const changes = Object.fromEntries(roster.filter(s => draft[s.id] && draft[s.id] !== baseline[s.id]).map(s => [s.id, draft[s.id]]))
  const complete = roster.length === members.size && roster.length > 0 && missing === 0
  const percent = roster.length ? Math.round(100 * roster.filter(s => status(s.id) === 'vino').length / roster.length) : 0
  function mark(id: string, value: AttendanceStatus) {
    const next = { ...draft }
    if (baseline[id] === value) delete next[id]
    else next[id] = value
    setDraft(next)
  }
  function save() {
    setConfirmSave(false)
    void action.run(async () => {
      setSaving(true)
      try {
        const result = await saveGroupAttendance(group.id, date, changes)
        if (result.groupId !== group.id || result.date !== date || result.saved !== Object.keys(changes).length) throw new Error('No se pudo confirmar toda la lista. Revisa las marcas y vuelve a guardar.')
        setReceipt({ snapshot: live.data, marks: changes, pending: result.syncState === 'pending' })
        guideSaved?.(result.syncState === 'pending')
        setDraft({})
      } finally { setSaving(false) }
    }, '')
  }
  return <Card>
    <div className="collect-heading"><h3>{group.name}</h3><strong>Asistió el {percent} %</strong></div>
    {members.size !== roster.length && <p role="alert">Faltan integrantes del grupo por cargar.</p>}
    {!members.size && <p>Añade el primer estudiante para tomar asistencia.</p>}
    {roster.length > 0 && <Button data-guide="attendance" data-complete={complete} disabled={action.busy} onClick={() => {
      const next = { ...draft }
      for (const s of roster) {
        if (s.retired || status(s.id) === 'retirado') continue
        if (baseline[s.id] === 'vino') delete next[s.id]
        else next[s.id] = 'vino'
      }
      setDraft(next)
    }}>Marcar a todos presentes</Button>}
    {roster.map(s => <div className="collect-row" key={s.id}>
      <div><Button variant="ghost" disabled={action.busy} aria-label={'Alternar asistencia de ' + s.fullName} onClick={() => mark(s.id, status(s.id) === 'vino' ? 'no_vino' : 'vino')}>{s.fullName}</Button><small>{s.code} · Grado {s.grade}°</small>
        {changes[s.id] ? <small className="ui-sync" data-dirty="true">Sin guardar</small> : baseline[s.id] ? <SyncStatus pending={pending.has(s.id)} /> : <small>Sin registrar</small>}
        {school && <Link to={collectLink('estudiantes', { school: s.schoolId, campus: s.campus, student: s.id })}>Ver perfil</Link>}</div>
      <div className="collect-actions" role="group" aria-label={'Asistencia de ' + s.fullName}>
        {(['vino', 'no_vino', 'retirado'] as const).map((id,i) => <Button key={id} aria-pressed={status(s.id) === id} disabled={action.busy} onClick={() =>
          id === 'retirado' && status(s.id) !== id ? setRetiring(s) : mark(s.id, id)}>{['Vino','No vino','Retirado'][i]}</Button>)}
      </div>
    </div>)}
    {school && <Button data-guide="add" disabled={action.busy} onClick={() => setAdding(true)}>Añadir estudiante</Button>}
    {school && adding && <StudentEditor classRegistration school={school} campus={group.campus} admin={false} onClose={() => setAdding(false)} onSaved={async id => {
      await addStudentsToGroup(group.id, [id]); mark(id,'vino')
    }} />}
    <div className="teacher-save"><p>{missing ? 'Por marcar: ' + missing : roster.length > 0 ? 'Lista completa' : ''}</p>
      <Button data-guide="save" variant="primary" loading={action.busy} disabled={!complete || !Object.keys(changes).length} onClick={() => setConfirmSave(true)}>Guardar asistencia</Button>
      {guideSaved && complete && !Object.keys(changes).length && <Button onClick={() => guideSaved(pending.size > 0)}>Terminar con la asistencia registrada</Button>}
      {action.feedback}</div>
    {confirmSave && <Dialog title="¿Guardar la asistencia?" onClose={() => setConfirmSave(false)}><p>{group.name} · {date} · {Object.keys(changes).length} marcas por guardar</p>
      <Button variant="primary" disabled={!complete || !Object.keys(changes).length} onClick={save}>Confirmar asistencia</Button></Dialog>}
    {retiring && <Dialog title="¿Marcar como retirado?" onClose={() => setRetiring(null)}><p>Al guardar, {retiring.fullName} quedará retirado del programa.</p>
      <Button variant="danger" onClick={() => { mark(retiring.id, 'retirado'); setRetiring(null) }}>Confirmar retiro</Button></Dialog>}
  </Card>
}
