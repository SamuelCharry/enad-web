import { useState } from 'react'
import type { AttendanceStatus, Group, Student } from '../../domain/types'
import { colombiaToday, saveGroupAttendance, useGroupAttendance, useGroups, useStudents } from './_pending'
import { Button, Card, Dialog } from './_pendingUi'
import { useAction } from './useAction'
import { validDay } from './formValues'
import { Choice, SessionDate } from './common'

type Marks = Record<string, AttendanceStatus>
const statuses: { id: AttendanceStatus; label: string }[] = [{ id: 'vino', label: 'Vino' }, { id: 'no_vino', label: 'No vino' }, { id: 'retirado', label: 'Retirado' }]
export function Attendance({ schoolId }: { schoolId: string }) {
  const { groups, loading, error } = useGroups(schoolId, { mine: true })
  const { students, loading: loadingStudents, error: studentError } = useStudents(schoolId)
  const today = colombiaToday()
  const [date, setDate] = useState(today)
  const [id, setId] = useState('')
  const [saving, setSaving] = useState(false)
  const [drafts, setDrafts] = useState<Record<string, Marks>>({})
  const group = groups.find(g => g.id === id)
  const key = JSON.stringify([id, date])
  if (error || studentError) return <p role="alert">{error || studentError}</p>
  return <>
    <fieldset disabled={saving} className="collect-fields">
      <Choice label="Grupo" placeholder="Selecciona un grupo" options={groups} value={group?.id ?? ''} onChange={setId} />
      <SessionDate {...{ date, today, setDate }} />
    </fieldset>
    {loading || loadingStudents ? <p>Cargando lista…</p> : !validDay(date, today) ? <p>Selecciona una fecha entre el primero de enero y hoy.</p> : group ?
      <AttendanceSheet key={key} {...{ date, group, students, setSaving }} draft={drafts[key] ?? {}} setDraft={v => setDrafts(prev => ({ ...prev, [key]: v }))} /> :
      <p>{groups.length ? 'Selecciona el grupo para tomar asistencia.' : 'Aún no tienes grupos asignados.'}</p>}</>
}
function AttendanceSheet({ date, group, students, draft, setDraft, setSaving }: { date: string; group: Group; students: Student[]; draft: Marks; setDraft: (v: Marks) => void; setSaving: (v: boolean) => void }) {
  const saved = useGroupAttendance(group.id, date)
  const action = useAction()
  // Keep the local receipt visible until the live subscription publishes its next snapshot.
  const [receipt, setReceipt] = useState<{ snapshot: Marks; marks: Marks } | null>(null)
  const baseline = receipt?.snapshot === saved ? { ...saved, ...receipt.marks } : saved
  const [confirm, setConfirm] = useState<Student | null>(null)
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
  return <Card>
    <div className="collect-heading">
      <h3>{group.name}</h3>
      <strong>Asistió el {percent} %</strong>
    </div>
    {members.size !== roster.length && <p role="alert">Faltan integrantes del grupo por cargar.</p>}
    {!members.size && <p>El grupo aún no tiene integrantes.</p>}
    {roster.map(s => <div className="collect-row" key={s.id}>
      <div>
        <strong>{s.fullName}</strong>
        <small>{s.code} · Grado {s.grade}°</small>
      </div>
      <div className="collect-actions" role="group" aria-label={'Asistencia de ' + s.fullName}>{statuses.map(({ id, label }) =>
        <Button key={id} aria-pressed={status(s.id) === id} disabled={action.busy} onClick={() => id === 'retirado' && status(s.id) !== id ? setConfirm(s) : mark(s.id, id)}>{label}</Button>)}</div>
    </div>)}
    <p>{missing ? 'Por marcar: ' + missing : roster.length > 0 ? 'Lista completa' : ''}</p>
    <Button variant="primary" loading={action.busy} disabled={!complete || !Object.keys(changes).length} onClick={() => action.run(async () => {
      setSaving(true)
      try {
        const receipt = await saveGroupAttendance(group.id, date, changes)
        if (receipt.groupId !== group.id || receipt.date !== date || receipt.saved !== Object.keys(changes).length) {
          throw new Error('No se pudo confirmar el guardado de toda la asistencia.')
        }
        setReceipt({ snapshot: saved, marks: { ...baseline, ...changes } })
        setDraft({})
        return receipt
      } finally { setSaving(false) }
    }, 'Asistencia guardada')}>Guardar asistencia</Button>{action.feedback}
    {confirm && <Dialog title="¿Marcar como retirado?" onClose={() => setConfirm(null)}>
      <p>Al guardar, {confirm.fullName} quedará retirado del programa.</p>
      <Button variant="danger" onClick={() => {
        mark(confirm.id, 'retirado')
        setConfirm(null)
      }}>Confirmar retiro</Button>
    </Dialog>}</Card>
}
