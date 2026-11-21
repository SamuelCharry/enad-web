import { Button } from '../../../ui/components'
import { LoadError } from '../../../ui/LoadError'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useImportHistory, useUsers, type ImportReceipt } from '../../../data/admin'
import { getDataQuality } from '../../../data/reports'
import type { QualityIssue } from '../../../data/quality'
import { ReportRead } from '../../reports/ReportState'
import { savedTime } from '../../reports/navigation'
import { Choice } from '../common'
import { Directory } from './Directory'

export function DataQuality() {
  return <ReportRead query="calidad" load={getDataQuality}>{issues=><QualityList issues={issues}/>}</ReportRead>
}
function QualityList({issues}:{issues:QualityIssue[]}) {
  const [kind,setKind]=useState('')
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
  const [previous,setPrevious] = useState<ImportReceipt[]>([])
  const history = useImportHistory(previous.at(-1)), users = useUsers()
  const records = [...new Map([...previous,...history.data.slice(0,20)].map(r=>[r.id,r])).values()]
  if (history.error || users.error) return <LoadError message={history.error || users.error} />
  const authors = new Map(users.users.map(u => [u.uid, u.fullName]))
  const labels: Record<string, string> = { schools: 'Instituciones', teachers: 'Docentes', students: 'Estudiantes', groups: 'Grupos', evaluations: 'Evaluaciones' }
  if (!history.loading && !records.length) return <p>El historial se llena al importar un archivo desde los directorios de Carga de datos.</p>
  return <><Directory title="Importaciones registradas" loading={history.loading || users.loading} headers={['Fecha', 'Tipo', 'Responsable', 'Filas', 'Guardadas', 'Errores']}
    rows={records.map(r => {
      const author = authors.get(r.by) || r.by, kind = labels[r.kind] || r.kind
      return { id: r.id, search: [r.at, kind, author].join(' '), cells: [savedTime(r.at), kind, author, r.rows, r.created, r.errors] }
    })} />{history.data.length > 20 && <Button onClick={() => setPrevious(records)}>Cargar importaciones anteriores</Button>}</>
}
