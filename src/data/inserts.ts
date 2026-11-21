import { runTransaction, writeBatch, type DocumentReference } from 'firebase/firestore'
import { commit, isOffline, reportCache } from './core'
import { db } from './firebase'

/** New record whose absence was checked in a school-scoped snapshot. */
export interface Insert { ref: DocumentReference; data: Record<string, unknown> }

/** Inserts one page; admins can also recheck individual missing documents inside a transaction. */
export async function insertPage(page: Insert[], admin: boolean) {
  if (admin) {
    try {
      const created = await runTransaction(db, async tx => {
        const snapshots = await Promise.all(page.map(record => tx.get(record.ref)))
        const ids = new Set<string>()
        page.forEach((record, index) => {
          if (snapshots[index].exists()) return
          tx.set(record.ref, record.data)
          ids.add(record.ref.id)
        })
        return ids
      })
      reportCache.clear()
      return { created, syncState: 'synced' as const }
    } catch (error) {
      if (!isOffline(error)) throw error
    }
  }
  // Teacher rules permit a scoped roster query, but deny get() on an absent
  // student since it has no schoolId. Use the mobile batch path in that case.
  const batch = writeBatch(db)
  for (const record of page) batch.set(record.ref, record.data)
  return { created: new Set(page.map(record => record.ref.id)), syncState: await commit(batch.commit()) }
}
