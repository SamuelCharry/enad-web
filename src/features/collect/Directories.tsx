import { useState } from 'react'
import type { Jornada, School, UserProfile } from '../../domain/types'
import { createTeacher, patchUser, upsertSchool, useUsers } from '../../data/admin'
import { useSchools } from '../../data/scope'
import { Button, Field, TextInput } from '../../ui/components'
import { useAction } from './useAction'
import { Directory } from './admin/Directory'
import { savedNotice } from './admin/notice'
import { Choice } from './common'
import { Credentials } from './FileImport'

const shifts = [{ id: 'mañana', name: 'Mañana' }, { id: 'tarde', name: 'Tarde' }, { id: 'única', name: 'Única' }] as const
export function Schools() {
  const { schools, loading, error } = useSchools()
  if (error) return <p role="alert">{error}</p>
  return <Directory title="Instituciones y sedes" loading={loading} headers={['Institución','Municipio','Sedes','Estado']} create="Crear institución"
    rows={schools.map(s => ({id:s.id,search:[s.name,s.id,s.municipality,s.region,...s.campuses.map(c => c.name)].join(' '),
      cells:[s.name,s.municipality,s.campuses.map(c => c.name).join(' · ') || 'Sin sedes',s.active ? 'Activa':'Inactiva']}))}
    editor={(id,close) => <SchoolEditor key={id} school={schools.find(s => s.id===id)} onClose={close}/>}/>
}
function SchoolEditor({ school, onClose }: { school?: School; onClose: (notice?:string) => void }) {
  const [form, setForm] = useState<School>(() => school ?? { id: crypto.randomUUID(), name: '', projectId: '', region: '', department: '', municipality: '', zone: 'urbana', active: true, campuses: [] })
  const action = useAction()
  const fields = [['name', 'Nombre de la institución'], ['projectId', 'Proyecto'], ['region', 'Región'], ['department', 'Departamento'], ['municipality', 'Municipio']] as const
  return <section><h3>{school ? 'Editar institución' : 'Crear institución'}</h3>
    <form onSubmit={e => {
      e.preventDefault()
      const removed = school?.campuses.filter(c => !form.campuses.some(v => v.id===c.id)) ?? []
      if (school && ((school.active && !form.active) || removed.length) &&
        !window.confirm('¿Guardar los cambios de '+school.name+'? '+(removed.length ? 'Se quitarán las sedes '+removed.map(c => c.name).join(', ')+'. ' : '')+(school.active && !form.active ? 'La institución quedará inactiva.' : ''))) return
      void action.run(async () => {
        if (fields.some(([key]) => !form[key].trim()) || form.campuses.some(c => !c.name.trim())) throw new Error('Completa los campos de la institución y sus sedes.')
        const result = await upsertSchool(form)
        onClose(savedNotice(result))
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
          <Button onClick={() => onClose()}>Cancelar</Button><Button type="submit" variant="primary">Guardar institución</Button>
        </div>
      </fieldset>{action.feedback}</form>
  </section>
}
export function Teachers() {
  const { users, loading, error } = useUsers('docente')
  const directory = useSchools(), schools = directory.schools
  if (error || directory.error) return <p role="alert">{error || directory.error}</p>
  return <Directory title="Directorio docente" loading={loading || directory.loading} headers={['Docente','Instituciones','Jornada','Estado']} create="Crear docente"
    rows={users.map(u => {
      const names = schools.filter(s => u.schoolIds?.includes(s.id)).map(s => s.name).join(' · ')
      return {id:u.uid,search:[u.fullName,u.email,u.username,names].join(' '),cells:[u.fullName,names || 'Sin asignación',u.jornada,u.activo ? 'Activo':'Inactivo']}
    })}
    editor={(id,close) => <TeacherEditor key={id} user={users.find(u => u.uid===id)} schools={schools} onClose={close}/>}/>
}
function TeacherEditor({ user, schools, onClose }: { user?: UserProfile; schools: School[]; onClose: (message?:string) => void }) {
  const [fullName, setName] = useState(user?.fullName ?? '')
  const [email, setEmail] = useState(user?.email ?? '')
  const [jornada, setShift] = useState<Jornada>(user?.jornada ?? 'única')
  const [active, setActive] = useState(user?.activo ?? true)
  const [sites, setSites] = useState<Record<string, string[]>>(() => Object.fromEntries((user?.schoolIds ?? []).map(id => [id, user?.campusIds?.[id] ?? []])))
  const [credentials, setCredentials] = useState<{ username: string; password: string } | null>(null)
  const action = useAction()
  return <section><h3>{user ? 'Editar docente' : 'Crear docente'}</h3>
    {credentials ? <><p role="status">Cuenta creada.</p><Credentials items={[credentials]} /><Button onClick={() => onClose('Cuenta creada.')}>Cerrar</Button></> : <form onSubmit={e => {
      e.preventDefault()
      if (user && ((user.activo && !active) || user.schoolIds.some(id => !sites[id] || (user.campusIds?.[id] ?? []).some(c => !sites[id].includes(c)))) &&
        !window.confirm('¿Confirmas el cambio de acceso de '+user.fullName+'? Revisa las instituciones, sedes y el estado de la cuenta.')) return
      void action.run(async () => {
        const schoolIds = Object.keys(sites)
        if (!schoolIds.length || !fullName.trim()) throw new Error('Indica el nombre del docente y al menos una institución.')
        const fields = { fullName: fullName.trim(), jornada, schoolIds, campusIds: sites }
        if (user) {
          const result = await patchUser(user.uid, { ...fields, activo: active })
          onClose(savedNotice(result))
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
        <div className="admin-save"><Button onClick={() => onClose()}>Cancelar</Button><Button type="submit" variant="primary">{user ? 'Guardar cambios' : 'Crear cuenta'}</Button></div>
      </fieldset>
    </form>}{action.feedback}</section>
}
