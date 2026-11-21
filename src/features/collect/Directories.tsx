import { useState } from 'react'
import type { Jornada, School, UserProfile } from '../../domain/types'
import { createTeacher, patchUser, upsertSchool, useSchools, useUsers } from './_pending'
import { Button, Card, Dialog, Field, TextInput } from './_pendingUi'
import { useAction } from './useAction'
import { matches } from './formValues'
import { Choice, Search } from './common'
import { Credentials } from './FileImport'

const shifts = [{ id: 'mañana', name: 'Mañana' }, { id: 'tarde', name: 'Tarde' }, { id: 'única', name: 'Única' }] as const
export function Schools() {
  const { schools, loading, error } = useSchools()
  const [query, setQuery] = useState('')
  const [edit, setEdit] = useState<School | 'new' | null>(null)
  const rows = schools.filter(s => matches(query, s.name, s.id, s.municipality, s.region, ...s.campuses.map(c => c.name)))
  if (error) return <p role="alert">{error}</p>
  return <>
    <div className="collect-toolbar">
      <Search value={query} onChange={setQuery} />
      <Button variant="primary" onClick={() => setEdit('new')}>Crear institución</Button>
    </div>
    {loading ? <p>Cargando instituciones…</p> : !rows.length && <p>Sin instituciones en esta selección.</p>}
    {rows.map(s => <Card key={s.id}>
      <div className="collect-row">
        <div>
          <h3>{s.name}</h3>
          <small>{s.municipality} · {s.department} · {s.active ? 'Activa' : 'Inactiva'}</small>
          <p>{s.campuses.map(c => c.name).join(' · ')}</p>
        </div>
        <Button onClick={() => setEdit(s)}>Editar institución</Button>
      </div>
    </Card>)}
    {edit && <SchoolEditor school={edit === 'new' ? undefined : edit} onClose={() => setEdit(null)} />}</>
}
function SchoolEditor({ school, onClose }: { school?: School; onClose: () => void }) {
  const [form, setForm] = useState<School>(() => school ?? { id: crypto.randomUUID(), name: '', projectId: '', region: '', department: '', municipality: '', zone: 'urbana', active: true, campuses: [] })
  const action = useAction()
  const fields = [['name', 'Nombre de la institución'], ['projectId', 'Proyecto'], ['region', 'Región'], ['department', 'Departamento'], ['municipality', 'Municipio']] as const
  return <Dialog title={school ? 'Editar institución' : 'Crear institución'} {...{ onClose }} busy={action.busy}>
    <form onSubmit={e => {
      e.preventDefault()
      void action.run(async () => {
        if (fields.some(([key]) => !form[key].trim()) || form.campuses.some(c => !c.name.trim())) throw new Error('Completa los campos de la institución y sus sedes.')
        await upsertSchool(form)
        onClose()
      })
    }}>
      <fieldset disabled={action.busy}>
        <div className="collect-fields">{fields.map(([key, label]) => <Field key={key} label={label}>
          <TextInput required value={form[key]} onChange={e => setForm({ ...form, [key]: e.target.value })} />
        </Field>)}
          <Choice label="Zona" value={form.zone} options={[{ id: 'urbana', name: 'Urbana' }, { id: 'rural', name: 'Rural' }]} onChange={zone => setForm({ ...form, zone })} />
        </div>
        <label>
          <input type="checkbox" checked={form.active} onChange={e => setForm({ ...form, active: e.target.checked })} /> Institución activa</label>
        <h3>Sedes</h3>{form.campuses.map((c, i) => <fieldset key={c.id}>
          <legend>Sede {i + 1}</legend>
          <Field label="Nombre de la sede">
            <TextInput required value={c.name} onChange={e => setForm({ ...form, campuses: form.campuses.map(site => site.id === c.id ? { ...site, name: e.target.value } : site) })} />
          </Field>
          <Choice label="Jornada" value={c.jornada} options={shifts} onChange={jornada => setForm({ ...form, campuses: form.campuses.map(site => site.id === c.id ? { ...site, jornada } : site) })} />
          <Button onClick={() => setForm({ ...form, campuses: form.campuses.filter(site => site.id !== c.id) })}>Quitar sede</Button>
        </fieldset>)}
        <div className="collect-actions">
          <Button onClick={() => setForm({ ...form, campuses: [...form.campuses, { id: crypto.randomUUID(), name: '', jornada: 'única' }] })}>Añadir sede</Button>
          <Button type="submit" variant="primary">Guardar institución</Button>
        </div>
      </fieldset>{action.feedback}</form>
  </Dialog>
}
export function Teachers() {
  const { users, loading, error } = useUsers('docente')
  const { schools } = useSchools()
  const [q, setQ] = useState('')
  const [edit, setEdit] = useState<UserProfile | 'new' | null>(null)
  const schoolNames = (u: UserProfile) => schools.filter(s => u.schoolIds.includes(s.id)).map(s => s.name).join(' · ')
  const rows = users.filter(u => matches(q, u.fullName, u.email, u.username ?? '', schoolNames(u)))
  if (error) return <p role="alert">{error}</p>
  return <>
    <div className="collect-toolbar">
      <Search value={q} onChange={setQ} />
      <Button variant="primary" onClick={() => setEdit('new')}>Crear docente</Button>
    </div>
    {loading ? <p>Cargando docentes…</p> : !rows.length && <p>Sin docentes en esta selección.</p>}
    {rows.map(u => <Card key={u.uid}>
      <div className="collect-row">
        <div>
          <h3>{u.fullName}</h3>
          <small>{u.activo ? 'Activo' : 'Inactivo'} · {u.email}</small>
          <p>{schoolNames(u)}</p>
        </div>
        <Button onClick={() => setEdit(u)}>Editar docente</Button>
      </div>
    </Card>)}
    {edit && <TeacherEditor user={edit === 'new' ? undefined : edit} {...{ schools }} onClose={() => setEdit(null)} />}</>
}
function TeacherEditor({ user, schools, onClose }: { user?: UserProfile; schools: School[]; onClose: () => void }) {
  const [fullName, setName] = useState(user?.fullName ?? '')
  const [email, setEmail] = useState(user?.email ?? '')
  const [jornada, setShift] = useState<Jornada>(user?.jornada ?? 'única')
  const [active, setActive] = useState(user?.activo ?? true)
  const [sites, setSites] = useState<Record<string, string[]>>(() => Object.fromEntries((user?.schoolIds ?? []).map(id => [id, user?.campusIds[id] ?? []])))
  const [credentials, setCredentials] = useState<{ username: string; password: string } | null>(null)
  const action = useAction()
  return <Dialog title={user ? 'Editar docente' : 'Crear docente'} {...{ onClose }} busy={action.busy}>
    {credentials ? <Credentials items={[credentials]} /> : <form onSubmit={e => {
      e.preventDefault()
      void action.run(async () => {
        const schoolIds = Object.keys(sites)
        if (!schoolIds.length || !fullName.trim()) throw new Error('Indica el nombre del docente y al menos una institución.')
        const fields = { fullName: fullName.trim(), jornada, schoolIds, campusIds: sites }
        if (user) {
          await patchUser(user.uid, { ...fields, activo: active })
          onClose()
        }
        else setCredentials(await createTeacher({ ...fields, email: email.trim() }))
      }, '')
    }}>
      <fieldset disabled={action.busy}>
        <Field label="Nombre completo">
          <TextInput required value={fullName} onChange={e => setName(e.target.value)} />
        </Field>
        <Field label={user ? 'Correo electrónico' : 'Correo electrónico (opcional)'}>
          <TextInput type="email" disabled={!!user} value={email} onChange={e => setEmail(e.target.value)} />
        </Field>
        {!user && <p>Deja el correo vacío para generar un usuario de ENAd.</p>}
        <Choice label="Jornada" options={shifts} value={jornada} onChange={setShift} />
        {user && <label>
          <input type="checkbox" checked={active} onChange={e => setActive(e.target.checked)} /> Cuenta activa</label>}
        <fieldset>
          <legend>Instituciones y sedes asignadas</legend>{schools.map(s => <div key={s.id}>
            <label>
              <input type="checkbox" checked={s.id in sites} onChange={e => {
                const next = { ...sites }
                if (e.target.checked) next[s.id] = []; else delete next[s.id]
                setSites(next)
              }} /> {s.name}</label>
            {s.id in sites && s.campuses.map(c => <label key={c.id} className="collect-indent">
              <input type="checkbox" checked={sites[s.id].includes(c.id)} onChange={e => setSites({ ...sites, [s.id]: e.target.checked ? [...sites[s.id], c.id] : sites[s.id].filter(id => id !== c.id) })} /> {c.name}</label>)}</div>)}</fieldset>
        <Button type="submit" variant="primary">{user ? 'Guardar cambios' : 'Crear cuenta'}</Button>
      </fieldset>
    </form>}{action.feedback}</Dialog>
}
