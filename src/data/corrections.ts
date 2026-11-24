import { doc, runTransaction, type DocumentData } from 'firebase/firestore'
import { api, caller, fail, now, requireDate, reportCache, requireSchool } from './core'
import { db } from './firebase'
import { LEVELS, shouldOverwriteLevel } from '../domain/levels'
import type { AttendanceMark, AttendanceStatus, Evaluation, HoursEntry } from '../domain/types'
import { colombiaToday } from '../domain/weeks'
import { validateHours } from '../domain/hoursReason'

export type Correction =
  | {kind:'attendance'; record:AttendanceMark & {id:string}; status:AttendanceStatus}
  | {kind:'evaluations'; record:Evaluation; level:string}
  | {kind:'hours'; record:HoursEntry & {id:string}; planned:number; worked:number; reason:string|null}

export function correctRecord(input:Correction) {
  return api(async () => {
    const user = await caller('manager')
    const record = input.record, savedAt = now()
    await requireSchool(user,record.schoolId)
    const student = input.kind === 'hours' ? undefined : doc(db,'students',input.record.studentId)
    const target = student ? doc(student,input.kind,record.id) : doc(db,'hours',record.id)
    await runTransaction(db,async tx => {
      const previous = (await tx.get(target)).data()
      if (!previous || previous.schoolId !== record.schoolId || previous.savedAt !== record.savedAt) fail(409,'El registro cambió. Actualiza la tabla antes de corregirlo.')
      const current = student && (await tx.get(student)).data()
      if (student && (!current || current.schoolId !== record.schoolId || current.mergedInto)) fail(409,'Revisa la ficha actual del estudiante.')
      let patch:DocumentData
      switch (input.kind) {
        case 'hours': {
          if (requireDate(record.date) > colombiaToday()) fail(400,'Elige una fecha hasta hoy.')
          const reason = input.worked < input.planned ? input.reason : null
          const issue = validateHours({planned:input.planned,worked:input.worked,reason})
          if (issue) fail(400,issue)
          patch = {plannedHours:input.planned,workedHours:input.worked,reason}
          break
        }
        case 'attendance':
          if (!['vino','no_vino','retirado'].includes(input.status)) fail(400,'Elige una marca de asistencia.')
          patch = {status:input.status}
          if (input.status === 'retirado') tx.update(student!,{retired:true,updatedAt:savedAt})
          break
        case 'evaluations': {
          const subject = input.record.subject, moment = input.record.moment
          if (!LEVELS[subject]?.includes(input.level)) fail(400,'Elige un nivel del área.')
          patch = {level:input.level}
          if (shouldOverwriteLevel(current?.levels?.[subject]?.moment,moment)) {
            tx.update(student!,{['levels.'+subject]:{level:input.level,moment,date:input.record.date},updatedAt:savedAt})
          }
          break
        }
      }
      tx.update(target,{...patch,savedAt})
    })
    reportCache.clear()
  })
}
