import { useState } from 'react'
import type { School, Student } from '../../domain/types'
import { addStudentsToGroup, adminImport, buildImportTemplate, importColumns, importStudents, parseImport, useGroups, type ImportKind, type ImportRow } from './_pending'
import { Button, Dialog, Field, TextInput, Table } from './_pendingUi'
import { useAction } from './useAction'

import { download } from './formValues'
import { Choice } from './common'
type ImportResult = Awaited<ReturnType<typeof adminImport>>
export function Credentials({ items }: { items: { username: string; password: string }[] }) {
  const copy = useAction()
  const text = items.map(c => 'Usuario: ' + c.username + '\nContraseña: ' + c.password).join('\n\n')
  return <section>
    <h3>Credenciales generadas</h3>
    <pre>{text}</pre>
    <Button onClick={() => copy.run(() => navigator.clipboard.writeText(text), 'Credenciales copiadas')}>Copiar credenciales</Button>{copy.feedback}</section>
}
export function Pager({ page, count, setPage }: { page: number; count: number; setPage: (p: number) => void }) {
  const pages = Math.ceil(count / 20)
  return pages > 1 && <div className="collect-actions">
    <Button disabled={page === 0} onClick={() => setPage(page - 1)}>Anterior</Button>
    <span>Página {page + 1} de {pages}</span>
    <Button disabled={page + 1 >= pages} onClick={() => setPage(page + 1)}>Siguiente</Button>
  </div>
}
export function FileImport({ kind, schools, scope, onClose }: { kind: ImportKind; schools: School[]; scope?: { schoolId: string; campus: string; students: Student[] }; onClose: () => void }) {
  const [rows, setRows] = useState<ImportRow[]>([])
  const [page, setPage] = useState(0)
  const [createdIds, setCreatedIds] = useState<string[]>([])
  const [result, setResult] = useState<ImportResult | null>(null)
  const action = useAction()
  const valid = rows.filter(r => !r.errors.length)
  const columns = importColumns[kind] ?? []
  async function read(file: File) {
    setRows([])
    setPage(0)
    setResult(null)
    setCreatedIds([])
    const preview = await parseImport({ kind, schools, filename: file.name, bytes: new Uint8Array(await file.arrayBuffer()), existingStudents: scope?.students })
    setRows(preview.rows.map(r => scope && (r.data.schoolId !== scope.schoolId || (r.data.campus && r.data.campus !== scope.campus)) ?
      { ...r, errors: [...r.errors, 'La fila corresponde a otra institución o sede.'] } : r))
    if (!preview.rows.length) throw new Error('El archivo no contiene registros.')
  }
  async function submit() {
    if (result || !valid.length) return
    let outcome: ImportResult
    if (scope) {
      const receipt = await importStudents(scope.schoolId, valid.map(r => ({ ...r.data, campus: scope.campus })))
      setCreatedIds(receipt.created.map(s => s.id))
      outcome = { created: receipt.created.length, skipped: receipt.skipped.length, errors: [], credentials: [] }
    } else {
      outcome = await adminImport(kind, valid.map(r => r.data))
      outcome = { ...outcome, errors: outcome.errors.map(err => ({ ...err, row: valid[err.row - 1]?.number ?? err.row })) }
    }
    setResult(outcome)
  }
  return <Dialog title="Importar archivo" {...{ onClose }} busy={action.busy}>
    <fieldset disabled={action.busy}>
      <Button onClick={() => action.run(async () => download(await buildImportTemplate(kind), 'Plantilla ENAd.xlsx'), 'Plantilla descargada')}>Descargar plantilla</Button>
      <Field label="Archivo de Excel o CSV">
        <TextInput type="file" accept=".xlsx,.csv" onChange={e => {
          const file = e.target.files?.[0]
          e.target.value = ''
          if (file) void action.run(() => read(file), '')
        }} />
      </Field>
      {rows.length > 0 && <>
        <h3>Vista previa</h3>
        <p>{valid.length} filas válidas de {rows.length}. Solo se importarán las filas válidas.</p>
        <Table caption="Filas del archivo" headers={['Fila', ...columns.map(c => c.label), 'Validación']} rows={rows.slice(page * 20, page * 20 + 20).map(r => ({
          key: String(r.number), cells: [r.number, ...columns.map(c => r.cells[c.key] ?? ''), r.errors.join(' · ') || 'Válida']
        }))} />
        <Pager {...{ page, setPage }} count={rows.length} />
        <Button variant="primary" disabled={!valid.length || !!result} onClick={() => action.run(submit, '')}>Importar {valid.length} filas válidas</Button>
      </>}
    </fieldset>{result && <div role="status">
      <p>Registros guardados: {result.created}. Omitidos: {result.skipped}.</p>
      {result.errors.map((e, i) => <p key={i}>Fila {e.row}: {e.message}</p>)}
      {scope && createdIds.length > 0 && <AssignImportedStudents {...scope} ids={createdIds} />}
      {!!result.credentials?.length && <Credentials items={result.credentials} />}</div>}{action.feedback}</Dialog>
}

function AssignImportedStudents({schoolId, campus, ids}: {schoolId:string;campus:string;ids:string[]}) {
  const {groups, error} = useGroups(schoolId, {mine:true})
  const [groupId,setGroupId] = useState('')
  const [done,setDone] = useState(false)
  const action = useAction()
  if (error) return <p role="alert">{error}</p>
  const options = groups.filter(g => g.campus === campus)
  if (!options.length) return null
  return <fieldset disabled={done || action.busy}>
    <Choice label="Añadir estudiantes importados al grupo" options={options} value={groupId} onChange={setGroupId} placeholder="Selecciona un grupo (opcional)" />
    <Button disabled={!options.some(g => g.id === groupId)} onClick={() => action.run(async () => {
      const result = await addStudentsToGroup(groupId,ids)
      setDone(true)
      return result
    }, 'Estudiantes añadidos al grupo')}>Añadir al grupo</Button>
    {action.feedback}
  </fieldset>
}
