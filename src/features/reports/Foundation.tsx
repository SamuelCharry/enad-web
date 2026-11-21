import { useEffect, useRef, useState } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import type { ReportFilters } from '../../domain/types'
import { buildExcelExport, getExport, useFilterOptions } from './_pending'
import { Button, DateInput, Field, PageHeader, Select, Tabs } from './_pendingUi'
import { geography, changeFilter, filterChoices } from './model'
import type { Geography } from './model'
import { SummaryView, SubmissionsView, HoursView, LevelsView } from './reportViews'
import { Institutions } from './Institutions'

const fields: Record<Geography, string> = { projectId: 'Proyecto', department: 'Departamento', municipality: 'Municipio', schoolId: 'Institución', campus: 'Sede' }
const tabs = [
  { to: '/visualizacion', label: 'Resumen' }, { to: '/visualizacion/seguimiento', label: 'Seguimiento' },
  { to: '/visualizacion/instituciones', label: 'Instituciones' }, { to: '/visualizacion/horas', label: 'Horas y asistencia' },
  { to: '/visualizacion/niveles', label: 'Niveles' },
]

function FilterBar({ filters, onChange }: { filters: ReportFilters; onChange: (filters: ReportFilters) => void }) {
  const options = useFilterOptions(filters)
  const choices = filterChoices(options)
  const count = Object.values(filters).filter(Boolean).length
  return <details className="rep-filters"><summary>Filtros{count > 0 && ' (' + count.toLocaleString('es-CO') + ')'}</summary>
    {options.loading && <p role="status">Cargando opciones…</p>}
    {options.error && <p role="alert">{options.error}</p>}
    <div className="rep-filter-grid">
      {geography.map(key => <Field key={key} label={fields[key]}>
        <Select value={filters[key] ?? ''} disabled={!choices[key].length || (key === 'campus' && !filters.schoolId)}
          onChange={e => onChange(changeFilter(filters, key, e.target.value))}>
          <option value="">Todas las opciones</option>{(key !== 'campus' || filters.schoolId) && choices[key].map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </Select>
      </Field>)}
      {(['from', 'to'] as const).map(key => <Field key={key} label={key === 'from' ? 'Desde' : 'Hasta'}>
        <DateInput value={filters[key] ?? ''} min={key === 'to' ? filters.from : undefined} max={key === 'from' ? filters.to : undefined}
          onChange={e => {
            const next = { ...filters }
            if (e.target.value) next[key] = e.target.value
            else delete next[key]
            onChange(next)
          }} />
      </Field>)}
      <Button disabled={!count} onClick={() => onChange({})}>Limpiar filtros</Button>
    </div>
  </details>
}

function ExportButton({ filters, disabled }: { filters: ReportFilters; disabled: boolean }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(false)
  const active = useRef(false)
  useEffect(() => { active.current = true; return () => { active.current = false } }, [])
  async function download() {
    setBusy(true)
    setError(false)
    try {
      const data = await getExport(filters)
      if (!active.current) return
      const url = URL.createObjectURL(buildExcelExport(data))
      const link = document.createElement('a')
      link.href = url
      link.download = 'Informe-ENAd.xlsx'
      document.body.appendChild(link)
      try { link.click() } finally {
        link.remove()
        window.setTimeout(() => URL.revokeObjectURL(url), 1000)
      }
    } catch { if (active.current) setError(true) }
    finally { if (active.current) setBusy(false) }
  }
  return <div><Button variant="primary" loading={busy} disabled={disabled} onClick={download}>{busy ? 'Preparando archivo…' : 'Exportar Excel'}</Button>
    {error && <p role="alert">No se pudo exportar el informe. Intenta de nuevo.</p>}
  </div>
}

export function Foundation() {
  const [filters, setFilters] = useState<ReportFilters>({})
  const invalid = !!(filters.from && filters.to && filters.from > filters.to)
  return <>
    <PageHeader title="Visualización de datos"><ExportButton key={JSON.stringify(filters)} filters={filters} disabled={invalid} /></PageHeader>
    <Tabs items={tabs} label="Secciones del informe" />
    <FilterBar filters={filters} onChange={setFilters} />
    {invalid ? <p role="alert">La fecha final debe ser igual o posterior a la fecha inicial.</p> :
      <Routes>
        <Route index element={<SummaryView filters={filters} />} />
        <Route path="seguimiento" element={<SubmissionsView filters={filters} />} />
        <Route path="instituciones" element={<Institutions key={JSON.stringify(filters)} filters={filters} />} />
        <Route path="horas" element={<HoursView filters={filters} />} />
        <Route path="niveles" element={<LevelsView filters={filters} />} />
        <Route path="*" element={<Navigate to="/visualizacion" replace />} />
      </Routes>}
  </>
}
