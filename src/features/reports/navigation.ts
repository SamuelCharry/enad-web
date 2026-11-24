import { useSearchParams } from 'react-router-dom'
import type { ReportFilters } from '../../domain/types'
import { geography } from './model'

export function useReportQuery() {
  const [params, set] = useSearchParams()
  function update(changes: Record<string, string | undefined>) {
    const next = new URLSearchParams(params)
    for (const [key, value] of Object.entries(changes)) {
      if (value === undefined) next.delete(key)
      else next.set(key, value)
    }
    set(next)
  }
  return { params, update }
}
export function reportFilters(params: URLSearchParams): ReportFilters {
  return Object.fromEntries([...geography, 'from', 'to'].flatMap(k => params.get(k) ? [[k, params.get(k)]] : []))
}
export function reportLink(route: string, filters: ReportFilters, details: Record<string, string> = {}) {
  return '/portal/reportes/' + route + '?' + new URLSearchParams({ ...filters, ...details })
}
const colombianTime = new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'America/Bogota' })
export const savedTime = (value: string) => value && Number.isFinite(Date.parse(value))
  ? colombianTime.format(new Date(value))
  : 'Sin registro'
