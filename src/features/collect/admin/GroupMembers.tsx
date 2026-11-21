import { useState } from 'react'
import type { Group, Student } from '../../../domain/types'
import { addStudentsToGroup, removeStudentFromGroup } from '../../../data/groups'
import { Button } from '../../../ui/components'
import { Directory } from './Directory'
import { useAction } from '../useAction'

export function GroupMembers({ group, students }: { group: Group; students: Student[] }) {
  const action = useAction()
  const [membersOnly, setMembersOnly] = useState(true)
  const members = new Set(group.studentIds)
  const roster = students.filter(s => s.schoolId === group.schoolId && (members.has(s.id) || (!membersOnly && !s.retired && s.active !== false)))
  return <section><h4>Integrantes de {group.name}</h4>
    <label><input type="checkbox" checked={membersOnly} onChange={e => setMembersOnly(e.target.checked)} /> Solo integrantes actuales</label>
    {!roster.length ? <p>Desmarca «Solo integrantes actuales» para buscar estudiantes de la institución.</p> :
      <Directory title="Asignación al grupo" headers={['Estudiante', 'Código', 'Pertenencia']} rows={roster.map(s => {
        const member = members.has(s.id)
        return {
          id: s.id, search: s.fullName + ' ' + s.code, cells: [s.fullName, s.code,
          <Button key="pertenencia" disabled={action.busy} onClick={() => {
            if (member && !window.confirm('¿Quitar a ' + s.fullName + ' del grupo ' + group.name + '?')) return
            void action.run(() => member ? removeStudentFromGroup(group.id, s.id) : addStudentsToGroup(group.id, [s.id]),
              member ? 'Estudiante retirado del grupo.' : 'Estudiante añadido al grupo.')
          }}>{member ? 'Quitar del grupo' : 'Añadir al grupo'}</Button>]
        }
      })} />}
    {action.feedback}
  </section>
}
