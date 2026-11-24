import { LoadError } from '../../ui/LoadError'
import { useState, type ReactNode } from 'react'
import type { School, Subject, Moment, UserProfile } from '../../domain/types'
import { useSchools } from '../../data/scope'
import { MOMENTS, SUBJECTS, momentLabel, subjectLabel } from '../../domain/levels'
import { DateInput, Field, Select, TextInput } from '../../ui/components'

export function Search({ value, onChange }: { value: string; onChange: (s: string) => void }) {
  return <Field label="Buscar">
    <TextInput type="search" value={value} onChange={e => onChange(e.target.value)} />
  </Field>
}
export function Choice<T extends string>({ label, value, options, onChange, placeholder, disabled, required, guide }: {
  label: string; value: T | ''; options: readonly { id: T; name: string }[]; onChange: (s: T) => void; placeholder?: string; disabled?: boolean; required?: boolean; guide?: string
}) {
  return <Field label={label}>
    <Select data-guide={guide} value={value} disabled={disabled} required={required} onChange={e => onChange(e.target.value as T)}>
      {placeholder && <option value="">{placeholder}</option>}{options.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
    </Select>
  </Field>
}
export function SubjectField({ value, onChange, disabled }: { value: Subject; onChange: (s: Subject) => void; disabled?: boolean }) {
  return <Choice guide="subject" label="Área" options={SUBJECTS.map(id => ({ id, name: subjectLabel(id) }))} {...{ value, onChange, disabled }} />
}
export function MomentField({ value, onChange, disabled }: { value: Moment | ''; onChange: (s: Moment) => void; disabled?: boolean }) {
  return <Choice guide="moment" label="Momento de evaluación" required placeholder="Selecciona el momento" options={MOMENTS.map(id => ({ id, name: momentLabel(id) }))} {...{ value, onChange, disabled }} />
}
export function SchoolScope({ profile, children, withCampus = true, allCampuses = false, initialSchool = '', initialCampus = null, allSites = false, includeUnassigned = false, onScopeChange }: { allCampuses?: boolean; includeUnassigned?: boolean; allSites?: boolean; onScopeChange?: (school: string, campus: string | null) => void; initialSchool?: string; initialCampus?: string | null; profile: UserProfile; withCampus?: boolean; children: (school: School, campus: string) => ReactNode }) {
  const { schools, loading, error } = useSchools()
  const [id, setId] = useState(initialSchool)
  const [site, setSite] = useState<string | null>(initialCampus)
  const visible = profile.rol === 'fundacion' ? schools : schools.filter(s => profile.schoolIds.includes(s.id))
  const school = visible.find(s => s.id === id) ?? visible[0]
  if (error) return <LoadError message={error} />
  if (loading) return <p role="status">Cargando instituciones…</p>
  if (!school) return <p>Solicita a coordinación que asigne una institución a tu cuenta.</p>
  const assigned = profile.campusIds[school.id] ?? []
  const campuses = allCampuses || profile.rol !== 'docente' || !assigned.length ? school.campuses : assigned.map(id => school.campuses.find(c => c.id === id) ?? { id, name: id })
  const choices = profile.rol === 'fundacion' ? [...campuses, { id: '', name: 'Sin sede asignada' }] : allSites ? [{ id: '', name: 'Todas las sedes' }, ...campuses] : includeUnassigned && !assigned.length ? [...campuses, { id: '', name: 'Sin sede asignada' }] : campuses
  const campus = choices.find(c => c.id === site || ('name' in c && c.name === site))?.id ?? choices[0]?.id ?? ''
  return <>
    <div className="collect-fields">
      {visible.length > 1 && <Choice guide="school" label="Institución" options={visible} value={school.id} onChange={v => {
        onScopeChange?.(v,null)
        setId(v)
        setSite(null)
      }} />}
      {withCampus && choices.length > 1 && <Choice label="Sede" options={choices} value={campus} onChange={v => { setSite(v); onScopeChange?.(school.id,v) }} />}</div>
    <div key={JSON.stringify([school.id, withCampus ? campus : ''])}>{children(school, campus)}</div>
  </>
}
export function SessionDate({ date, today, setDate }: { date: string; today: string; setDate: (v: string) => void }) {
  const min = today.slice(0, 4) + '-01-01'
  return <Field label="Fecha">
    <DateInput data-guide="date" required min={min} max={today} value={date} onChange={e => setDate(e.target.value)} />
  </Field>
}
