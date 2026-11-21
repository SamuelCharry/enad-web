import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useImportHistory, useUsers } from '../../../data/admin'
import { useSchools } from '../../../data/scope'
import { useGroups } from '../../../data/groups'
import { useStudents } from '../../../data/students'
import { qualityIssues } from '../../../data/quality'
import { savedTime } from '../../reports/navigation'
import { Choice } from '../common'
import { Directory } from './Directory'

export function DataQuality() {
  const students = useStudents(''), groups = useGroups(), users = useUsers(), schools = useSchools()
  const [kind, setKind] = useState('')
  const error = students.error || groups.error || users.error || schools.error
  if (error) return <p role="alert">{error}</p>
  if (students.loading || groups.loading || users.loading || schools.loading) return <p role="status">Revisando los directorios…</p>
  const issues = qualityIssues(students.students, groups.groups, users.users, schools.schools)
  if (!issues.length) return <p>No hay registros por corregir. Después de una importación puedes volver a revisar los directorios aquí.</p>
  const kinds = [...new Set(issues.map(i => i.kind))]
  const visible = issues.filter(i => !kind || i.kind === kind)
  return <><Choice label="Hallazgo" placeholder="Todos los hallazgos" value={kind} onChange={setKind} options={kinds.map(id => ({ id, name: id }))} />
    <Directory key={kind} title="Registros para revisión" headers={['Hallazgo', 'Registro', 'Detalle']} rows={visible.map(i => ({
      id: i.key,
      search: [i.kind, i.record, i.detail].join(' '), cells: [i.kind, i.directory ? <Link to={'/recoleccion/' + i.directory + '?' + new URLSearchParams(i.studentId && i.schoolId ? { schoolId: i.schoolId, student: i.studentId } : { buscar: i.search })}>{i.record}</Link> : i.record, i.detail]
    }))} /></>
}
export function ImportHistory() {
  const history = useImportHistory(), users = useUsers()
  if (history.error || users.error) return <p role="alert">{history.error || users.error}</p>
  const authors = new Map(users.users.map(u => [u.uid, u.fullName]))
  const labels: Record<string, string> = { schools: 'Instituciones', teachers: 'Docentes', students: 'Estudiantes', groups: 'Grupos', evaluations: 'Evaluaciones' }
  if (!history.loading && !history.data.length) return <p>El historial se llena al importar un archivo desde los directorios de Carga de datos.</p>
  return <Directory title="Importaciones registradas" loading={history.loading || users.loading} headers={['Fecha', 'Tipo', 'Responsable', 'Filas', 'Guardadas', 'Errores']}
    rows={history.data.map(r => {
      const author = authors.get(r.by) || r.by, kind = labels[r.kind] || r.kind
      return { id: r.id, search: [r.at, kind, author].join(' '), cells: [savedTime(r.at), kind, author, r.rows, r.created, r.errors] }
    })} />
}
