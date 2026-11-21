import { doc, runTransaction, writeBatch, type DocumentReference, type DocumentData } from 'firebase/firestore'
import { LEVELS, MOMENTS, SUBJECTS, shouldOverwriteLevel } from '../domain/levels'
import { colombiaToday } from '../domain/weeks'
import type { Moment, Subject } from '../domain/types'
import { api, caller, commit, fail, now, reportCache, isOffline } from './core'
import { db } from './firebase'
import { patchStudent, studentDoc } from './students'

type Input = {
  studentId: string;
  subject: Subject;
  moment: Moment;
  level: string;
  sample: number | null;
  gender: string;
  age: number | null;
  groupId?: string
}
const drafts = new Map<string, string>()
/** Saves demographics followed by a retry-safe evaluation and its current level. */
export function saveEvaluation(input: Input) {
  return api(async () => {
    const p = await caller('writer')
    const { studentId, subject, moment, level, sample, gender, age, groupId } = input
    if (!MOMENTS.includes(moment) || !['F', 'M'].includes(gender) || age == null || !Number.isInteger(age) || age < 5 || age > 18 || sample == null || !Number.isInteger(sample) || sample < 1 || sample > 4)
      fail(400, 'Revisa el momento, el sexo, la edad y la muestra.')
    if (!SUBJECTS.includes(subject)) fail(400, 'La materia debe ser lectura o matemáticas.')
    if (!LEVELS[subject].includes(level)) fail(400, 'Selecciona un nivel válido para la materia.')
    const draft = JSON.stringify([p.uid, studentId, subject, moment, groupId ?? null])
    const id = drafts.get(draft) ?? crypto.randomUUID()
    drafts.set(draft, id)
    await patchStudent(studentId, { gender, age, sample })
    const student = await studentDoc(p, studentId)
    const date = colombiaToday(), savedAt = now(), ref = doc(student.ref, 'evaluations', id)
    const schoolId = student.data().schoolId
    const event = {
      subject,
      moment,
      level,
      sample,
      teacherId: p.uid,
      ...(groupId ? { groupId } : {}),
      date,
      savedAt,
      schoolId,
      studentId
    }
    function apply(writer: {
      set(ref: DocumentReference, data: DocumentData): unknown;
      update(ref: DocumentReference, data: DocumentData): unknown
    }, current: DocumentData) {
      if (current.schoolId !== schoolId) fail(403, 'No tienes acceso a esta institución.')
      writer.set(ref, event)
      if (shouldOverwriteLevel(current.levels?.[subject]?.moment, moment)) {
        writer.update(student.ref, { ['levels.' + subject]: { level, date, moment }, updatedAt: savedAt })
      }
    }
    function acknowledged() {
      if (drafts.get(draft) === id) drafts.delete(draft)
      reportCache.clear()
    }
    // On a connected client, recheck the level if a phone writes after our read.
    if (!student.metadata.fromCache) {
      try {
        await runTransaction(db, async tx => {
          const current = (await tx.get(student.ref)).data()
          if (!current) fail(404, 'No encontramos al estudiante.')
          apply(tx, current)
        })
        acknowledged()
        return { id, syncState: 'synced' as const }
      } catch (error) {
        if (!isOffline(error)) throw error
      }
    }
    // A local batch keeps the event and the cached level together while offline.
    const batch = writeBatch(db)
    apply(batch, student.data())
    const syncState = await commit(batch.commit().then(acknowledged))
    return { id, syncState }
  })
}
