import { Choice } from '../common'
import { useState } from 'react'
import type { Group, Student } from '../../../domain/types'
import { moveMembers, useGroups, addStudentsToGroup, removeStudentFromGroup } from '../../../data/groups'
import { Button } from '../../../ui/components'
import { Directory } from './Directory'
import { useAction } from '../useAction'

export function GroupMembers({ group, students }: { group: Group; students: Student[] }) {
  const action = useAction()
  const [membersOnly, setMembersOnly] = useState(group.studentIds.length > 0)
  const [undo,setUndo] = useState<()=>Promise<void>>()
  const teams = useGroups(group.schoolId)
  const [selected,setSelected] = useState<string[]>([]), [into,setInto] = useState('')
  const destinations = teams.groups.filter(g => g.id !== group.id && g.subject === group.subject)
  const members = new Set(group.studentIds)
  const roster = students.filter(s => s.schoolId === group.schoolId && (members.has(s.id) || (!membersOnly && !s.retired && s.active !== false)))
  return <section><h4>Integrantes de {group.name}</h4>
    <label><input type="checkbox" checked={membersOnly} onChange={e => setMembersOnly(e.target.checked)} /> Solo integrantes actuales</label>
    {!roster.length ? <p>{membersOnly ? 'Desmarca «Solo integrantes actuales» para buscar estudiantes de la institución.' : 'Añade un estudiante a la institución para incluirlo en este grupo.'}</p> :
      <Directory showExport={false} title="Asignación al grupo" headers={['Estudiante', 'Código', 'Pertenencia']} rows={roster.map(s => {
        const member = members.has(s.id)
        return {
          id: s.id, search: s.fullName + ' ' + s.code, cells: [member ? <label key="select"><input type="checkbox" aria-label={'Seleccionar a '+s.fullName+' para mover'} checked={selected.includes(s.id)} onChange={e => setSelected(e.target.checked ? [...selected,s.id] : selected.filter(id => id !== s.id))}/>{s.fullName}</label> : s.fullName, <span key="code">{s.code}{teams.groups.filter(g => g.subject === group.subject && g.studentIds.includes(s.id)).length > 1 && <small> · Pertenece a varios grupos de esta área</small>}</span>,
          <Button key="pertenencia" disabled={action.busy} onClick={() => {
            if (member && !window.confirm('¿Quitar a ' + s.fullName + ' del grupo ' + group.name + '?')) return
            void action.run(() => member ? removeStudentFromGroup(group.id, s.id) : addStudentsToGroup(group.id, [s.id]),
              member ? 'Estudiante retirado del grupo.' : 'Estudiante añadido al grupo.')
          }}>{member ? 'Quitar del grupo' : 'Añadir al grupo'}</Button>]
        }
      })} />}
    {teams.error && <p role="alert">{teams.error}</p>}
    <Choice label="Mover a…" options={destinations} placeholder="Selecciona el grupo" value={into} onChange={setInto}/>
      <Button disabled={!selected.length || !into || action.busy} onClick={() => {
        if (window.confirm('¿Mover '+selected.length+(selected.length === 1 ? ' estudiante a ' : ' estudiantes a ')+destinations.find(g => g.id === into)?.name+'?'))
          void action.run(async () => { const revert = await moveMembers(group.id,into,selected); setUndo(() => revert); setSelected([]) },'')
      }}>Mover estudiantes</Button>
    {undo && <div className="ui-toast"><span role="status">Estudiantes trasladados.</span><Button disabled={action.busy} onClick={() => action.run(async () => {
      await undo(); setUndo(undefined)
    },'Traslado deshecho.')}>Deshacer traslado</Button></div>}{action.feedback}
  </section>
}
