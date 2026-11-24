import { useMemo } from 'react'
import { listenMany, useLive, withSession } from './live'
import { collectionGroup, query, where, doc, orderBy, limit, runTransaction, writeBatch, type DocumentReference, type DocumentData } from 'firebase/firestore'
import { LEVELS, MOMENTS, SUBJECTS, shouldOverwriteLevel } from '../domain/levels'
import { colombiaToday } from '../domain/weeks'
import type { Evaluation, Moment, Subject } from '../domain/types'
import { api, caller, fail, now, reportCache, isOffline } from './core'
import { db } from './firebase'
import { trackSubmission } from './pending'
import { studentDoc } from './students'

type Input = {
  studentId: string;
  subject: Subject;
  moment: Moment;
  level: string;
  groupId?: string
}
const drafts = new Map<string, string>()
/** Records the observed level without changing the student’s registration. */
export function saveEvaluation(input: Input) {
  return api(async () => {
    const p = await caller('writer')
    const { studentId, subject, moment, level, groupId } = input
    if (!MOMENTS.includes(moment)) fail(400, 'Selecciona un momento válido.')
    if (!SUBJECTS.includes(subject)) fail(400, 'La materia debe ser lectura o matemáticas.')
    if (!LEVELS[subject].includes(level)) fail(400, 'Selecciona un nivel válido para la materia.')
    const draft = JSON.stringify([p.uid, studentId, subject, moment, groupId ?? null])
    const id = drafts.get(draft) ?? crypto.randomUUID()
    drafts.set(draft, id)
    const student = await studentDoc(p, studentId)
    const date = colombiaToday(), savedAt = now(), ref = doc(student.ref, 'evaluations', id)
    const schoolId = student.data().schoolId
    const event = {
      subject,
      moment,
      level,
      sample: student.data().sample ?? null,
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
    const syncState = await trackSubmission({
      uid:p.uid, schoolId, date, label:'Evaluación · ' + student.data().fullName,
      writes:[{path:ref.path,data:event}],
      level:{path:student.ref.path,subject,moment,level}
    }, async () => {
      if (!student.metadata.fromCache) {
        try {
          await runTransaction(db, async tx => {
            const current = (await tx.get(student.ref)).data()
            if (!current) fail(404,'No encontramos al estudiante.')
            apply(tx,current)
          })
          return
        } catch (e) { if (!isOffline(e)) throw e }
      }
      const batch = writeBatch(db)
      apply(batch,student.data())
      await batch.commit()
    })
    acknowledged()
    return { id, syncState }
  })
}

/** Includes historical moments and verification events that never overwrite a current level. */
export function useSchoolEvaluations(schoolId: string, subject: Subject, moment: Moment | '', studentIds: string[]) {
  const ids = JSON.stringify([...new Set(studentIds)].sort())
  const source = useMemo(() => withSession<Evaluation[]>([], (p, next, error) => {
    if (!moment || p.rol !== 'docente' || !p.schoolIds.includes(schoolId)) {
      next([])
      return () => {}
    }
    const members: string[] = JSON.parse(ids)
    const queries = members.map(id => query(collectionGroup(db, 'evaluations'), where('schoolId','==',schoolId),
      where('studentId','==',id), where('subject','==',subject), where('moment','==',moment), orderBy('savedAt','desc'),limit(1)))
    return listenMany(queries, next, error)
  }), [schoolId, subject, moment, ids])
  return useLive(source, [])
}
