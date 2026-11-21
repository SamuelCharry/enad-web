import { arrayRemove, arrayUnion, doc, runTransaction } from 'firebase/firestore'
import { nameKey } from '../domain/nameKey'
import type { Group, School, Student } from '../domain/types'
import { api, caller, fail, isOffline, now, reportCache } from './core'
import { db } from './firebase'
import { studentFields, type StudentFields } from './studentFields'

/** Apply only the edited membership deltas. A failed transfer leaves the roster and all groups intact. */
export function saveStudentAssignment(student: Student, fields: StudentFields, before: string[], after: string[]) {
  return api(async () => {
    await caller('admin')
    const patch = studentFields(fields)
    const removed = new Set(before.filter(id => !after.includes(id)))
    const added = new Set(after.filter(id => !before.includes(id)))
    const changed = [...removed, ...added]
    if (changed.length + 1 > 400) fail(400, 'Cambia menos grupos en una sola operación.')
    const ref = doc(db, 'students', student.id), timestamp = now()
    try {
      await runTransaction(db, async tx => {
        const [current, school, ...groups] = await Promise.all([
          tx.get(ref), tx.get(doc(db, 'schools', student.schoolId)), ...changed.map(id => tx.get(doc(db, 'groups', id)))
        ])
        if (!current.exists() || current.data().schoolId !== student.schoolId || !school.exists()) fail(404, 'No encontramos al estudiante o su institución.')
        const campuses = (school.data() as School).campuses ?? []
        const site = patch.campus ?? current.data().campus
        if (site && site !== student.campus && !campuses.some(c => c.id === site)) fail(400, 'Selecciona una sede de la institución.')
        const stored = current.data()
        const original = { campus: '', gender: '', retired: false, nameKey: nameKey(stored.fullName ?? ''), ...stored }
        for (const key of Object.keys(patch) as (keyof typeof patch)[]) {
          if ((original[key as keyof typeof original] ?? null) !== (student[key] ?? null)) fail(409, 'El registro cambió. Cierra el editor y revisa los datos actuales.')
        }
        for (const g of groups) {
          const data = g.data() as Group | undefined
          if (!data || data.schoolId !== student.schoolId) fail(400, 'El grupo ya no pertenece a esta institución.')
          const campus = campuses.find(c => c.id === site || c.name === site)
          if (added.has(g.id) && data.campus !== site && (!campus || (data.campus !== campus.name && data.campus !== campus.id))) fail(400, 'El grupo pertenece a otra sede.')
        }
        tx.update(ref, { ...patch, updatedAt: timestamp })
        groups.forEach(g => tx.update(g.ref, { studentIds: added.has(g.id) ? arrayUnion(student.id) : arrayRemove(student.id), updatedAt: timestamp }))
      })
    } catch (e) {
      if (isOffline(e)) fail(503, 'Se necesita conexión para guardar el traslado. Conserva el formulario y vuelve a intentarlo.')
      throw e
    }
    reportCache.clear()
    return { syncState: 'synced' as const }
  })
}
