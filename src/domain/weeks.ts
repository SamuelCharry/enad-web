import type { ProgramConfig } from './types'
const day = 86_400_000
const iso = (ms: number) => new Date(ms).toISOString().slice(0, 10)
function monday(date: string) {
  const ms = Date.parse(date.slice(0, 10) + 'T00:00:00Z')
  if (!Number.isFinite(ms)) throw new RangeError('Fecha inválida: ' + date)
  return ms - ((new Date(ms).getUTCDay() + 6) % 7) * day
}
function onBreak(start: number, cfg: ProgramConfig) {
  const from = iso(start), to = iso(start + 6 * day)
  return cfg.breaks.some(b => b.from <= to && b.to >= from)
}
/** Started Monday–Sunday weeks, excluding weeks overlapping a break. */
export function weeksElapsed(cfg: ProgramConfig, today: string) {
  const target = monday(today)
  let count = 0
  for (let m = monday(cfg.implementationStartDate); m <= target; m += 7 * day) if (!onBreak(m, cfg)) count++
  return count
}
/** Implementation week or null before the program or during a break. */
export function weekOf(date: string, cfg: ProgramConfig) {
  return onBreak(monday(date), cfg) ? null : weeksElapsed(cfg, date) || null
}
/** Inclusive Monday and Sunday of a numbered implementation week. */
export function rangeOf(week: number, cfg: ProgramConfig) {
  if (!Number.isSafeInteger(week) || week < 1) throw new RangeError('La semana debe ser 1 o mayor.')
  let counted = 0
  for (let m = monday(cfg.implementationStartDate); ; m += 7 * day) {
    if (!onBreak(m, cfg) && ++counted === week) return { from: iso(m), to: iso(m + 6 * day) }
  }
}
/** Today's calendar date in Colombia (UTC−5). */
export function colombiaToday() { return iso(Date.now() - 5 * 3_600_000) }
