import { LoadError } from '../../ui/LoadError'
import { Link, useNavigate } from 'react-router-dom'
import { GroupDetail } from '../teacher/GroupDetail'
import { groupLink } from '../teacher/navigation'
import { useState } from 'react'
import type { Group, Moment, Student, Subject, UserProfile } from '../../domain/types'
import { useUsers } from '../../data/admin'
import { addStudentsToGroup, createGroup, deleteGroup, patchGroup, removeStudentFromGroup, useGroups } from '../../data/groups'
import { useStudents } from '../../data/students'
import { suggestGroups } from '../../domain/groupSuggester'
import { subjectLabel } from '../../domain/levels'
import { Button, Card, Dialog, Field, NumberInput, TextInput } from '../../ui/components'
import { useAction } from './useAction'
import { matches } from './formValues'
import { Choice, MomentField, Search, SubjectField } from './common'

type Proposal = ReturnType<typeof suggestGroups>[number]
type Site = { schoolId: string; campus: string }
export function Groups({ schoolId, campus, profile, initialGroup, campuses = [] }: Site & { campuses?: { id: string; name: string }[]; initialGroup?: string; profile: UserProfile }) {
  const navigate = useNavigate()
  const { groups, loading, error } = useGroups(schoolId)
  const { students, loading: loadingStudents, error: studentError } = useStudents(schoolId)
  const [search, setSearch] = useState('')
  const [edit, setEdit] = useState<string | null>(null)
  const [suggest, setSuggest] = useState(false)
  const admin = profile.rol === 'admin'
  const [area, setArea] = useState<Subject | ''>('')
  const [selectedCampus, setSelectedCampus] = useState('')
  const actionCampus = campus || selectedCampus || (campuses.length === 1 ? campuses[0].id : '')
  const chooseCampus = !admin && !actionCampus && campuses.length > 1
  const allSites = !admin && !campus
  const roster = students.filter(s => s.schoolId === schoolId && (allSites || s.campus === campus) && s.active && !s.retired)
  const directory = groups.filter(g => g.schoolId === schoolId && (allSites || g.campus === campus) && (!area || g.subject === area) && matches(search, g.name, g.teacherName, subjectLabel(g.subject)))
  const assigned = new Set(groups.filter(g => g.subject === area).flatMap(g => g.studentIds))
  const unassigned = roster.filter(s => !assigned.has(s.id)).length
  const group = groups.find(g => g.id === edit)
  const eligible = new Set(roster.map(s => s.id))
  const members = new Set(group?.studentIds)
  const editorRoster = students.filter(s => s.schoolId === schoolId && (eligible.has(s.id) || members.has(s.id)))
  if (error || studentError) return <LoadError message={error || studentError} />
  const detail = !admin && groups.find(g => g.id === initialGroup && (allSites || g.campus === campus))
  if (initialGroup && !admin) {
    if (loading || loadingStudents) return <p role="status">Cargando grupo…</p>
    return detail ? <GroupDetail group={detail} students={students} owner={detail.teacherId === profile.uid} /> :
      <p>El grupo ya no está disponible en esta sede. <Link to="/recoleccion/grupos">Ver los grupos</Link></p>
  }
  return <>
    <div className="collect-toolbar">
      {!admin && <Choice label="Área" value={area} placeholder="Todas las áreas" options={(['lectura','matematicas'] as const).map(id => ({ id, name: subjectLabel(id) }))} onChange={setArea} />}
      <Search value={search} onChange={setSearch} />
      <Button variant="primary" onClick={() => setEdit('')}>Crear grupo</Button>
      {!admin && <Button disabled={loadingStudents} onClick={() => setSuggest(true)}>Sugerir grupos</Button>}</div>
    {loading ? <p>Cargando grupos…</p> : !directory.length ? <p>Cambia la búsqueda o crea un grupo en esta sede.</p> : directory.map(g =>
      <Card key={g.id}>
        <div className="collect-row">
          <div>
            <h3>{admin ? g.name : <Link to={groupLink('grupos', g)}>{g.name}</Link>}</h3>
            <small>{subjectLabel(g.subject)} · {g.teacherName} · {g.studentIds.length} integrantes</small>
          </div>
          {admin && <Button onClick={() => setEdit(g.id)}>Administrar grupo</Button>}</div>
      </Card>)}
    {area && !loading && !loadingStudents && <p>{unassigned} estudiantes sin grupo de {subjectLabel(area)} en esta selección</p>}
    {(suggest || edit === '') && chooseCampus && <Dialog title="Selecciona una sede" onClose={() => { setEdit(null); setSuggest(false) }}>
      {campuses.map(c => <Button key={c.id} onClick={() => setSelectedCampus(c.id)}>{c.name}</Button>)}</Dialog>}
    {edit !== null && !chooseCampus && (!edit || (group && (admin || group.teacherId === profile.uid))) &&
      <GroupEditor {...{ group, schoolId, admin }} campus={actionCampus} initialSubject={area || 'lectura'}
        onCreated={admin ? undefined : g => navigate(groupLink('grupos',g))} roster={editorRoster}
        onClose={() => { setEdit(null); setSelectedCampus('') }} />}
    {suggest && !chooseCampus && <Suggestions schoolId={schoolId} campus={actionCampus} initialSubject={area || 'lectura'}
      roster={roster.filter(s => s.campus === actionCampus)} onClose={() => { setSuggest(false); setSelectedCampus('') }} />}</>
}

function TeacherPicker({ schoolId, value, onChange }: { schoolId: string; value: string; onChange: (v: string) => void }) {
  const { users } = useUsers('docente')
  return <Choice label="Docente" required placeholder="Selecciona el docente" value={value}
    options={users.filter(u => u.uid === value || (u.activo && u.schoolIds.includes(schoolId))).map(u => ({ id: u.uid, name: u.fullName }))} onChange={onChange} />
}
function GroupEditor({ group, schoolId, campus, admin, roster, onClose, initialSubject, onCreated }: Site & { initialSubject: Subject; onCreated?: (group: Group) => void; group?: Group; admin: boolean; roster: Student[]; onClose: () => void }) {
  const [name, setName] = useState(group?.name ?? '')
  const [subject, setSubject] = useState<Subject>(group?.subject ?? initialSubject)
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
          else {
            const created = await createGroup({ ...fields, subject, schoolId, campus })
            onCreated?.(created)
          }
          onClose()
        })
      }}>
        <Field label="Nombre del grupo">
          <TextInput required value={name} onChange={e => setName(e.target.value)} />
        </Field>
        <SubjectField value={subject} onChange={setSubject} disabled={!!group} />
        {admin && <TeacherPicker {...{ schoolId }} value={teacherId} onChange={setTeacher} />}
        <Button variant="primary" type="submit" disabled={!name.trim() || (admin && !teacherId)}>Guardar grupo</Button>
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

function Suggestions({ schoolId, campus, roster, initialSubject, onClose }: Site & { initialSubject: Subject; roster: Student[]; onClose: () => void }) {
  const [subject, setSubject] = useState<Subject>(initialSubject)
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
        }}>{proposalName(p, i)} · {p.studentIds.length} estudiantes</Button>)}</> : <p>Evalúa estudiantes de esta sede en el área y momento elegidos para generar una propuesta.</p>)}
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
