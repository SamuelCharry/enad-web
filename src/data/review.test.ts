import { beforeEach, expect, it, vi } from 'vitest'
import { resolveReview, reviewReason } from './review'
const data = vi.hoisted(() => ({student:{} as Record<string,unknown>,p:{uid:'c',rol:'coordinador',schoolIds:['s']}}))
vi.mock('./firebase',() => ({db:{}}))
vi.mock('./core',async original => ({...await original<typeof import('./core')>(),caller:async () => data.p}))
vi.mock('firebase/firestore',async original => ({...await original<typeof import('firebase/firestore')>(),
  doc:(_db:unknown,path:string,id:string) => path+'/'+id,
  runTransaction:(_db:unknown,work:(tx:object)=>Promise<unknown>) => work({
    get:async () => ({data:() => data.student}), update:(_r:string,patch:object) => Object.assign(data.student,patch)
  })
}))
beforeEach(() => {data.student={schoolId:'s',fullName:'ANA PAZ',nameKey:'ana paz',active:true,needsReview:true,provisional:true,reviewReasons:['mayusculas']}})
it('approves and audits the same student, with guarded undo',async () => {
  const undo = await resolveReview('id','aprobar')
  expect(data.student).toMatchObject({needsReview:false,provisional:false,reviewedBy:'c',active:true})
  await undo()
  expect(data.student).toMatchObject({needsReview:true,provisional:true,reviewReasons:['mayusculas']})
})
it('corrects the name and search key together, and does not undo a subsequent edit',async () => {
  await expect(resolveReview('id','corregir','A.')).rejects.toMatchObject({status:400})
  const undo = await resolveReview('id','corregir',' MARÍA  PAZ2 ')
  expect(data.student).toMatchObject({fullName:'María Paz',nameKey:'maria paz',needsReview:false})
  data.student.updatedAt='later'
  await expect(undo()).rejects.toMatchObject({status:409})
})
it('discards without deleting history and rejects merged or out-of-scope students',async () => {
  data.student.schoolId='elsewhere'
  await expect(resolveReview('id','descartar')).rejects.toMatchObject({status:403})
  data.student.schoolId='s'
  await resolveReview('id','descartar')
  expect(data.student).toMatchObject({active:false,needsReview:false})
  await expect(resolveReview('id','aprobar')).rejects.toMatchObject({status:409})
  expect(reviewReason('posible_duplicado:s1')).toMatch(/estudiante/)
})
