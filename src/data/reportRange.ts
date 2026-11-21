import type { ProgramConfig, ReportFilters } from '../domain/types'
import { colombiaToday, rangeOf, weeksElapsed } from '../domain/weeks'

/** During a break, use the most recent implementation week. */
export function reportRange(config: ProgramConfig, filters: ReportFilters, weeks = 1) {
  const today = colombiaToday()
  const anchor = filters.to || today
  const n = Math.max(1, weeksElapsed(config, anchor))
  const week = rangeOf(n, config)
  return {
    from: filters.from || rangeOf(Math.max(1, n - weeks + 1), config).from,
    to: filters.to || (today < week.from || today > week.to ? week.to : today)
  }
}

/** A follow-up week can be selected directly or by filtering dates. */
export function submissionWindow(config: ProgramConfig, filters: ReportFilters, requested?: number) {
  const latest = weeksElapsed(config, colombiaToday())
  const date = filters.to || filters.from
  const selected = requested && Number.isSafeInteger(requested) && requested > 0 ? requested : undefined
  const week = Math.max(1, Math.min(latest, selected ?? (date ? weeksElapsed(config, date) : latest)))
  const window = rangeOf(week, config)
  const from = filters.from && filters.from > window.from ? filters.from : window.from
  const to = filters.to && filters.to < window.to ? filters.to : window.to
  return { latest, week, range: { from, to } }
}
