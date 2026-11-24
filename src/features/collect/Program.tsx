import { classDate, validCalendarDay } from '../../domain/weeks'
import { LoadError } from '../../ui/LoadError'
import { useState } from 'react'
import type { ProgramConfig } from '../../domain/types'
import { saveProgramConfig } from '../../data/admin'
import { useProgramConfig } from '../../data/scope'
import { Button, Card, DateInput, Dialog, Field, NumberInput, TextInput } from '../../ui/components'
import { savedNotice } from './admin/notice'
import { useAction } from './useAction'

function blank(): ProgramConfig { return { projectName: '', year: 0, implementationStartDate: '', breaks: [] } }
function issue(cfg: ProgramConfig) {
  if (!cfg.projectName.trim() || !Number.isInteger(cfg.year) || cfg.year < 1900 || cfg.year > 2200 || !validCalendarDay(cfg.implementationStartDate)) return 'Revisa el proyecto, el año y la fecha de inicio.'
  if (cfg.year !== Number(cfg.implementationStartDate.slice(0,4))) return 'El año del programa debe coincidir con la fecha de inicio.'
  if (cfg.breaks.some(b => !b.label.trim() || !validCalendarDay(b.from) || !validCalendarDay(b.to) || b.to < b.from)) return 'Cada pausa requiere un nombre y un intervalo de fechas válido.'
  return ''
}
export function Program() {
  const { config, loading, error } = useProgramConfig()
  const [form, setForm] = useState<ProgramConfig | null>(null)
  const [notice,setNotice] = useState('')
  const action = useAction()
  if (error) return <LoadError message={error} />
  return <>
    {loading ? <p>Cargando calendario…</p> : config ? <Card>
      <h3>{config.projectName} · {config.year}</h3>
      <p>Inicio de implementación · {classDate(config.implementationStartDate)}</p>
      {config.breaks.map((b, i) => <p key={i}>{b.label} · {classDate(b.from)} al {classDate(b.to)}</p>)}<Button onClick={() => setForm(config)}>Editar configuración</Button>
    </Card> :
      <Button onClick={() => setForm(blank())}>Crear configuración</Button>}
    {notice && <p role="status">{notice}</p>}
    {form && <Dialog title="Configuración del programa" onClose={() => setForm(null)} busy={action.busy}>
      <form noValidate onSubmit={e => {
        e.preventDefault()
        void action.run(async () => {
          const problem = issue(form)
          if (problem) throw new Error(problem)
          if (config && !window.confirm('¿Actualizar el calendario del programa? La fecha de inicio y las pausas determinan las semanas de los informes.')) return
          const result = await saveProgramConfig(form)
          setNotice(savedNotice(result))
          setForm(null)
        }, '')
      }}>
        <fieldset disabled={action.busy}>
          <Field label="Nombre del proyecto">
            <TextInput required value={form.projectName} onChange={e => setForm({ ...form, projectName: e.target.value })} />
          </Field>
          <Field label="Año del programa">
            <NumberInput required min={1900} max={2200} value={form.year || ''} onChange={e => setForm({ ...form, year: +e.target.value })} />
          </Field>
          <Field label="Fecha de inicio de implementación">
            <DateInput required value={form.implementationStartDate} onChange={e => setForm({ ...form, implementationStartDate: e.target.value })} />
          </Field>
          <h3>Pausas y vacaciones</h3>{form.breaks.map((b, i) => <fieldset key={i}>
            <legend>Pausa {i + 1}</legend>{(['label', 'from', 'to'] as const).map((key, k) => {
              const Input = key === 'label' ? TextInput : DateInput
              return <Field key={key} label={['Nombre de la pausa', 'Desde', 'Hasta'][k]}>
                <Input required value={b[key]} min={key === 'to' ? b.from : undefined} onChange={e => setForm({ ...form, breaks: form.breaks.map((v, j) => i === j ? { ...v, [key]: e.target.value } : v) })} />
              </Field>
            })}<Button onClick={() => setForm({ ...form, breaks: form.breaks.filter((_, j) => j !== i) })}>Quitar pausa</Button>
          </fieldset>)}
          <div className="collect-actions">
            <Button onClick={() => setForm({ ...form, breaks: [...form.breaks, { label: '', from: '', to: '' }] })}>Añadir pausa</Button>
            <Button type="submit" variant="primary">Guardar configuración</Button>
          </div>
        </fieldset>{action.feedback}</form>
    </Dialog>}</>
}
