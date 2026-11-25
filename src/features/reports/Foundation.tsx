import { validCalendarDay } from '../../domain/weeks'
import { Icon } from '../../ui/Icon'
import { Records } from './Records'
import { LoadError } from '../../ui/LoadError'
import { useEffect, useRef, useState } from 'react'
import { Link, Navigate, Route, Routes, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import type { ReportFilters } from '../../domain/types'
import { useProgramConfig } from '../../data/scope'
import { withReadTimeout } from '../../data/reportCache'
import { reportRange, submissionWindow } from '../../data/reportRange'
import { getExport, useFilterOptions } from '../../data/reports'
import { Button, DateInput, Field, Select } from '../../ui/components'
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
  { to: '/portal/reportes', label: 'Resumen' }, { to: '/portal/reportes/seguimiento', label: 'Seguimiento' },
  { to: '/portal/reportes/instituciones', label: 'Instituciones' }, { to: '/portal/reportes/horas', label: 'Horas y asistencia' },
  {to:'/portal/reportes/evaluaciones',label:'Evaluaciones'}, {to:'/portal/reportes/asistencias',label:'Registro de asistencia'}, {to:'/portal/reportes/registro-horas',label:'Registro de horas'}, { to: '/portal/reportes/niveles', label: 'Niveles' }, {to:'/portal/reportes/docentes',label:'Seguimiento docente'}, {to:'/portal/reportes/comparacion',label:'Comparación'},
]

function FilterBar({ filters, options, onChange }: { filters: ReportFilters; options: ReturnType<typeof useFilterOptions>; onChange: (filters: ReportFilters) => void }) {
  const choices = filterChoices(options)
  const count = Object.values(filters).filter(Boolean).length
  return <details className="rep-filters"><summary>Filtros{count > 0 && ' (' + count.toLocaleString('es-CO') + ')'}</summary>
    {options.loading && <p role="status">Cargando opciones…</p>}
    {options.error && <LoadError message={options.error} />}
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
      const [data, { buildExcelExport }] = await withReadTimeout(Promise.all([getExport(filters), import('../../domain/export/excel')]))
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
  const label = 'Descargar informe filtrado en Excel'
  return <div><button className="shell-icon" type="button" aria-label={label} title={label} aria-busy={busy}
    disabled={busy || disabled} onClick={download}><Icon name="download"/></button>
    {busy && <span role="status">Preparando el archivo…</span>}
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
  const tabPath = pathname.endsWith('/estudiante') ? '/portal/reportes/instituciones' : pathname.replace(/\/$/,'')
  const target = (to:string) => ({pathname:to,search:new URLSearchParams(filters as Record<string,string>).toString()})
  const invalid = !!(filters.from && filters.to && filters.from > filters.to)
  const calendar = useProgramConfig()
  const validDates = [filters.from,filters.to].every(v => !v || validCalendarDay(v))
  const current = validDates && calendar.config && (tabPath.endsWith('/seguimiento')
    ? submissionWindow(calendar.config, filters, Number(params.get('week'))).range
    : reportRange(calendar.config, filters))
  return <>
    <nav className="ui-tabs" aria-label="Secciones del informe"><div className="ui-tab-links">{tabs.map(t => <Link key={t.to} to={target(t.to)} aria-current={tabPath===t.to ? 'page':undefined} className={tabPath===t.to ? 'active':undefined}>{t.label}</Link>)}</div>
      <div className="ui-tab-picker"><Field label="Sección"><Select value={tabPath} onChange={e => navigate(target(e.target.value))}>{tabs.map(t => <option key={t.to} value={t.to}>{t.label}</option>)}</Select></Field></div></nav>
    {current && !tabPath.endsWith('/seguimiento') && <p>Período del informe · {current.from} al {current.to}</p>}
    {calendar.error && <LoadError message={calendar.error}/>}
    <FilterBar options={options} filters={filters} onChange={setFilters} />
    <div ref={content} key={visibility}>{options.loading ? <p role="status">Cargando instituciones…</p> : options.error ? <LoadError message={options.error} /> : !validDates ? <p role="alert">Escribe fechas válidas en los filtros del informe.</p> : invalid ? <p role="alert">La fecha final debe ser igual o posterior a la fecha inicial.</p> :
      <Routes>
        <Route index element={<SummaryView filters={filters} />} />
        <Route path="seguimiento" element={<SubmissionsView filters={filters} calendar={calendar} />} />
        <Route path="instituciones" element={<Institutions key={JSON.stringify(filters)} filters={filters} schools={options.schools} />} />
        <Route path="horas" element={<HoursView filters={filters} />} />
        <Route path="niveles" element={<LevelsView filters={filters} />} />
        <Route path="*" element={<Navigate to="/portal/reportes" replace />} />
        <Route path="evaluaciones" element={<Records kind="evaluations" filters={filters}/>}/>
        <Route path="asistencias" element={<Records kind="attendance" filters={filters}/>}/>
        <Route path="registro-horas" element={<Records kind="hours" filters={filters}/>}/>
        <Route path="docentes" element={<TeacherFollowUp filters={filters}/>} />
        <Route path="comparacion" element={<CompareView filters={filters}/>} />
        <Route path="estudiante" element={<StudentHistory filters={filters}/>} />
      </Routes>}</div>
    <div className="rep-actions">{!invalid && <Print report={content}/>}
      <ExportButton key={JSON.stringify([filters,visibility,current])} filters={current ? {...filters,...current} : filters} disabled={!validDates || invalid || (!!current && current.from > current.to) || options.loading || !!options.error} /></div>
  </>
}
