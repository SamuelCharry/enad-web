import { runTransaction, writeBatch, type DocumentReference } from 'firebase/firestore'
import { commit, isOffline, reportCache } from './core'
import { db } from './firebase'

/** Record with a deterministic or client-generated document reference. */
export interface Insert { ref: DocumentReference; data: Record<string, unknown> }

/** Recheck absence atomically when individual document reads are authorized. */
export async function insertPage(page: Insert[], checkIndividual: boolean) {
  if (checkIndividual) {
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
  const batch = writeBatch(db)
  for (const record of page) batch.set(record.ref, record.data)
  return { created: new Set(page.map(record => record.ref.id)), syncState: await commit(batch.commit()) }
}
