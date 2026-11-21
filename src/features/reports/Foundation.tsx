import { useEffect, useRef, useState } from 'react'
import { Link, Navigate, Route, Routes, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import type { ReportFilters } from '../../domain/types'
import { getExport, useFilterOptions } from '../../data/reports'
import { Button, DateInput, Field, PageHeader, Select } from '../../ui/components'
import { geography, changeFilter, filterChoices } from './model'
import type { Geography } from './model'
import { SummaryView, SubmissionsView, HoursView, LevelsView } from './reportViews'
import { Institutions } from './Institutions'

import { CompareView, TeacherFollowUp } from './ManagementViews'
import { Print } from './Print'
import { StudentHistory } from './StudentHistory'
import { reportFilters } from './navigation'

const fields: Record<Geography, string> = { projectId: 'Proyecto', department: 'Departamento', municipality: 'Municipio', schoolId: 'Institución', campus: 'Sede' }
const tabs = [
  { to: '/visualizacion', label: 'Resumen' }, { to: '/visualizacion/seguimiento', label: 'Seguimiento' },
  { to: '/visualizacion/instituciones', label: 'Instituciones' }, { to: '/visualizacion/horas', label: 'Horas y asistencia' },
  { to: '/visualizacion/niveles', label: 'Niveles' }, {to:'/visualizacion/docentes',label:'Seguimiento docente'}, {to:'/visualizacion/comparacion',label:'Comparación'},
]

function FilterBar({ filters, options, onChange }: { filters: ReportFilters; options: ReturnType<typeof useFilterOptions>; onChange: (filters: ReportFilters) => void }) {
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
      const [data, { buildExcelExport }] = await Promise.all([getExport(filters), import('../../domain/export/excel')])
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
  const content = useRef<HTMLDivElement>(null)
  const [params,setParams] = useSearchParams()
  const filters = reportFilters(params)
  function setFilters(next: ReportFilters) {
    const merged = new URLSearchParams(params)
    for (const key of [...geography,'from','to','group','student','teacher']) merged.delete(key)
    Object.entries(next).forEach(([key,value]) => merged.set(key,value))
    setParams(merged)
  }
  const options = useFilterOptions(filters)
  const visibility = JSON.stringify(options.schools.map(s => s.id))
  const {pathname} = useLocation(), navigate = useNavigate()
  const tabPath = pathname.endsWith('/estudiante') ? '/visualizacion/instituciones' : pathname.replace(/\/$/,'')
  const target = (to:string) => ({pathname:to,search:new URLSearchParams(filters as Record<string,string>).toString()})
  const invalid = !!(filters.from && filters.to && filters.from > filters.to)
  return <>
    <PageHeader title="Visualización de datos"><ExportButton key={JSON.stringify([filters,visibility])} filters={filters} disabled={invalid || options.loading || !!options.error} /></PageHeader>
    <nav className="ui-tabs" aria-label="Secciones del informe"><div className="ui-tab-links">{tabs.map(t => <Link key={t.to} to={target(t.to)} aria-current={tabPath===t.to ? 'page':undefined} className={tabPath===t.to ? 'active':undefined}>{t.label}</Link>)}</div>
      <div className="ui-tab-picker"><Field label="Sección"><Select value={tabPath} onChange={e => navigate(target(e.target.value))}>{tabs.map(t => <option key={t.to} value={t.to}>{t.label}</option>)}</Select></Field></div></nav>
    <FilterBar options={options} filters={filters} onChange={setFilters} />
    <div ref={content} key={visibility}>{options.loading ? <p role="status">Cargando instituciones…</p> : options.error ? <p role="alert">{options.error}</p> : invalid ? <p role="alert">La fecha final debe ser igual o posterior a la fecha inicial.</p> :
      <Routes>
        <Route index element={<SummaryView filters={filters} />} />
        <Route path="seguimiento" element={<SubmissionsView filters={filters} />} />
        <Route path="instituciones" element={<Institutions key={JSON.stringify(filters)} filters={filters} />} />
        <Route path="horas" element={<HoursView filters={filters} />} />
        <Route path="niveles" element={<LevelsView filters={filters} />} />
        <Route path="*" element={<Navigate to="/visualizacion" replace />} />
        <Route path="docentes" element={<TeacherFollowUp filters={filters}/>} />
        <Route path="comparacion" element={<CompareView filters={filters}/>} />
        <Route path="estudiante" element={<StudentHistory filters={filters}/>} />
      </Routes>}</div>
    {!invalid && <div className="rep-actions"><Print report={content}/></div>}
  </>
}
