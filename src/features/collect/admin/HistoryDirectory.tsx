import { useSearchParams } from 'react-router-dom'
import { useSchools } from '../../../data/scope'
import { Choice } from '../common'
import { History } from '../History'

export function HistoryDirectory() {
  const { schools, loading, error } = useSchools()
  const [params, set] = useSearchParams()
  if (error) return <p role="alert">{error}</p>
  if (loading) return <p role="status">Cargando instituciones…</p>
  const school = schools.find(s => s.id === params.get('schoolId')) ?? schools[0]
  if (!school) return <p>Crea una institución y registra sus estudiantes para cargar evaluaciones históricas.</p>
  return <><Choice label="Institución" value={school.id} options={schools} onChange={schoolId => set({ schoolId })} />
    <History key={school.id} schoolId={school.id} /></>
}
