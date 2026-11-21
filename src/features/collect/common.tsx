import { useState, type ReactNode } from 'react'
import type { School, Subject, Moment, UserProfile } from '../../domain/types'
import { MOMENTS, SUBJECTS, momentLabel, subjectLabel, useSchools } from './_pending'
import { DateInput, Field, Select, TextInput } from './_pendingUi'

export function Search({ value, onChange }: { value: string; onChange: (s: string) => void }) {
  return <Field label="Buscar">
    <TextInput type="search" value={value} onChange={e => onChange(e.target.value)} />
  </Field>
}
export function Choice<T extends string>({ label, value, options, onChange, placeholder, disabled, required }: {
  label: string; value: T | ''; options: readonly { id: T; name: string }[]; onChange: (s: T) => void; placeholder?: string; disabled?: boolean; required?: boolean
}) {
  return <Field label={label}>
    <Select value={value} disabled={disabled} required={required} onChange={e => onChange(e.target.value as T)}>
      {placeholder && <option value="">{placeholder}</option>}{options.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
    </Select>
  </Field>
}
export function SubjectField({ value, onChange, disabled }: { value: Subject; onChange: (s: Subject) => void; disabled?: boolean }) {
  return <Choice label="Área" options={SUBJECTS.map(id => ({ id, name: subjectLabel(id) }))} {...{ value, onChange, disabled }} />
}
export function MomentField({ value, onChange, disabled }: { value: Moment | ''; onChange: (s: Moment) => void; disabled?: boolean }) {
  return <Choice label="Momento de evaluación" required placeholder="Selecciona el momento" options={MOMENTS.map(id => ({ id, name: momentLabel(id) }))} {...{ value, onChange, disabled }} />
}
export function SchoolScope({ profile, children, withCampus = true }: { profile: UserProfile; withCampus?: boolean; children: (school: School, campus: string) => ReactNode }) {
  const { schools, loading, error } = useSchools()
  const [id, setId] = useState('')
  const [site, setSite] = useState<string | null>(null)
  const visible = profile.rol === 'admin' ? schools : schools.filter(s => profile.schoolIds.includes(s.id))
  const school = visible.find(s => s.id === id) ?? visible[0]
  if (error) return <p role="alert">{error}</p>
  if (loading) return <p role="status">Cargando instituciones…</p>
  if (!school) return <p>No hay instituciones disponibles.</p>
  const assigned = profile.campusIds[school.id] ?? []
  const campuses = profile.rol === 'admin' || !assigned.length ? school.campuses : assigned.map(id => school.campuses.find(c => c.id === id) ?? { id, name: id })
  const choices = profile.rol === 'admin' ? [...campuses, { id: '', name: 'Sin sede asignada' }] : campuses
  const campus = choices.find(c => c.id === site)?.id ?? choices[0]?.id ?? ''
  return <>
    <div className="collect-fields">
      <Choice label="Institución" options={visible} value={school.id} onChange={v => {
        setId(v)
        setSite(null)
      }} />
      {withCampus && campuses.length > 0 && <Choice label="Sede" options={choices} value={campus} onChange={setSite} />}</div>
    <div key={JSON.stringify([school.id, withCampus ? campus : ''])}>{children(school, campus)}</div>
  </>
}
export function SessionDate({ date, today, setDate }: { date: string; today: string; setDate: (v: string) => void }) {
  const min = today.slice(0, 4) + '-01-01'
  return <Field label="Fecha">
    <DateInput required min={min} max={today} value={date} onChange={e => setDate(e.target.value)} />
  </Field>
}
