import { useState } from 'react'
import { type Activity, type ActivityFields, groupLevels, planToday, recommended, removeActivity, saveActivity, useActivities, usePlan } from '../../data/activities'
import { useGroups } from '../../data/groups'
import { useStudents } from '../../data/students'
import type { Group, Role } from '../../domain/types'
import { LEVELS, levelLabel, subjectLabel } from '../../domain/levels'
import { colombiaToday } from '../../domain/weeks'
import { Button, Dialog, Field, NumberInput, SyncStatus, TextInput } from '../../ui/components'
import { Choice, Search, SubjectField } from '../collect/common'
import { useAction } from '../collect/useAction'
import { LiveState } from '../reports/ReportState'
import { matches } from '../collect/formValues'

function Editor({activity,close}:{activity?:Activity; close:()=>void}) {
  const [form,set] = useState<ActivityFields>(activity || {title:'',subject:'lectura',levels:[],minutes:20,description:'',link:null,active:true})
  const action = useAction()
  return <Dialog title={activity ? 'Editar actividad' : 'Crear actividad'} onClose={close} busy={action.busy}>
    <form onSubmit={e => { e.preventDefault(); void action.run(async () => {
      const {title,subject,levels,minutes,description,link,active} = form
      await saveActivity({title,subject,levels,minutes,description,link,active},activity?.id); close()
    }) }}><fieldset disabled={action.busy}>
      <Field label="Título"><TextInput required minLength={3} maxLength={80} value={form.title} onChange={e => set({...form,title:e.target.value})}/></Field>
      <SubjectField value={form.subject} onChange={subject => set({...form,subject,levels:[]})}/>
      <fieldset><legend>Niveles</legend>{LEVELS[form.subject].map(l => <label key={l}><input type="checkbox" checked={form.levels.includes(l)}
        onChange={e => set({...form,levels:e.target.checked ? [...form.levels,l] : form.levels.filter(i => i !== l)})}/>{levelLabel(form.subject,l)}</label>)}</fieldset>
      <Field label="Duración en minutos"><NumberInput required min={5} max={120} value={form.minutes || ''} onChange={e => set({...form,minutes:Number(e.target.value)})}/></Field>
      <label>Descripción<textarea className="ui-control" maxLength={1000} value={form.description} onChange={e => set({...form,description:e.target.value})}/></label>
      <Field label="Enlace opcional"><TextInput type="url" value={form.link || ''} onChange={e => set({...form,link:e.target.value})}/></Field>
      <label><input type="checkbox" checked={form.active} onChange={e => set({...form,active:e.target.checked})}/>Disponible para docentes</label>
      <Button variant="primary" type="submit">Guardar actividad</Button>
      {activity && <Button variant="danger" onClick={() => {
        if (window.confirm('¿Eliminar «'+activity.title+'» del catálogo?')) void action.run(async () => { await removeActivity(activity.id); close() })
      }}>Eliminar actividad</Button>}</fieldset></form>{action.feedback}</Dialog>
}
function ActivityList({activities,edit,group,levels=[],current}:{activities:Activity[]; edit?:(a:Activity)=>void; group?:Group; levels?:string[]; current?:string}) {
  const [search,setSearch] = useState('')
  const action = useAction()
  const fits = (a:Activity) => !!group && recommended(a,group,levels)
  const visible = activities.filter(a => matches(search,a.title,subjectLabel(a.subject),...a.levels.map(l => levelLabel(a.subject,l))))
    .sort((a,b) => Number(fits(b))-Number(fits(a)) || a.title.localeCompare(b.title,'es'))
  return <><Search value={search} onChange={setSearch}/>{visible.map(a => <article className="activity-row" key={a.id}>
    <h3>{a.title}</h3><p>{subjectLabel(a.subject)} · {a.minutes} min · {a.levels.map(l => levelLabel(a.subject,l)).join(', ')}</p>
    {fits(a) && <strong>Recomendada para tu grupo</strong>}{!a.active && <strong>Inactiva</strong>}
    {a.description && <p>{a.description}</p>}{a.link?.startsWith('https://') && <a href={a.link} target="_blank" rel="noreferrer">Abrir material</a>}
    {edit && <Button onClick={() => edit(a)}>Editar actividad</Button>}
    {group && <Button disabled={action.busy || current === a.id} onClick={() => {
      if (!current || window.confirm('¿Cambiar la actividad de hoy por «'+a.title+'»?')) void action.run(() => planToday(group.id,a.id))
    }}>{current === a.id ? 'En el plan de hoy' : 'Usar hoy'}</Button>}</article>)}
    {!visible.length && <p>{search ? 'No hay actividades con ese nombre o nivel.' : 'Todavía no hay actividades disponibles.'}</p>}{action.feedback}</>
}
function GroupActivities({group,activities}:{group:Group;activities:Activity[]}) {
  const roster = useStudents(group.schoolId), plan = usePlan(group,colombiaToday())
  return <LiveState loading={roster.loading || plan.loading} error={roster.error || plan.error}>
    <h2>Actividad de hoy</h2><p>{plan.data?.activityTitle || 'Aún no has elegido una actividad.'}</p>
    {plan.data && <SyncStatus pending={plan.data.pending}/>}
    <ActivityList activities={activities} group={group} levels={groupLevels(group,roster.students)} current={plan.data?.activityId}/></LiveState>
}
function TeacherActivities({activities}:{activities:Activity[]}) {
  const {groups,loading,error} = useGroups(undefined,{mine:true})
  const [id,setId] = useState('')
  const group = groups.find(g => g.id === id) || groups[0]
  return <LiveState loading={loading} error={error}>{group ? <><Choice label="Mi grupo" options={groups} value={group.id} onChange={setId}/>
    <GroupActivities key={group.id} group={group} activities={activities}/></> : <><p>Crea un grupo para elegir su actividad de hoy.</p><ActivityList activities={activities}/></>}</LiveState>
}
export function Activities({role}:{role:Role}) {
  const {data,loading,error} = useActivities()
  const [editor,setEditor] = useState<Activity|null>()
  return <LiveState loading={loading} error={error}>{role === 'docente' ? <TeacherActivities activities={data}/> : <>
    {role === 'fundacion' && <Button variant="primary" onClick={() => setEditor(null)}>Crear actividad</Button>}
    <ActivityList activities={data} edit={role === 'fundacion' ? setEditor : undefined}/>
    {editor !== undefined && <Editor activity={editor || undefined} close={() => setEditor(undefined)}/>}</>}</LiveState>
}
