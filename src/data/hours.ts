import { doc, getDoc, setDoc } from 'firebase/firestore'
import { weekOf } from '../domain/weeks'
import type { HoursEntry } from '../domain/types'
import { api, caller, commit, compare, configOf, fail, now, requireDate, requireSchool, str } from './core'
import { db } from './firebase'
import { useScopedRows } from './scope'

/** Own hours for the inclusive date range, most recent first. */
export function useMyHours(from: string, to: string) {
  const { data, loading, error } = useScopedRows<HoursEntry>('hours', undefined, true)
  const hours = data.filter(h => (!from || h.date >= from) && (!to || h.date <= to)).sort((a, b) => compare(b.date, a.date))
  return { hours, loading, error }
}
/** Stores a daily report under the teacher, school and date composite ID. */
export function saveHours(input: {
  date: string;
  schoolId: string;
  plannedHours: number;
  workedHours: number;
  reason?: string | null
}) {
  return api(async () => {
    const p = await caller('writer'), { date, schoolId, plannedHours, workedHours } = input
    requireDate(date)
    if (!schoolId) fail(400, 'Selecciona la institución.')
    await requireSchool(p, schoolId)
    if (![plannedHours, workedHours].every(n => Number.isFinite(n) && n >= 0 && n <= 24)) fail(400, 'Escribe horas entre 0 y 24.')
    const reason = str(input.reason) || null
    if (workedHours < plannedHours && !reason) fail(400, 'Escribe el motivo cuando las horas realizadas son menos que las programadas.')
    const week = weekOf(date, configOf(await getDoc(doc(db, 'program', 'config'))))
    const report = { teacherId: p.uid, schoolId, date, week, plannedHours, workedHours, reason, savedAt: now() }
    const id = p.uid + '_' + schoolId + '_' + date
    return { stored: true, syncState: await commit(setDoc(doc(db, 'hours', id), report)), report: { ...report, id } }
  })
}
