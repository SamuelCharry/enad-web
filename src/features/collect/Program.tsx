import { LoadError } from '../../ui/LoadError'
import { useState } from 'react'
import type { ProgramConfig } from '../../domain/types'
import { saveProgramConfig } from '../../data/admin'
import { useProgramConfig } from '../../data/scope'
import { Button, Card, DateInput, Dialog, Field, NumberInput, Table, TextInput } from '../../ui/components'
import { savedNotice } from './admin/notice'
import { useAction } from './useAction'
import { matches } from './formValues'
import { Search } from './common'
import { Pager } from './FileImport'
import { download } from './formValues'

const columns = ['Proyecto', 'Año', 'Inicio de implementación', 'Pausa', 'Desde', 'Hasta']
function blank(): ProgramConfig { return { projectName: '', year: 0, implementationStartDate: '', breaks: [] } }
function validDate(s: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(s) && Number.isFinite(Date.parse(s)) && new Date(s).toISOString().slice(0, 10) === s
}
function issue(cfg: ProgramConfig) {
  if (!cfg.projectName.trim() || !Number.isInteger(cfg.year) || cfg.year < 1900 || cfg.year > 2200 || !validDate(cfg.implementationStartDate)) return 'Revisa el proyecto, el año y la fecha de inicio.'
  if (cfg.breaks.some(b => !b.label.trim() || !validDate(b.from) || !validDate(b.to) || b.to < b.from)) return 'Cada pausa requiere un nombre y un intervalo de fechas válido.'
  return ''
}
export function Program() {
  const { config, loading, error } = useProgramConfig()
  const [q, setQ] = useState('')
  const [form, setForm] = useState<ProgramConfig | null>(null)
  const [importing, setImporting] = useState(false)
  const [notice,setNotice] = useState('')
  const action = useAction()
  const visible = config && matches(q, config.projectName, config.year, config.implementationStartDate, ...config.breaks.map(b => b.label))
  if (error) return <LoadError message={error} />
  return <>
    <div className="collect-toolbar">
      <Search value={q} onChange={setQ} />
      <Button onClick={() => setImporting(true)}>Importar archivo</Button>
    </div>
    {loading ? <p>Cargando calendario…</p> : visible && config ? <Card>
      <h3>{config.projectName} · {config.year}</h3>
      <p>Inicio de implementación: {config.implementationStartDate}</p>
      {config.breaks.map((b, i) => <p key={i}>{b.label} · {b.from} al {b.to}</p>)}<Button onClick={() => setForm(config)}>Editar configuración</Button>
    </Card> :
      !config ? <Button onClick={() => setForm(blank())}>Crear configuración</Button> : <p>Sin coincidencias.</p>}
    {notice && <p role="status">{notice}</p>}{importing && <ProgramImport onClose={message => {setImporting(false);setNotice(message || '')}} />}
    {form && <Dialog title="Configuración del programa" onClose={() => setForm(null)} busy={action.busy}>
      <form onSubmit={e => {
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
// The program is a singleton. Preview the whole calendar, then submit one saveProgramConfig.
function ProgramImport({ onClose }: { onClose: (message?:string) => void }) {
  const [rows, setRows] = useState<string[][]>([])
  const [page, setPage] = useState(0)
  const action = useAction()
  const configs = rows.map(cells => ({ projectName: cells[0], year: Number(cells[1]), implementationStartDate: cells[2], breaks: cells.slice(3).some(Boolean) ? [{ label: cells[3], from: cells[4], to: cells[5] }] : [] }))
  const issues = configs.map(c => issue(c) || (c.projectName !== configs[0].projectName || c.year !== configs[0].year || c.implementationStartDate !== configs[0].implementationStartDate ? 'Todas las filas deben corresponder al mismo programa.' : ''))
  async function read(file: File) {
    setRows([])
    setPage(0)
    if (!/\.(xlsx|csv)$/i.test(file.name)) throw new Error('Selecciona un archivo .xlsx o .csv.')
    const XLSX = await import('xlsx')
    const book = XLSX.read(await file.arrayBuffer(), { type: 'array', raw: true })
    const sheet = book.Sheets[book.SheetNames[0]]
    if (!sheet || Object.values(sheet).some(c => typeof c === 'object' && c && 'f' in c)) throw new Error('Usa la plantilla con valores sin fórmulas.')
    const [header, ...grid] = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1, raw: false, defval: '', blankrows: false })
    if (!header || header.length !== columns.length || columns.some((s, i) => s !== header[i])) throw new Error('Usa las columnas de la plantilla de configuración.')
    if (!grid.length) throw new Error('Añade al menos una fila a la plantilla.')
    setRows(grid.map(r => columns.map((_, i) => String(r[i] ?? '').trim())))
  }
  return <Dialog title="Importar calendario del programa" onClose={() => onClose()} busy={action.busy}>
    <fieldset disabled={action.busy}>
      <Button onClick={() => action.run(async () => {
        const x = await import('xlsx')
        const book = x.utils.book_new()
        x.utils.book_append_sheet(book, x.utils.aoa_to_sheet([columns]), 'Plantilla')
        download(new Blob([x.write(book, { type: 'array', bookType: 'xlsx' })]), 'Calendario ENAd.xlsx')
      }, 'Plantilla descargada')}>Descargar plantilla</Button>
      <p>Usa una fila por pausa, repite los datos del programa y escribe las fechas como AAAA-MM-DD. Al importar se reemplaza el calendario completo.</p>
      <Field label="Archivo de Excel o CSV">
        <TextInput type="file" accept=".csv,.xlsx" onChange={e => {
          const f = e.target.files?.[0]
          e.target.value = ''
          if (f) void action.run(() => read(f), '')
        }} />
      </Field>
      {rows.length > 0 && <>
        <Table caption="Vista previa del calendario" headers={[...columns, 'Validación']} rows={rows.slice(page * 20, page * 20 + 20).map((r, i) => ({ key: String(i), cells: [...r, issues[page * 20 + i] || 'Válida'] }))} />
        <Pager {...{ page, setPage }} count={rows.length} />
        <Button variant="primary" disabled={issues.some(Boolean)} onClick={() => action.run(async () => {
          if (!window.confirm('¿Reemplazar el calendario completo con las fechas y pausas del archivo?')) return
          const result = await saveProgramConfig({ ...configs[0], breaks: configs.flatMap(c => c.breaks) })
          onClose(savedNotice(result))
        }, '')}>Aplicar calendario</Button>
      </>}</fieldset>{action.feedback}</Dialog>
}
