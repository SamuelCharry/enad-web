import { useState } from 'react'
import type { Group, Moment, Student, Subject, UserProfile } from '../../domain/types'
import { addStudentsToGroup, createGroup, deleteGroup, patchGroup, removeStudentFromGroup, subjectLabel, suggestGroups, useGroups, useStudents, useUsers } from './_pending'
import { Button, Card, Dialog, Field, NumberInput, TextInput } from './_pendingUi'
import { useAction } from './useAction'
import { matches } from './formValues'
import { Choice, MomentField, Search, SubjectField } from './common'

type Proposal = ReturnType<typeof suggestGroups>[number]
type Site = { schoolId: string; campus: string }
export function Groups({ schoolId, campus, profile }: Site & { profile: UserProfile }) {
  const { groups, loading, error } = useGroups(schoolId)
  const { students, loading: loadingStudents, error: studentError } = useStudents(schoolId)
  const [search, setSearch] = useState('')
  const [edit, setEdit] = useState<string | null>(null)
  const [suggest, setSuggest] = useState(false)
  const admin = profile.rol === 'admin'
  const roster = students.filter(s => s.schoolId === schoolId && s.campus === campus && s.active && !s.retired)
  const directory = groups.filter(g => g.schoolId === schoolId && g.campus === campus && matches(search, g.name, g.teacherName, subjectLabel(g.subject)))
  const group = groups.find(g => g.id === edit)
  const eligible = new Set(roster.map(s => s.id))
  const members = new Set(group?.studentIds)
  const editorRoster = students.filter(s => s.schoolId === schoolId && (eligible.has(s.id) || members.has(s.id)))
  if (error || studentError) return <p role="alert">{error || studentError}</p>
  return <>
    <div className="collect-toolbar">
      <Search value={search} onChange={setSearch} />
      <Button variant="primary" onClick={() => setEdit('')}>Crear grupo</Button>
      {!admin && <Button onClick={() => setSuggest(true)}>Sugerir grupos</Button>}</div>
    {loading ? <p>Cargando grupos…</p> : !directory.length ? <p>Sin grupos en esta selección.</p> : directory.map(g =>
      <Card key={g.id}>
        <div className="collect-row">
          <div>
            <h3>{g.name}</h3>
            <small>{subjectLabel(g.subject)} · {g.teacherName} · {g.studentIds.length} integrantes</small>
          </div>
          {(admin || profile.uid === g.teacherId) && <Button onClick={() => setEdit(g.id)}>Administrar grupo</Button>}</div>
      </Card>)}
    {edit !== null && (!edit || (group && (admin || group.teacherId === profile.uid))) && <GroupEditor {...{ group, schoolId, campus, admin }} roster={editorRoster} onClose={() => setEdit(null)} />}
    {suggest && !loadingStudents && <Suggestions {...{ schoolId, campus, roster }} onClose={() => setSuggest(false)} />}</>
}

function TeacherPicker({ schoolId, value, onChange }: { schoolId: string; value: string; onChange: (v: string) => void }) {
  const { users } = useUsers('docente')
  return <Choice label="Docente" required placeholder="Selecciona el docente" value={value}
    options={users.filter(u => u.uid === value || (u.activo && u.schoolIds.includes(schoolId))).map(u => ({ id: u.uid, name: u.fullName }))} onChange={onChange} />
}
function GroupEditor({ group, schoolId, campus, admin, roster, onClose }: Site & { group?: Group; admin: boolean; roster: Student[]; onClose: () => void }) {
  const [name, setName] = useState(group?.name ?? '')
  const [subject, setSubject] = useState<Subject>(group?.subject ?? 'lectura')
  const [teacherId, setTeacher] = useState(group?.teacherId ?? '')
  const [confirm, setConfirm] = useState(false)
  const [search, setSearch] = useState('')
  const action = useAction()
  return <Dialog title={group ? 'Administrar grupo' : 'Crear grupo'} onClose={onClose} busy={action.busy}>
    <fieldset disabled={action.busy}>
      <form onSubmit={e => {
        e.preventDefault()
        if (!name.trim() || (admin && !teacherId)) return
        void action.run(async () => {
          const fields = { name: name.trim(), ...(admin ? { teacherId } : {}) }
          if (group) await patchGroup(group.id, fields)
          else await createGroup({ ...fields, subject, schoolId, campus })
          onClose()
        })
      }}>
        <Field label="Nombre del grupo">
          <TextInput required value={name} onChange={e => setName(e.target.value)} />
        </Field>
        <SubjectField value={subject} onChange={setSubject} disabled={!!group} />
        {admin && <TeacherPicker {...{ schoolId }} value={teacherId} onChange={setTeacher} />}
        <Button variant="primary" type="submit">Guardar grupo</Button>
      </form>
      {group && <>
        <h3>Integrantes</h3>
        <Search value={search} onChange={setSearch} />
        {roster.filter(s => matches(search, s.fullName, s.code)).map(s => {
          const member = group.studentIds.includes(s.id)
          return <div className="collect-row" key={s.id}>
            <span>{s.fullName}</span>
            <Button aria-label={(member ? 'Quitar a ' : 'Añadir a ') + s.fullName} onClick={() => action.run(() => member ? removeStudentFromGroup(group.id, s.id) : addStudentsToGroup(group.id, [s.id]))}>{member ? 'Quitar' : 'Añadir'}</Button>
          </div>
        })}
        {confirm ? <div>
          <p>¿Eliminar el grupo «{group.name}»?</p>
          <Button onClick={() => setConfirm(false)}>Cancelar</Button>
          <Button variant="danger" onClick={() => action.run(async () => {
            await deleteGroup(group.id)
            onClose()
          })}>Confirmar eliminación</Button>
        </div> :
          <Button variant="danger" onClick={() => setConfirm(true)}>Eliminar grupo</Button>}</>}
    </fieldset>{action.feedback}</Dialog>
}

function Suggestions({ schoolId, campus, roster, onClose }: Site & { roster: Student[]; onClose: () => void }) {
  const [subject, setSubject] = useState<Subject>('lectura')
  const [moment, setMoment] = useState<Moment>('linea_base')
  const [count, setCount] = useState('1')
  const [preview, setPreview] = useState<Proposal[] | null>(null)
  const [selected, setSelected] = useState<number | null>(null)
  const [members, setMembers] = useState<string[]>([])
  const [name, setName] = useState('')
  const [created, setCreated] = useState<string | null>(null)
  const action = useAction()
  function reset() {
    setPreview(null)
    setSelected(null)
  }
  function proposalName(p: Proposal, i: number) { return 'Grupo ' + (i + 1) + ' · ' + p.levelLabels.join(' y ') }
  return <Dialog title="Sugerir grupos" {...{ onClose }} busy={action.busy}>
    <fieldset disabled={action.busy || !!created}>
      <SubjectField value={subject} onChange={s => {
        setSubject(s)
        reset()
      }} />
      <MomentField value={moment} onChange={m => {
        setMoment(m)
        reset()
      }} />
      <Field label="Número de docentes">
        <NumberInput min="1" step="1" value={count} onChange={e => {
          setCount(e.target.value)
          reset()
        }} />
      </Field>
      <Button disabled={!Number.isSafeInteger(+count) || +count < 1} onClick={() => {
        setSelected(null)
        setPreview(suggestGroups(roster, subject, moment, +count))
      }}>Ver propuesta</Button>
      {preview && (preview.length ? <>
        <p>Elige el grupo que vas a acompañar.</p>
        {preview.map((p, i) => <Button key={i} aria-pressed={selected === i} onClick={() => {
          setSelected(i)
          setMembers(p.studentIds)
          setName(proposalName(p, i))
        }}>{proposalName(p, i)} · {p.studentIds.length} estudiantes</Button>)}</> : <p>No hay estudiantes evaluados para esta selección.</p>)}
      {selected !== null && preview && <>
        <Field label="Nombre de mi grupo">
          <TextInput value={name} onChange={e => setName(e.target.value)} />
        </Field>
        {preview[selected].studentIds.map(id => <label key={id}>
          <input type="checkbox" checked={members.includes(id)} onChange={e => setMembers(e.target.checked ? [...members, id] : members.filter(v => v !== id))} />{roster.find(s => s.id === id)?.fullName ?? id}</label>)}</>}
    </fieldset>{selected !== null && <Button loading={action.busy} variant="primary" disabled={!name.trim() || !members.length} onClick={() => action.run(async () => {
      const id = created ?? (await createGroup({ schoolId, campus, subject, name: name.trim() })).id
      setCreated(id)
      await addStudentsToGroup(id, members)
      onClose()
    })}>{created ? 'Completar mi grupo' : 'Aceptar mi grupo'}</Button>}{action.feedback}</Dialog>
}
