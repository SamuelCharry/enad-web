import type { HoursEntry, ProgramConfig } from '../../domain/types'
import { weekOf } from '../../domain/weeks'
import { shiftDay } from '../reports/model'

export function hourSeries(rows: HoursEntry[], monday: string, week: number, config: ProgramConfig) {
  const days = ['Lun','Mar','Mié','Jue','Vie','Sáb','Dom'].map((label, i) => {
    const entry = rows.find(r => r.date === shiftDay(monday, i))
    return { label: label + (!entry ? ' · Sin reporte' : entry.plannedHours === 0 ? ' · Sin programación' : ' · Programado'), value: entry?.workedHours ?? 0 }
  })
  const totals = new Map<number, number>()
  for (const row of rows) {
    const number = weekOf(row.date, config)
    if (number !== null) totals.set(number, (totals.get(number) ?? 0) + row.workedHours)
  }
  let accumulated = 0
  const weeks = Array.from({ length: Math.min(4,week) }, (_,i) => {
    const number = Math.max(1,week - 3) + i
    accumulated += totals.get(number) ?? 0
    return { label: 'Semana ' + number, value: accumulated }
  })
  return { days, weeks }
}
