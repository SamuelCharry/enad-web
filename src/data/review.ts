import { collection, deleteField, doc, query, runTransaction, where } from 'firebase/firestore'
import { db } from './firebase'
import { api, caller, fail, now, requireSchool, reportCache } from './core'
import { listenMany, useLive, withSession } from './live'
import type { Student } from '../domain/types'
import { cleanName, validateName } from '../domain/text/studentNameRules'
import { nameKey } from '../domain/nameKey'

const stream = withSession<Student[]>([],(p,next,error) => {
  const all = collection(db,'students'), review = where('needsReview','==',true)
  const queries = p.rol === 'fundacion' ? [query(all,review)] : p.rol === 'coordinador' ? p.schoolIds.map(id => query(all,where('schoolId','==',id),review)) : []
  return listenMany<Student>(queries,rows => next(rows.filter(s => !s.mergedInto).sort((a,b) => a.fullName.localeCompare(b.fullName,'es'))),error)
})
export function useReviewQueue() { return useLive(stream,[]) }
const reasons:Record<string,string> = {nuevo_docente:'Nombre registrado por un docente',ocr_baja_confianza:'La foto no se leyó con claridad',
  formato_nombre:'Revisa la escritura del nombre',solo_iniciales:'El nombre contiene iniciales',mayusculas:'El nombre estaba en mayúsculas'}
export const reviewReason = (key:string) => key.startsWith('posible_duplicado:') ? 'Puede ser un estudiante que ya está registrado' : reasons[key] || 'Revisa el nombre'
export type ReviewAction = 'aprobar'|'corregir'|'descartar'
export function reviewPatch(action:ReviewAction,uid:string,stamp:string,name?:string) {
  const base = {needsReview:false,provisional:false,reviewReasons:[],reviewedBy:uid,reviewedAt:stamp,updatedAt:stamp}
  if (action === 'descartar') return {...base,active:false}
  const fullName = cleanName(name || '')
  if (validateName(fullName).includes('formato_nombre') || fullName.length > 80) fail(400,'Escribe el nombre y los apellidos completos.')
  return {...base,fullName,nameKey:nameKey(fullName)}
}
export function resolveReview(id:string,action:ReviewAction,name?:string) {
  return api(async () => {
    const p = await caller('manager'), stamp = now(), ref = doc(db,'students',id)
    const previous = await runTransaction(db,async tx => {
      const data = (await tx.get(ref)).data()
      if (!data?.needsReview || data.mergedInto) fail(409,'Este nombre ya fue revisado.')
      await requireSchool(p,data.schoolId)
      const patch = reviewPatch(action,p.uid,stamp,action === 'aprobar' ? data.fullName : name)
      const original = Object.fromEntries(Object.keys(patch).map(k => [k,k in data ? data[k] : deleteField()]))
      tx.update(ref,patch)
      return original
    })
    reportCache.clear()
    return () => api(async () => {
      const user = await caller('manager')
      await runTransaction(db,async tx => {
        const data = (await tx.get(ref)).data()
        if (!data || data.updatedAt !== stamp || data.reviewedBy !== user.uid || data.mergedInto) fail(409,'La ficha cambió después de la revisión.')
        await requireSchool(user,data.schoolId)
        tx.update(ref,{...previous,updatedAt:now()})
      })
      reportCache.clear()
    })
  })
}
