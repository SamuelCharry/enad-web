import { useState } from 'react'
import type { Group, School, Student, Subject, UserProfile } from '../../../domain/types'
import { useGroups, createGroup, patchGroup, deleteGroup } from '../../../data/groups'
import { useStudents, createStudent } from '../../../data/students'
import { saveStudentAssignment } from '../../../data/adminStudent'
import { useUsers } from '../../../data/admin'
import { useSchools } from '../../../data/scope'
import { campusId } from '../../../data/activity'
import { subjectLabel } from '../../../domain/levels'
import { Field, Button, TextInput } from '../../../ui/components'
import { Choice, SubjectField } from '../common'
import { genders, numbers } from '../formValues'
import { useAction } from '../useAction'
import { Directory } from './Directory'
import { GroupMembers } from './GroupMembers'
import { savedNotice } from './notice'

type Close = (message?: string) => void
export function Rosters({ kind }: { kind: 'estudiantes' | 'grupos' }) {
  const directory = useSchools()
  const [selected, setSchool] = useState('')
  const selection = directory.schools.find(s => s.id === selected)
  if (directory.error) return <p role="alert">{directory.error}</p>
  if (directory.loading) return <p role="status">Cargando instituciones…</p>
  if (!directory.schools.length) return <p>Crea primero una institución en Instituciones y sedes.</p>
  return <><Choice label="Filtrar institución" value={selection?.id || ''} placeholder="Todas las instituciones" options={directory.schools} onChange={setSchool} />
    <Records key={kind + (selection?.id ?? '')} kind={kind} schools={directory.schools} schoolId={selection?.id} /></>
}
function Records({ kind, schools, schoolId }: { kind: 'estudiantes' | 'grupos'; schools: School[]; schoolId?: string }) {
  const roster = useStudents(schoolId ?? ''), teams = useGroups(schoolId), staff = useUsers('docente')
  const error = roster.error || teams.error || staff.error
  const loading = roster.loading || teams.loading || staff.loading
  if (error) return <p role="alert">{error}</p>
  const schoolById = new Map(schools.map(s => [s.id, s]))
  const options = schoolId ? schools.filter(s => s.id === schoolId) : schools
  const place = (v: { schoolId: string; campus: string }) => {
    const s = schoolById.get(v.schoolId)
    return [s?.name || v.schoolId, s?.campuses.find(c => c.id === v.campus || c.name === v.campus)?.name || v.campus || 'Sin sede'].join(' · ')
  }
  if (kind === 'grupos') return <Directory title="Grupos" headers={['Grupo', 'Institución y sede', 'Docente', 'Estudiantes']} create="Crear grupo" loading={loading}
    rows={teams.groups.map(g => ({ id: g.id, search: [g.name, g.teacherName, place(g), subjectLabel(g.subject)].join(' '), cells: [g.name, place(g), g.teacherName || 'Sin asignar', g.studentIds.length] }))}
    editor={(id, close) => {
      const group = teams.groups.find(g => g.id === id)
      return <><GroupForm key={id} group={group} schools={options} users={staff.users} close={close} />
        {group && <GroupMembers group={group} students={roster.students} />}</>
    }} />
  return <Directory title="Estudiantes" headers={['Estudiante', 'Código', 'Institución y sede', 'Estado']} create="Añadir estudiante" loading={loading}
    rows={roster.students.map(s => ({ id: s.id, search: [s.fullName, s.code, s.grade, place(s)].join(' '), cells: [s.fullName, s.code, place(s), s.retired ? 'Retirado' : s.active === false ? 'Inactivo' : 'Activo'] }))}
    editor={(id, close) => <StudentForm key={id} student={roster.students.find(s => s.id === id)} groups={teams.groups} schools={options} close={close} />} />
}
function StudentForm({ student, groups, schools, close }: { student?: Student; groups: Group[]; schools: School[]; close: Close }) {
  const [initial] = useState(student)
  const [before] = useState(() => groups.filter(g => initial && g.studentIds.includes(initial.id)).map(g => g.id))
  const [selected, setSelected] = useState(before)
  const [schoolId, setSchool] = useState(initial?.schoolId ?? schools[0].id)
  const school = schools.find(s => s.id === schoolId)!
  const [site, setSite] = useState(initial ? campusId(school, initial.campus) : '')
  const [name, setName] = useState(initial?.fullName ?? ''), [code, setCode] = useState(initial?.code ?? '')
  const [grade, setGrade] = useState(String(initial?.grade ?? '')), [gender, setGender] = useState(initial?.gender ?? '')
  const [age, setAge] = useState(String(initial?.age ?? '')), [sample, setSample] = useState(String(initial?.sample ?? ''))
  const [retired, setRetired] = useState(initial?.retired ?? false)
  const action = useAction()
  const local = groups.filter(g => g.schoolId === schoolId && campusId(school, g.campus) === site)
  return <form onSubmit={e => {
    e.preventDefault()
    const changed = initial && (retired !== initial.retired || site !== campusId(school, initial.campus) || before.some(id => !selected.includes(id)))
    if (changed && !window.confirm('¿Guardar los cambios de ' + name + '? Sede: ' + (school.campuses.find(c => c.id === site)?.name || 'Sin asignar') + '. Estado: ' + (retired ? 'retirado' : 'activo') + '. Grupos: ' + (groups.filter(g => selected.includes(g.id)).map(g => g.name).join(', ') || 'ninguno') + '.')) return
    void action.run(async () => {
      if (!initial && !/[a-z0-9]/i.test(code)) throw new Error('El código debe incluir al menos una letra o un número.')
      const fields = { fullName: name, campus: site, grade: Number(grade), gender, age: age ? Number(age) : null }
      const result = initial ? await saveStudentAssignment(initial, { ...fields, sample: sample ? Number(sample) : null, retired }, before, selected)
        : await createStudent({ ...fields, code, schoolId })
      close(savedNotice(result))
    })
  }}><fieldset disabled={action.busy}><legend>{initial ? 'Editar estudiante' : 'Añadir estudiante'}</legend>
      <div className="collect-fields"><Field label="Nombre completo"><TextInput required value={name} onChange={e => setName(e.target.value)} /></Field>
        <Field label="Código"><TextInput required disabled={!!initial} value={code} onChange={e => setCode(e.target.value)} /></Field>
        <Choice label="Institución" disabled={!!initial} value={schoolId} options={schools} onChange={id => { setSchool(id); setSite('') }} />
        <Choice label="Sede" value={site} placeholder="Sin asignar" options={school.campuses} onChange={id => { setSite(id); setSelected(selected.filter(k => groups.some(g => g.id === k && campusId(school, g.campus) === id))) }} />
        <Choice label="Grado" required value={grade} placeholder="Selecciona el grado" options={numbers(3, 5)} onChange={setGrade} />
        <Choice label="Sexo" value={gender} placeholder="Sin registrar" options={genders} onChange={setGender} />
        <Choice label="Edad" value={age} placeholder="Sin registrar" options={numbers(5, 18)} onChange={setAge} />
        {initial && <Choice label="Muestra" value={sample} placeholder="Sin asignar" options={numbers(1, 4)} onChange={setSample} />}</div>
      {initial && <><label><input type="checkbox" checked={retired} onChange={e => setRetired(e.target.checked)} /> Estudiante retirado</label>
        <fieldset><legend>Grupos de la sede</legend>{local.map(g => <label key={g.id}><input type="checkbox" checked={selected.includes(g.id)} onChange={e => setSelected(e.target.checked ? [...selected, g.id] : selected.filter(id => id !== g.id))} /> {g.name} · {subjectLabel(g.subject)}</label>)}
          {!local.length && <p>Crea un grupo en esta sede para asignarlo.</p>}</fieldset></>}
      <div className="admin-save"><Button onClick={() => close()}>Cancelar</Button><Button type="submit" variant="primary">Guardar estudiante</Button></div></fieldset>{action.feedback}</form>
}
function GroupForm({ group, schools, users, close }: { group?: Group; schools: School[]; users: UserProfile[]; close: Close }) {
  const [schoolId, setSchool] = useState(group?.schoolId ?? schools[0].id), school = schools.find(s => s.id === schoolId)!
  const [name, setName] = useState(group?.name ?? ''), [teacher, setTeacher] = useState(group?.teacherId ?? '')
  const [campus, setCampus] = useState(group?.campus ?? ''), [subject, setSubject] = useState<Subject>(group?.subject ?? 'lectura')
  const action = useAction()
  const options = users.filter(u => u.activo && u.schoolIds?.includes(schoolId)).map(u => ({ id: u.uid, name: u.fullName }))
  return <form onSubmit={e => {
    e.preventDefault()
    if (group && teacher !== group.teacherId && !window.confirm('¿Reasignar ' + group.name + ' a ' + options.find(t => t.id === teacher)?.name + '?')) return
    void action.run(async () => {
      if (!options.some(t => t.id === teacher)) throw new Error('Selecciona un docente activo de la institución.')
      const changes = { name, teacherId: teacher }
      const result = group ? await patchGroup(group.id, changes) : await createGroup({ ...changes, schoolId, campus, subject })
      close(savedNotice(result))
    })
  }}><fieldset disabled={action.busy}><legend>{group ? 'Editar grupo' : 'Crear grupo'}</legend>
      <div className="collect-fields"><Field label="Nombre del grupo"><TextInput value={name} required onChange={e => setName(e.target.value)} /></Field>
        <Choice label="Institución" value={schoolId} disabled={!!group} options={schools} onChange={id => { setSchool(id); setCampus(''); setTeacher('') }} />
        <Choice label="Sede" disabled={!!group} value={campus} placeholder="Sin asignar" options={school.campuses} onChange={setCampus} />
        <SubjectField value={subject} disabled={!!group} onChange={setSubject} />
        <Choice label="Docente" value={teacher} required placeholder="Selecciona un docente activo" options={options} onChange={setTeacher} /></div>
      {!options.length && <p>Asigna un docente activo a esta institución en el directorio de docentes.</p>}
      <div className="admin-save"><Button onClick={() => close()}>Cancelar</Button><Button type="submit" variant="primary">Guardar grupo</Button>
        {group && <Button variant="danger" onClick={() => {
          if (window.confirm('¿Eliminar el grupo ' + group.name + '? Se conservarán los registros históricos.')) void action.run(async () => { const result = await deleteGroup(group.id); close(savedNotice(result)) })
        }}>Eliminar grupo</Button>}</div></fieldset>{action.feedback}</form>
}
