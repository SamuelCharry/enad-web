import { createAccount, deleteAccount, resetPassword } from '../../data/functions'
import { LoadError } from '../../ui/LoadError'
import { useSearchParams } from 'react-router-dom'
import { useState } from 'react'
import type { Role, Jornada, School, UserProfile } from '../../domain/types'
import { linkSchoolTeacher, removeSchool, patchUser, upsertSchool, useUsers } from '../../data/admin'
import { useProjects, useSchools } from '../../data/scope'
import { Button, Field, TextInput } from '../../ui/components'
import { useAction } from './useAction'
import { Directory } from './admin/Directory'
import { Records } from './admin/Rosters'
import { savedNotice } from './admin/notice'
import { Choice } from './common'
import { Credentials } from './FileImport'

const shifts = [{ id: 'mañana', name: 'Mañana' }, { id: 'tarde', name: 'Tarde' }, { id: 'única', name: 'Única' }] as const
export function Schools({restricted=false}:{restricted?:boolean}) {
  const { schools, loading, error } = useSchools()
  const [params, setParams] = useSearchParams()
  const selected = params.get('school')
  const creating = params.get('crear') === '1'
  function select(id?:string) {
    const next = new URLSearchParams(params)
    next.delete('crear')
    next.delete('vista')
    next.delete('buscar')
    if (id) next.set('school',id); else next.delete('school')
    setParams(next)
  }
  const [notice, setNotice] = useState('')
  if (error) return <LoadError message={error} />
  const school = schools.find(s => s.id === selected)
  const back = () => { select(undefined); setNotice('') }
  if (creating && !restricted) return <SchoolEditor restricted={false} onClose={back} onSaved={(message, id) => { setNotice(message); select(id) }}/>
  if (selected && !loading && !school) return <><p>Esta institución no está disponible en tu directorio.</p><Button onClick={back}>Volver a instituciones</Button></>
  if (school) return <SchoolWorkspace key={school.id} school={school} restricted={restricted} back={back} notice={notice} setNotice={setNotice}/>
  return <Directory title="Instituciones y sedes" loading={loading} headers={['Institución','Municipio','Sedes','Estado']} create={restricted ? undefined : 'Crear institución'}
    onOpen={select} onCreate={() => {const next = new URLSearchParams(params); next.set('crear','1'); setParams(next)}} editLabel="Abrir institución"
    rows={schools.map(s => ({id:s.id,search:[s.name,s.id,s.municipality,...s.campuses.map(c => c.name)].join(' '),
      cells:[s.name,s.municipality,s.campuses.length,s.active ? 'Activa':'Inactiva']}))}/>
}
const schoolSections = ['Sedes', 'Docentes', 'Grupos', 'Estudiantes'] as const
function SchoolWorkspace({school, restricted, back, notice, setNotice}: {school:School; restricted:boolean; back:()=>void; notice:string; setNotice:(s:string)=>void}) {
  const [params, setParams] = useSearchParams()
  const section = schoolSections.find(item => item.toLowerCase() === params.get('vista')) || 'Sedes'
  function setSection(item: typeof schoolSections[number]) {
    const next = new URLSearchParams(params)
    next.set('vista',item.toLowerCase())
    setParams(next)
  }
  const [editing, setEditing] = useState(false)
  return <section className="school-workspace">
    <Button onClick={back}>Volver a instituciones</Button>
    <header><h2>{school.name}</h2><p>{[school.municipality, school.department, school.active ? 'Activa' : 'Inactiva'].filter(Boolean).join(' · ')}</p></header>
    {notice && <p role="status">{notice}</p>}
    {editing ? <SchoolEditor school={school} restricted={restricted} onClose={() => setEditing(false)} onDeleted={back}
      onSaved={message => {setEditing(false); setNotice(message)}}/> : <>
      <nav aria-label="Secciones de la institución">{schoolSections.map(item => <button key={item} type="button" aria-current={section === item ? 'page' : undefined}
        onClick={() => {setSection(item); setNotice('')}}>{item}</button>)}</nav>
      {section === 'Sedes' ? <><div className="school-section-heading"><h3>Sedes ({school.campuses.length})</h3><Button onClick={() => setEditing(true)}>Editar institución y sedes</Button></div>
        <ul className="campus-list">{school.campuses.map(c => <li key={c.id}><strong>{c.name}</strong><span>Jornada {c.jornada}</span></li>)}</ul></> :
        section === 'Docentes' ? <SchoolTeachers school={school} restricted={restricted}/> :
        <Records key={section} kind={section === 'Grupos' ? 'grupos' : 'estudiantes'} schools={[school]} schoolId={school.id}/>}
    </>}
  </section>
}
function SchoolTeachers({school, restricted}:{school:School; restricted:boolean}) {
  const staff = useUsers('docente',school.id)
  const [assigning, setAssigning] = useState(false)
  const [notice, setNotice] = useState('')
  const close = (msg?:string) => {setAssigning(false);setNotice(msg || '')}
  if (staff.error) return <LoadError message={staff.error}/>
  return <><div className="school-section-heading"><h3>Docentes</h3>{!restricted && !assigning && <Button variant="primary" onClick={() => setAssigning(true)}>Vincular docente</Button>}</div>
    {notice && <p role="status">{notice}</p>}
    {assigning ? <AssignTeacher school={school} close={close}/> :
      <Directory title="Docentes de la institución" headers={['Docente','Jornada','Estado']} loading={staff.loading}
        rows={staff.users.filter(u => u.schoolIds?.includes(school.id)).map(u => ({id:u.uid, search:u.fullName, cells:[u.fullName,u.jornada,u.activo ? 'Activo' : 'Inactivo']}))}/>}
  </>
}
function AssignTeacher({school, close}:{school:School; close:(notice?:string)=>void}) {
  const staff = useUsers('docente')
  const [uid, setUid] = useState('')
  const action = useAction()
  if (staff.error) return <><LoadError message={staff.error}/><Button onClick={() => close()}>Volver a docentes</Button></>
  const available = staff.users.filter(u => u.activo && !u.schoolIds?.includes(school.id))
  return <form onSubmit={e => {e.preventDefault();void action.run(async () => {
    await linkSchoolTeacher(uid,school.id)
    close('Docente vinculado a la institución.')
  })}}><fieldset disabled={action.busy}><Choice label="Docente existente" value={uid} options={available.map(u => ({id:u.uid,name:u.fullName}))}
    placeholder={staff.loading ? 'Cargando docentes…' : 'Selecciona un docente'} onChange={setUid}/>
    {!staff.loading && !available.length && <p>No hay docentes activos disponibles para vincular.</p>}
    <div className="collect-actions"><Button onClick={() => close()}>Cancelar</Button><Button variant="primary" type="submit" disabled={!uid}>Guardar vínculo</Button></div>
  </fieldset>{action.feedback}</form>
}
function SchoolEditor({ school, restricted, onClose, onSaved, onDeleted }: { restricted:boolean; school?: School; onClose: () => void; onSaved:(notice:string,id:string)=>void; onDeleted?:()=>void }) {
  const [form, setForm] = useState<School>(() => school ?? { id: crypto.randomUUID(), name: '', projectId: '', region: '', department: '', municipality: '', zone: 'urbana', active: true, campuses: [] })
  const action = useAction()
  const [newCampus, setNewCampus] = useState('')
  const projects = useProjects()
  const fields = [['name', 'Nombre de la institución'], ['department', 'Departamento'], ['municipality', 'Municipio']] as const
  const editable = fields.filter(([key]) => !restricted || key === 'name')
  return <section className="school-editor"><h3>{school ? 'Editar institución' : 'Crear institución'}</h3>
    <form noValidate onSubmit={e => {
      e.preventDefault()
      const removed = school?.campuses.filter(c => !form.campuses.some(v => v.id===c.id)) ?? []
      if (school && ((school.active && !form.active) || removed.length) &&
        !window.confirm('¿Guardar los cambios de '+school.name+'? '+(removed.length ? 'Se quitarán las sedes '+removed.map(c => c.name).join(', ')+'. ' : '')+(school.active && !form.active ? 'La institución quedará inactiva.' : ''))) return
      void action.run(async () => {
        if (editable.some(([key]) => !form[key].trim()) || form.campuses.some(c => !c.name.trim())) throw new Error('Completa los campos de la institución y sus sedes.')
        if (!form.campuses.length) throw new Error('Añade al menos una sede.')
        if (!restricted && !projects.data.some(p => p.id === form.projectId)) throw new Error('Selecciona un proyecto de la lista.')
        const result = await upsertSchool(restricted ? {id:form.id,name:form.name,campuses:form.campuses} : form)
        onSaved(savedNotice(result),form.id)
      })
    }}>
      <fieldset disabled={action.busy}>
        <div className="collect-fields">{editable.map(([key, label]) => <Field key={key} label={label}>
          <TextInput required value={form[key]} onChange={e => setForm({ ...form, [key]: e.target.value })} />
        </Field>)}
          {!restricted && <Choice label="Proyecto" value={form.projectId} options={projects.data} placeholder={projects.loading ? 'Cargando proyectos…' : 'Selecciona el proyecto'} onChange={projectId => setForm({...form,projectId})}/>}
          {!restricted && projects.error && <p role="alert">{projects.error}</p>}
          {!restricted && <Choice label="Zona" value={form.zone} options={[{ id: 'urbana', name: 'Urbana' }, { id: 'rural', name: 'Rural' }]} onChange={zone => setForm({ ...form, zone })} />}
        </div>
        {!restricted && <label>
          <input type="checkbox" checked={form.active} onChange={e => setForm({ ...form, active: e.target.checked })} /> Institución activa</label>}
        <h3>Sedes</h3>{form.campuses.map((c, i) => <details className="campus-editor" key={c.id} open={newCampus === c.id || undefined}><summary>{c.name || `Sede ${i + 1}`}</summary>
          <Field label="Nombre de la sede">
            <TextInput required value={c.name} onChange={e => setForm({ ...form, campuses: form.campuses.map(site => site.id === c.id ? { ...site, name: e.target.value } : site) })} />
          </Field>
          <Choice label="Jornada" value={c.jornada} options={shifts} onChange={jornada => setForm({ ...form, campuses: form.campuses.map(site => site.id === c.id ? { ...site, jornada } : site) })} />
          <Button onClick={() => setForm({ ...form, campuses: form.campuses.filter(site => site.id !== c.id) })}>Quitar sede</Button>
        </details>)}
        <div className="collect-actions">
          <Button onClick={() => {const id = crypto.randomUUID(); setNewCampus(id); setForm({ ...form, campuses: [...form.campuses, { id, name: '', jornada: 'única' }] })}}>Añadir sede</Button>
          <Button onClick={() => onClose()}>Cancelar</Button><Button type="submit" variant="primary">Guardar institución</Button>
          {!restricted && school && <Button variant="danger" onClick={() => {
            if (window.confirm('¿Eliminar el colegio '+school.name+' y sus sedes?')) void action.run(async () => { await removeSchool(school.id); onDeleted?.() })
          }}>Eliminar colegio</Button>}
        </div>
      </fieldset>{action.feedback}</form>
  </section>
}
const roles = [{id:'docente',name:'Docente'},{id:'coordinador',name:'Coordinación'},{id:'fundacion',name:'Fundación'}] as const
export function Teachers({profile}:{profile?:UserProfile}) {
  const [filter,setFilter] = useState<Role|''>('')
  const { users, loading, error } = useUsers(filter || undefined)
  const directory = useSchools(), schools = directory.schools
  if (error || directory.error) return <LoadError message={error || directory.error} />
  return <>{profile?.rol !== 'coordinador' && <Choice label="Filtrar por perfil" options={roles} value={filter} placeholder="Todos los perfiles" onChange={setFilter}/>}
    <Directory title="Directorio de personas" loading={loading || directory.loading} headers={['Nombre','Perfil','Instituciones','Jornada','Estado']} create={profile?.rol === 'coordinador' ? undefined : 'Crear cuenta'}
    rows={users.filter(u => !filter || u.rol === filter).map(u => {
      const names = schools.filter(s => u.schoolIds?.includes(s.id)).map(s => s.name).join(' · ')
      return {id:u.uid,search:[u.fullName,u.email,u.username,names].join(' '),cells:[u.fullName,roles.find(r => r.id === u.rol)?.name,names || 'Sin asignación',u.rol === 'docente' ? u.jornada : '—',u.activo ? 'Activo':'Inactivo']}
    })}
    editor={(id,close) => <TeacherEditor profile={profile} key={id} user={users.find(u => u.uid===id)} schools={schools} onClose={close}/>}/></>
}
function TeacherEditor({ user, schools, profile, onClose }: { profile?:UserProfile; user?: UserProfile; schools: School[]; onClose: (message?:string) => void }) {
  const [fullName, setName] = useState(user?.fullName ?? '')
  const restricted = profile?.rol === 'coordinador'
  const [role,setRole] = useState<Role>(user?.rol || 'docente')
  const [username,setUsername] = useState(user?.username || user?.email || '')
  const [jornada, setShift] = useState<Jornada>(user?.jornada ?? 'única')
  const [active, setActive] = useState(user?.activo ?? true)
  const [sites, setSites] = useState<Record<string, string[]>>(() => Object.fromEntries((user?.schoolIds ?? []).map(id => [id, user?.campusIds?.[id] ?? []])))
  const [credentials, setCredentials] = useState<{ username: string; password: string } | null>(null)
  const action = useAction()
  if (user && profile?.rol === 'coordinador' && user.schoolIds.some(id => !profile.schoolIds.includes(id))) {
    return <section><h3>{user.fullName}</h3><p>La Fundación gestiona esta cuenta porque tiene colegios fuera de tu asignación.</p><Button onClick={() => onClose()}>Cerrar</Button></section>
  }
  return <section><h3>{user ? 'Editar persona' : 'Crear persona'}</h3>
    {credentials ? <><p role="status">{user ? 'Contraseña actualizada.' : 'Cuenta creada.'} Copia la contraseña antes de cerrar.</p><Credentials items={[credentials]} /><Button onClick={() => onClose(user ? 'Contraseña actualizada.' : 'Cuenta creada')}>Cerrar</Button></> : <form noValidate onSubmit={e => {
      e.preventDefault()
      if (user && ((user.activo && !active) || user.schoolIds.some(id => !sites[id] || (user.campusIds?.[id] ?? []).some(c => !sites[id].includes(c)))) &&
        !window.confirm('¿Confirmas el cambio de acceso de '+user.fullName+'? Revisa las instituciones, sedes y el estado de la cuenta.')) return
      void action.run(async () => {
        const schoolIds = Object.keys(sites)
        if ((!schoolIds.length && role !== 'fundacion') || !fullName.trim()) throw new Error('Escribe el nombre y asigna un colegio al perfil.')
        const fields = { fullName: fullName.trim(), jornada, schoolIds, campusIds: sites }
        if (user) {
          const result = await patchUser(user.uid, {fullName:fields.fullName,jornada,campusIds:sites,activo:active,...(!restricted && {rol:role,schoolIds})})
          onClose(savedNotice(result))
        }
        else setCredentials(await createAccount({ ...fields, username:username.trim(), rol:role }))
      }, '')
    }}>
      <fieldset disabled={action.busy}>
        <Field label="Nombre completo">
          <TextInput required value={fullName} onChange={e => setName(e.target.value)} />
        </Field>
        <Field label="Usuario" hint={user ? undefined : "De 3 a 30 letras minúsculas, números o puntos."}><TextInput required disabled={!!user} minLength={3} maxLength={30} pattern="[a-z0-9.]{3,30}" value={username} onChange={e => setUsername(e.target.value)}/></Field>
        {!restricted && <Choice label="Perfil" value={role} options={roles} onChange={setRole}/>}
        {role === 'docente' && <Choice label="Jornada" options={shifts} value={jornada} onChange={setShift} />}
        {user && <label>
          <input type="checkbox" disabled={user.uid === profile?.uid} checked={active} onChange={e => setActive(e.target.checked)} /> Cuenta activa</label>}
        <fieldset>
          <legend>Instituciones y sedes asignadas</legend>{schools.map(s => <div key={s.id}>
            <label>
              <input type="checkbox" disabled={!!user && restricted} checked={s.id in sites} onChange={e => {
                const next = { ...sites }
                if (e.target.checked) next[s.id] = []; else delete next[s.id]
                setSites(next)
              }} /> {s.name}</label>
            {s.id in sites && s.campuses.map(c => <label key={c.id} className="collect-indent">
              <input type="checkbox" checked={sites[s.id].includes(c.id)} onChange={e => setSites({ ...sites, [s.id]: e.target.checked ? [...sites[s.id], c.id] : sites[s.id].filter(id => id !== c.id) })} /> {c.name}</label>)}</div>)}</fieldset>
        <div className="admin-save"><Button onClick={() => onClose()}>Cancelar</Button><Button type="submit" variant="primary">{user ? 'Guardar cambios' : 'Crear cuenta'}</Button></div>
        {user && user.uid !== profile?.uid && <div className="collect-actions">
          <Button onClick={() => { if (window.confirm('¿Generar una contraseña nueva para '+user.fullName+'?')) void action.run(async () => {
            const result = await resetPassword(user.uid); setCredentials({username:user.username || user.email,password:result.password})
          },'') }}>Restablecer contraseña</Button>
          <Button variant="danger" onClick={() => {
            if (window.confirm('¿Eliminar la cuenta de '+user.fullName+'?') && window.confirm('Se cerrará su acceso y sus grupos quedarán sin docente. ¿Confirmas la eliminación?'))
              void action.run(async () => { await deleteAccount(user.uid); onClose('Cuenta eliminada.') })
          }}>Eliminar cuenta</Button></div>}
      </fieldset>
    </form>}{action.feedback}</section>
}
