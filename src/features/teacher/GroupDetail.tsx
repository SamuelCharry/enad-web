import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import type { Group, Student } from '../../domain/types'
import { addStudentsToGroup, deleteGroup, patchGroup, removeStudentFromGroup } from '../../data/groups'
import { subjectLabel } from '../../domain/levels'
import { Button, Card, Dialog, Field, LevelChip, SyncStatus, TextInput } from '../../ui/components'
import { Search } from '../collect/common'
import { matches } from '../collect/formValues'
import { useAction } from '../collect/useAction'
import { collectLink, groupLink } from './navigation'

export function GroupDetail({ group, students, owner }: { group: Group; students: Student[]; owner: boolean }) {
  const navigate = useNavigate()
  const [dialog, setDialog] = useState<'rename' | 'add' | 'delete' | null>(null)
  const [remove, setRemove] = useState<Student>()
  const [undo, setUndo] = useState<Student>()
  const [name, setName] = useState(group.name)
  const [search, setSearch] = useState('')
  const action = useAction()
  const members = new Set(group.studentIds)
  const available = students.filter(s => !members.has(s.id) && s.active && !s.retired && (!group.campus || s.campus === group.campus) && matches(search, s.fullName, s.code))
  const back = collectLink('grupos', { school: group.schoolId, campus: group.campus })
  return <><Link className="ui-link-button" to={back}>Volver a grupos</Link>
    <Card><h3>{group.name}</h3>{'syncState' in group && <SyncStatus pending={group.syncState === 'pending'} />}<p>{subjectLabel(group.subject)} · {group.teacherName}{!owner && ' · Solo lectura'}</p>
      {owner && <div className="teacher-tools"><Link className="ui-link-button primary" to={groupLink('asistencia', group)}>Tomar asistencia</Link>
        <Link className="ui-link-button" to={groupLink('evaluacion', group)}>Evaluar grupo</Link>
        <Button onClick={() => { setName(group.name); setDialog('rename') }}>Cambiar nombre</Button></div>}</Card>
    <Card><h3>Integrantes</h3>{!members.size && <p>{owner ? 'Añade estudiantes de esta sede para comenzar.' : 'El docente aún debe añadir integrantes.'}</p>}
      {students.filter(s => members.has(s.id)).map(s => <div className="teacher-member" key={s.id}>
        <Link className="teacher-group-link" to={collectLink('estudiantes', { school: s.schoolId, campus: s.campus, student: s.id })}>{s.fullName}</Link>
        <p>Grado {s.grade}° · <LevelChip subject={group.subject} level={s.levels[group.subject]?.level} />{s.retired && ' · Retirado'}</p>
        {owner && <div className="teacher-tools">{!s.retired && <Link className="ui-link-button" to={groupLink('evaluacion', group, { student: s.id })}>Evaluar a {s.fullName}</Link>}
          <Button onClick={() => setRemove(s)}>Quitar del grupo</Button></div>}</div>)}
      {owner && <Button onClick={() => { setSearch(''); setDialog('add') }}>Añadir al grupo</Button>}
      {undo && !members.has(undo.id) && <p>Se quitó a {undo.fullName}. <Button loading={action.busy} onClick={() => action.run(async () => {
        await addStudentsToGroup(group.id, [undo.id]); setUndo(undefined)
      }, '')}>Deshacer</Button></p>}</Card>
    {owner && <Button variant="danger" onClick={() => setDialog('delete')}>Eliminar grupo</Button>}
    {!dialog && !remove && action.feedback}
    {(dialog || remove) && owner && <Dialog busy={action.busy} title={remove ? '¿Quitar a ' + remove.fullName + ' del grupo?' :
      dialog === 'delete' ? '¿Eliminar ' + group.name + '?' : dialog === 'rename' ? 'Cambiar nombre' : 'Añadir al grupo'} onClose={() => { setDialog(null); setRemove(undefined) }}>
      <fieldset disabled={action.busy}>
        {remove ? <Button variant="danger" onClick={() => action.run(async () => {
          await removeStudentFromGroup(group.id, remove.id); setUndo(remove); setRemove(undefined)
        }, '')}>Confirmar retiro del grupo</Button> : dialog === 'delete' ? <><p>Los estudiantes conservarán sus registros.</p>
          <Button variant="danger" onClick={() => action.run(async () => { await deleteGroup(group.id); navigate(back, { replace: true }) })}>Confirmar eliminación</Button></> :
          dialog === 'rename' ? <form onSubmit={e => { e.preventDefault(); void action.run(async () => {
            await patchGroup(group.id, { name: name.trim() }); setDialog(null)
          }, '') }}><Field label="Nombre del grupo"><TextInput value={name} required onChange={e => setName(e.target.value)} /></Field>
            <Button type="submit" variant="primary" disabled={!name.trim() || name.trim() === group.name}>Guardar nombre</Button></form> :
            <><Search value={search} onChange={setSearch} />{available.length ? available.map(s => <div className="collect-row" key={s.id}>{s.fullName}
              <Button aria-label={'Añadir a ' + s.fullName} onClick={() => action.run(async () => {
                await addStudentsToGroup(group.id, [s.id]); setDialog(null)
              }, '')}>Añadir</Button></div>) : <p>Revisa la búsqueda o registra un estudiante en esta sede.</p>}</>}
      </fieldset>{action.feedback}</Dialog>}
  </>
}
