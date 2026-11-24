import { collection, collectionGroup, updateDoc, doc, getDoc, onSnapshot, query, setDoc, where } from 'firebase/firestore'
import { useMemo } from 'react'
import type { Group, Student, Subject } from '../domain/types'
import { LEVELS } from '../domain/levels'
import { colombiaToday } from '../domain/weeks'
import { api, caller, commit, fail, now } from './core'
import { db } from './firebase'
import { groupDoc } from './groups'
import { listenMany, useLive, withSession } from './live'
import { trackSubmission } from './pending'

export interface ActivityFields { title:string; subject:Subject; levels:string[]; minutes:number; description:string; link:string|null; active:boolean }
export interface Activity extends ActivityFields { id:string; createdAt:string; createdBy:string; updatedAt:string }
interface Plan { activityId:string; activityTitle:string; schoolId:string; teacherId:string; date:string; savedAt:string }
const stream = withSession<Activity[]>([],(p,next,error) => {
  const all = collection(db,'activities')
  return listenMany([p.rol === 'docente' ? query(all,where('active','==',true)) : all],next,error)
})
export const useActivities = () => useLive(stream,[])
export function groupLevels(group:Group, students:Student[]) {
  const ids = new Set(group.studentIds)
  const counts = new Map<string,number>()
  for (const s of students) {
    const level = s.levels?.[group.subject]?.level
    if (ids.has(s.id) && level && !s.retired && s.active !== false && !s.mergedInto) counts.set(level,(counts.get(level) ?? 0)+1)
  }
  const max = Math.max(...counts.values())
  return [...counts].filter(([,n]) => n === max).map(([level]) => level)
}
export const recommended = (a:ActivityFields,group:Group,levels:string[]) => a.active && a.subject === group.subject && a.levels.some(l => levels.includes(l))
export function validateActivity(a:ActivityFields) {
  if (a.title.trim().length < 3 || a.title.trim().length > 80) return 'Escribe un título de 3 a 80 caracteres.'
  if (!a.levels.length || !a.levels.every(l => LEVELS[a.subject]?.includes(l))) return 'Escoge al menos un nivel del área.'
  if (!Number.isInteger(a.minutes) || a.minutes < 5 || a.minutes > 120) return 'La duración debe ser de 5 a 120 minutos.'
  if (a.description.length > 1000) return 'Usa hasta 1000 caracteres en la descripción.'
  if (a.link) {
    try { if (new URL(a.link).protocol !== 'https:') return 'El enlace debe comenzar con https://.' }
    catch { return 'Escribe un enlace https válido.' }
  }
}
export const saveActivity = (fields:ActivityFields,id?:string) => api(async () => {
  const p = await caller('fundacion'), invalid = validateActivity(fields)
  if (invalid) fail(400,invalid)
  const timestamp = now(), ref = id ? doc(db,'activities',id) : doc(collection(db,'activities'))
  if (id && !(await getDoc(ref)).exists()) fail(404,'La actividad ya no está disponible.')
  const data = {...fields,title:fields.title.trim(),link:fields.link?.trim() || null,updatedAt:timestamp,
    ...(!id && {createdBy:p.uid,createdAt:timestamp})}
  return {id:ref.id,syncState:await commit(setDoc(ref,data,{merge:!!id}))}
})
export const removeActivity = (id:string) => api(async () => {
  await caller('fundacion')
  return {syncState:await commit(updateDoc(doc(db,'activities',id),{active:false,updatedAt:now()}))}
})
export function usePlan(group:Group,date:string) {
  const source = useMemo(() => withSession<(Plan & {pending:boolean})|null>(null,(p,next,error) => {
    if (p.uid !== group.teacherId || !p.schoolIds.includes(group.schoolId)) { next(null); return () => {} }
    return onSnapshot(doc(db,'groups',group.id,'plan',date),{includeMetadataChanges:true},s => next(s.exists() ? {...s.data() as Plan,pending:s.metadata.hasPendingWrites} : null),error)
  }),[group.id,group.teacherId,group.schoolId,date])
  return useLive(source,null)
}
export const planToday = (groupId:string,activityId:string) => api(async () => {
  const p = await caller('writer'), group = await groupDoc(p,groupId,true)
  if (group.data().teacherId !== p.uid) fail(403,'Selecciona uno de tus grupos.')
  const activity = (await getDoc(doc(db,'activities',activityId))).data()
  if (!activity?.active) fail(400,'La actividad ya no está disponible.')
  const date = colombiaToday(), ref = doc(group.ref,'plan',date)
  const data:Plan = {activityId,activityTitle:activity.title,schoolId:group.data().schoolId,teacherId:p.uid,date,savedAt:now()}
  return {syncState:await trackSubmission({uid:p.uid,schoolId:data.schoolId,label:'Actividad · '+data.activityTitle,date,writes:[{path:ref.path,data}]},() => setDoc(ref,data))}
})

export function useTodayPlans(date:string) {
  const source = useMemo(() => withSession<Plan[]>([], (p,next,error) =>
    listenMany(p.schoolIds.map(id => query(collectionGroup(db,'plan'),where('schoolId','==',id),
      where('teacherId','==',p.uid),where('date','==',date))),next,error)),[date])
  return useLive(source,[])
}
