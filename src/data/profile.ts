import { doc, updateDoc } from 'firebase/firestore'
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
