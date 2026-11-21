import { useEffect, useState, useSyncExternalStore } from 'react'
import type { AttendanceStatus } from '../../domain/types'

type Marks = Record<string, AttendanceStatus>
type Sessions = Record<string, Marks>
// Only keep unsaved marks for this tab. Never share a draft across teaching accounts or schools.
const draftsByScope = new Map<string,Sessions>()
const subscribe = (listener: () => void) => {
  window.addEventListener('enad-attendance-drafts', listener)
  return () => window.removeEventListener('enad-attendance-drafts', listener)
}
export function useAttendanceDraftCount(uid: string) {
  return useSyncExternalStore(subscribe, () => {
    let count = 0
    for (const [scope, sessions] of draftsByScope) {
      if (JSON.parse(scope)[0] === uid) {
        for (const marks of Object.values(sessions)) count += Object.keys(marks).length
      }
    }
    return count
  })
}
export function draftDates(uid: string, schoolId: string, groupId: string): string[] {
  const sessions = draftsByScope.get(JSON.stringify([uid, schoolId])) ?? {}
  return Object.keys(sessions).map(key => JSON.parse(key) as [string,string])
    .filter(([group]) => group === groupId).map(([,date]) => date).sort()
}
export function useAttendanceDrafts(uid: string | undefined, schoolId: string) {
  const scope = JSON.stringify([uid, schoolId])
  const [drafts, setDrafts] = useState<Sessions>(() => uid ? draftsByScope.get(scope) ?? {} : {})
  const dirty = Object.values(drafts).some(marks => Object.keys(marks).length > 0)
  useEffect(() => {
    if (!uid || !dirty) return
    const beforeUnload = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = true }
    const beforeLink = (e: MouseEvent) => {
      if (!(e.target instanceof Element) || !e.target.closest('a[href]') || e.metaKey || e.ctrlKey) return
      if (!window.confirm('¿Salir sin guardar? Las marcas quedarán como borrador en esta pestaña.')) {
        e.preventDefault()
        e.stopPropagation()
      }
    }
    window.addEventListener('beforeunload', beforeUnload)
    document.addEventListener('click', beforeLink, true)
    return () => {
      window.removeEventListener('beforeunload', beforeUnload)
      document.removeEventListener('click', beforeLink, true)
    }
  }, [uid,dirty])
  function update(session: string, marks: Marks) {
    const next = { ...drafts }
    if (Object.keys(marks).length) next[session] = marks
    else delete next[session]
    if (uid) {
      if (Object.keys(next).length) draftsByScope.set(scope,next)
      else draftsByScope.delete(scope)
      window.dispatchEvent(new Event('enad-attendance-drafts'))
    }
    setDrafts(next)
  }
  return { drafts, update }
}
