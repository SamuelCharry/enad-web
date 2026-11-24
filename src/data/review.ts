import { collection, deleteField, doc, query, runTransaction, where } from 'firebase/firestore'
import { db } from './firebase'
import { api, caller, fail, now, requireSchool, reportCache } from './core'
import { listenMany, useLive, withSession } from './live'
import type { Student } from '../domain/types'
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
  if (action === 'aprobar') return base
  const particles = new Set(['de','del','la','las','los','y'])
  const fullName = (name || '').normalize('NFC').toLocaleLowerCase('es').split(/\s+/u).map(token => {
    const word = token.replace(/’/g,"'").replace(/[^\p{L}\p{M}'-]/gu,'').match(/\p{L}[\p{L}\p{M}]*(?:['-]\p{L}[\p{L}\p{M}]*)*/gu)?.join('') || ''
    return particles.has(word) ? word : word.replace(/(^|['-])(\p{L})/gu,(_,separator:string,letter:string) => separator+letter.toLocaleUpperCase('es'))
  }).filter(Boolean).join(' ')
  const words = fullName.split(' '), letters = fullName.match(/\p{L}/gu)?.length || 0
  if (words.length < 2 || words.length > 6 || letters < 3 || letters > 60 || words.some(w => !/^\p{L}+(?:[-'’]\p{L}+)*$/u.test(w) || (w.length === 1 && w.toLowerCase() !== 'y'))) fail(400,'Escribe el nombre y los apellidos completos.')
  return {...base,fullName,nameKey:nameKey(fullName)}
}
export function resolveReview(id:string,action:ReviewAction,name?:string) {
  return api(async () => {
    const p = await caller('manager'), stamp = now(), ref = doc(db,'students',id)
    const previous = await runTransaction(db,async tx => {
      const data = (await tx.get(ref)).data()
      if (!data?.needsReview || data.mergedInto) fail(409,'Este nombre ya fue revisado.')
      await requireSchool(p,data.schoolId)
      const patch = reviewPatch(action,p.uid,stamp,name)
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
