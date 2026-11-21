import { useState } from 'react'
import type { HoursEntry } from '../../domain/types'
import { colombiaToday, formatReason, parseReason, rangeOf, REASON_CATEGORIES, saveHours, useMyHours, useProgramConfig, validateHours, weekOf } from './_pending'
import { Button, Card, Field, NumberInput, TextInput } from './_pendingUi'
import { useAction } from './useAction'
import { validDay } from './formValues'
import { Choice, SessionDate } from './common'

function shortDate(day: string) { return day.slice(8, 10) + '/' + day.slice(5, 7) }
export function Hours({ schoolId }: { schoolId: string }) {
  const { config, loading, error } = useProgramConfig()
  const today = colombiaToday()
  const [date, setDate] = useState(today)
  const week = config && validDay(date, today) ? weekOf(date, config) : null
  if (error) return <p role="alert">{error}</p>
  return <>
    <SessionDate {...{ date, today, setDate }} />
    {loading ? <p>Cargando calendario…</p> : !config ? <p>Falta configurar el calendario del programa.</p> : week === null ?
      <p>Semana fuera del periodo de implementación</p> :
      <WeeklyHours {...{ date, schoolId, week, today, setDate }} {...rangeOf(week, config)} />}</>
}
function WeeklyHours({ date, schoolId, week, from, to, today, setDate }: { today:string;setDate:(date:string)=>void;date: string; schoolId: string; week: number; from: string; to: string }) {
  const { hours, loading, error } = useMyHours(from, to)
  const entries = hours.filter(h => h.schoolId === schoolId && h.date >= from && h.date <= to)
  const total = (field: 'plannedHours' | 'workedHours') => entries.reduce((sum, h) => sum + h[field], 0).toLocaleString('es-CO')
  if (error) return <p role="alert">{error}</p>
  return <Card>
    <h3>Semana {week} de implementación · del {shortDate(from)} al {shortDate(to)}</h3>
    <div className="collect-actions" role="group" aria-label="Día de la semana">
      {['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map((label, index) => {
        const day = new Date(from + 'T12:00:00Z')
        day.setUTCDate(day.getUTCDate() + index)
        const iso = day.toISOString().slice(0, 10)
        return <Button key={iso} disabled={!validDay(iso,today)} aria-pressed={date === iso} onClick={() => setDate(iso)}>{label} {day.getUTCDate()}</Button>
      })}
    </div>
    {loading ? <p>Cargando horas…</p> : <>
      <p>Total semanal: <strong>{total('workedHours')} h realizadas</strong> de {total('plannedHours')} h planeadas.</p>
      <HoursForm key={date} {...{ date, schoolId }} entry={entries.find(h => h.date === date)} />
    </>}</Card>
}
function HoursForm({ date, schoolId, entry }: { date: string; schoolId: string; entry?: HoursEntry }) {
  const [draft, setDraft] = useState<Partial<Record<'planned' | 'worked' | 'category' | 'detail', string>>>({})
  const action = useAction()
  const [receipt, setReceipt] = useState<{ previous: HoursEntry | undefined; report: HoursEntry } | null>(null)
  const current = receipt && receipt.previous === entry ? receipt.report : entry
  const stored = parseReason(current?.reason ?? '')
  const planned = draft.planned ?? String(current?.plannedHours ?? '')
  const worked = draft.worked ?? String(current?.workedHours ?? '')
  const category = draft.category ?? stored.category ?? ''
  const detail = draft.detail ?? stored.detail
  const short = worked !== '' && planned !== '' && +worked < +planned
  const reason = short ? formatReason(category, detail) : null
  const invalid = planned === '' || worked === '' ? 'Indica las horas planeadas y realizadas.' :
    +planned === 0 && +worked === 0 ? 'Las horas planeadas y realizadas no pueden ser ambas cero.' : short && (!category || !detail.trim()) ? 'Selecciona un motivo y escribe el detalle.' :
      validateHours({ planned: +planned, worked: +worked, reason })
  function change(key: keyof typeof draft, value: string) { setDraft(d => ({ ...d, [key]: value })) }
  return <form onSubmit={e => {
    e.preventDefault()
    if (!invalid) void action.run(async () => {
      const receipt = await saveHours({ date, schoolId, plannedHours: +planned, workedHours: +worked, reason })
      setReceipt({ previous: entry, report: receipt.report })
      setDraft({})
      return receipt
    }, 'Reporte de horas guardado')
  }}>
    <fieldset disabled={action.busy}>
      <div className="collect-fields">
        <Field label="Horas planeadas">
          <NumberInput required min="0" max="24" step="any" value={planned} onChange={e => change('planned', e.target.value)} />
        </Field>
        <Field label="Horas realizadas">
          <NumberInput required min="0" max="24" step="any" value={worked} onChange={e => change('worked', e.target.value)} />
        </Field>
        {short && <>
          <Choice label="Motivo" value={category} placeholder="Selecciona un motivo" options={REASON_CATEGORIES.map(id => ({ id, name: id }))} onChange={v => change('category', v)} />
          <Field label="Detalle del motivo">
            <TextInput required maxLength={480} value={detail} onChange={e => change('detail', e.target.value)} />
          </Field>
        </>}</div>
      {invalid && <p>{invalid}</p>}<Button type="submit" variant="primary" disabled={Boolean(invalid)}>Guardar horas</Button>
    </fieldset>{action.feedback}</form>
}
