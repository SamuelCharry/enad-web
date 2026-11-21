import { useMemo } from 'react'
import { useLive, withSession } from './live'
import { doc, onSnapshot, updateDoc } from 'firebase/firestore'
import { db } from './firebase'
import { api, caller, commit, fail, str } from './core'
/** Updates the one profile field a signed-in active user can edit. */
export function updateMyName(fullName: string) {
  return api(async () => {
    const p = await caller(), name = str(fullName)
    if (!name) fail(400, 'Escribe tu nombre.')
    return { ...p, fullName: name, syncState: await commit(updateDoc(doc(db, 'users', p.uid), { fullName: name })) }
  })
}

export function useProjectName(projectId: string) {
  const source = useMemo(() => withSession('', (p, next, error) => {
    if (p.projectId !== projectId || !projectId) { next(''); return () => {} }
    return onSnapshot(doc(db, 'projects', projectId), snap => next(str(snap.data()?.name)), error)
  }), [projectId])
  return useLive(source, '')
}

export function useMyProfilePending(uid: string) {
  const source = useMemo(() => withSession(false, (p, next, error) => {
    if (p.uid !== uid) { next(false); return () => {} }
    return onSnapshot(doc(db,'users',uid), { includeMetadataChanges: true }, snap => next(snap.metadata.hasPendingWrites), error)
  }), [uid])
  return useLive(source, false)
}
