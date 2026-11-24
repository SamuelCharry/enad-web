import { useEffect, useState } from 'react'
import { enableNetwork, doc, onSnapshot, runTransaction, type DocumentData } from 'firebase/firestore'
import { auth, db } from './firebase'
import { apiError, caller, commit, fail, requireSchool } from './core'
import { shouldOverwriteLevel } from '../domain/levels'
import type { Moment, Subject } from '../domain/types'

export type Mutation = { path:string; data:DocumentData; update?:boolean }
export type Submission = {
  uid:string; schoolId:string; label:string; date:string; writes:Mutation[]
  level?:{ path:string; subject:Subject; moment:Moment; level:string }
}
type Ticket = Submission & { key:string; failed?:string }
const prefix = 'enad:submission:'
const running = new Set<string>()
const fallback = new Map<string,Ticket>()
const change = () => window.dispatchEvent(new Event('enad-pending'))
function put(t:Ticket) {
  try { localStorage.setItem(t.key,JSON.stringify(t)); fallback.delete(t.key) } catch { fallback.set(t.key,t) }
  change()
}
function drop(t:Ticket) {
  fallback.delete(t.key)
  try { localStorage.removeItem(t.key) } catch { /* Storage may be disabled. */ }
  change()
}
function list(uid:string) {
  const tickets = new Map(fallback)
  try {
    for (const key of Object.keys(localStorage)) if (key.startsWith(prefix + encodeURIComponent(uid) + ':')) {
      const value = JSON.parse(localStorage.getItem(key)!) as Ticket
      if (value?.uid === uid && value.key === key && value.writes?.length) tickets.set(key,value)
    }
  } catch { /* A private browser can deny local storage. */ }
  return [...tickets.values()].filter(t => t.uid === uid)
}
export async function trackSubmission(input:Submission, write:()=>Promise<void>) {
  const key = prefix + encodeURIComponent(input.uid) + ':' + input.writes[0].path + ':' + input.writes[0].data.savedAt
  const t = {...input,key,failed:undefined}
  running.add(key)
  put(t)
  return commit(Promise.resolve().then(write).then(() => {
    drop(t)
    const saved = new Set(t.writes.map(w => w.path))
    for (const old of list(t.uid)) if (old.failed && old.writes[0].data.savedAt <= t.writes[0].data.savedAt && old.writes.every(w => saved.has(w.path))) drop(old)
  }, error => {
    put({...t,failed:apiError(error).message})
    throw error
  }).finally(() => { running.delete(key) }))
}
export function usePending(uid:string) {
  const [tickets,setTickets] = useState(() => list(uid))
  useEffect(() => {
    const refresh = () => setTickets(list(uid))
    refresh()
    window.addEventListener('enad-pending',refresh)
    window.addEventListener('storage',refresh)
    return () => { window.removeEventListener('enad-pending',refresh); window.removeEventListener('storage',refresh) }
  },[uid])
  const keys = JSON.stringify(tickets.filter(t => t.uid === uid && !t.failed && !running.has(t.key)).map(t => t.key))
  useEffect(() => {
    const selected = new Set<string>(JSON.parse(keys))
    const stops = list(uid).filter(t => selected.has(t.key)).map(t => {
      const first = t.writes[0]
      return onSnapshot(doc(db,first.path),{includeMetadataChanges:true},snap => {
        if (snap.metadata.hasPendingWrites || snap.metadata.fromCache) return
        if (snap.data()?.savedAt === first.data.savedAt) drop(t)
        else put({...t,failed:'El servidor no confirmó este registro.'})
      },error => put({...t,failed:apiError(error).message}))
    })
    return () => stops.forEach(stop => stop())
  },[uid,keys])
  return tickets.filter(t => t.uid === uid)
}
export async function retrySubmission(ticket:Ticket) {
  if (!ticket.failed || running.has(ticket.key)) return enableNetwork(db)
  const p = await caller('writer')
  if (p.uid !== ticket.uid || auth.currentUser?.uid !== ticket.uid) fail(403,'Cambia a la cuenta que hizo el registro.')
  await requireSchool(p,ticket.schoolId)
  return trackSubmission(ticket, () => runTransaction(db, async tx => {
    const records = ticket.writes.filter(w => !w.update)
    const existing = await Promise.all(records.map(w => tx.get(doc(db,w.path))))
    const level = ticket.level
    const student = level && doc(db,level.path)
    const current = student && (await tx.get(student)).data()
    if (level && (!current || current.schoolId !== ticket.schoolId || current.mergedInto)) fail(409,'Revisa la ficha del estudiante.')
    for (const [i,write] of records.entries()) {
      const remote = existing[i].data()
      if (remote?.savedAt && remote.savedAt >= write.data.savedAt) continue
      tx.set(doc(db,write.path),write.data)
      if (write.data.status === 'retirado' && write.data.studentId) {
        tx.update(doc(db,'students',write.data.studentId),{retired:true,updatedAt:write.data.savedAt})
      }
      if (level && student && shouldOverwriteLevel(current?.levels?.[level.subject]?.moment,level.moment)) {
        tx.update(student,{['levels.' + level.subject]:{level:level.level,moment:level.moment,date:ticket.date},updatedAt:write.data.savedAt})
      }
    }
  }))
}
