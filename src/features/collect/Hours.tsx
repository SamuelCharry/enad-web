import { LoadError } from '../../ui/LoadError'
import { useState } from 'react'
import type { HoursEntry, ProgramConfig } from '../../domain/types'
import { saveHours, useMyHours } from '../../data/hours'
import { useProgramConfig } from '../../data/scope'
import { cleanDetail, formatReason, parseReason, REASON_CATEGORIES, validateHours } from '../../domain/hoursReason'
import { colombiaToday, rangeOf, weekOf } from '../../domain/weeks'
import { Button, Card, Dialog, SyncStatus, Field, NumberInput, TextInput } from '../../ui/components'
import { useAction } from './useAction'
import { validDay } from './formValues'
import { Choice, SessionDate } from './common'

import { BarChart } from '../../ui/charts'
import { useGuideReceipt } from '../teacher/guideContext'
import { hourSeries } from '../teacher/hourSeries'

function shortDate(day: string) { return day.slice(8, 10) + '/' + day.slice(5, 7) }
export function Hours({ schoolId }: { schoolId: string }) {
  const { config, loading, error } = useProgramConfig()
  const today = colombiaToday()
  const [date, setDate] = useState(today)
  const week = config && validDay(date, today) ? weekOf(date, config) : null
  if (error) return <LoadError message={error} />
  return <>
    <SessionDate {...{ date, today, setDate }} />
    {loading ? <p>Cargando calendario…</p> : !config ? <p>Falta configurar el calendario del programa.</p> : week === null ?
      <p>Semana fuera del periodo de implementación</p> :
      <WeeklyHours {...{ date, schoolId, week, today, setDate, config }} {...rangeOf(week, config)} />}</>
}
function WeeklyHours({ date, schoolId, week, from, to, today, setDate, config }: { config: ProgramConfig; today:string;setDate:(date:string)=>void;date: string; schoolId: string; week: number; from: string; to: string }) {
  const { hours, loading, error } = useMyHours(rangeOf(Math.max(1,week - 3),config).from, to)
  const entries = hours.filter(h => h.schoolId === schoolId && h.date >= from && h.date <= to)
  const series = hourSeries(hours.filter(h => h.schoolId === schoolId), from, week, config)
  const total = (field: 'plannedHours' | 'workedHours') => entries.reduce((sum, h) => sum + h[field], 0).toLocaleString('es-CO')
  if (error) return <LoadError message={error} />
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
      <h3>Historial de horas</h3>
      {hours.filter(h => h.schoolId === schoolId).map(h => <p key={h.date}>{h.date} · {h.workedHours} h realizadas de {h.plannedHours} h planeadas</p>)}
      {!hours.some(h => h.schoolId === schoolId) && <p>Todavía no has registrado horas en estas semanas.</p>}
      <BarChart label="Horas realizadas por día" data={series.days} />
      <BarChart label="Horas acumuladas por semana de implementación" data={series.weeks} />
    </>}</Card>
}
function HoursForm({ date, schoolId, entry }: { date: string; schoolId: string; entry?: HoursEntry }) {
  const [draft, setDraft] = useState<Partial<Record<'planned' | 'worked' | 'category' | 'detail', string>>>({})
  const action = useAction()
  const guideSaved = useGuideReceipt()
  const [receipt, setReceipt] = useState<{ previous: HoursEntry | undefined; report: HoursEntry & { syncState: string } } | null>(null)
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
  const [confirm, setConfirm] = useState(false)
  function save() {
    setConfirm(false)
    void action.run(async () => {
      const receipt = await saveHours({ date, schoolId, plannedHours: +planned, workedHours: +worked, reason })
      setReceipt({ previous: entry, report: { ...receipt.report, syncState: receipt.syncState } })
      setDraft({})
      guideSaved?.(receipt.syncState === 'pending')
    }, '')
  }
  return <form onSubmit={e => {
    e.preventDefault()
    if (!invalid) { if (current) setConfirm(true); else save() }
  }}>
    {(current || Object.keys(draft).length > 0) && <SyncStatus dirty={Object.keys(draft).length > 0} pending={!!current && 'syncState' in current && current.syncState === 'pending'} />}
    <fieldset disabled={action.busy}>
      <div className="collect-fields">
        <Field label="Horas planeadas">
          <NumberInput data-guide="planned" required min="0" max="24" step="0.5" value={planned} onChange={e => change('planned', e.target.value)} />
        </Field>
        <Field label="Horas realizadas">
          <NumberInput data-guide="worked" required min="0" max="24" step="0.5" value={worked} onChange={e => change('worked', e.target.value)} />
        </Field>
        {short && <>
          <Choice label="Motivo" value={category} placeholder="Selecciona un motivo" options={REASON_CATEGORIES.map(id => ({ id, name: id }))} onChange={v => change('category', v)} />
          <Field label="Detalle del motivo" hint={detail.length + " de 200 caracteres"}>
            <TextInput data-guide="reason" data-complete={!!category && !!detail.trim()} required maxLength={200} value={detail} onChange={e => change('detail', cleanDetail(e.target.value))} />
          </Field>
        </>}</div>
      {invalid && <p>{invalid}</p>}<div className="teacher-save"><Button data-guide="save" type="submit" variant="primary" disabled={Boolean(invalid)}>Guardar horas</Button></div>
    </fieldset>{action.feedback}
    {confirm && <Dialog title="¿Actualizar las horas de este día?" onClose={() => setConfirm(false)}><p>El nuevo reporte reemplazará las horas del {date}.</p>
      <Button variant="primary" onClick={save}>Reemplazar reporte</Button></Dialog>}</form>
}
