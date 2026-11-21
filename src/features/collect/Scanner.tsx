import { useState } from 'react'
import type { Student } from '../../domain/types'
import { addStudentsToGroup, useGroups } from '../../data/groups'
import { createStudent, importStudents } from '../../data/students'
import { matchRow } from '../../domain/ocr/rosterMatcher'
import { type ParsedRow } from '../../domain/ocr/rowParser'
import { validateRows } from '../../domain/ocr/rowValidator'
import { Button, Dialog, Field, Select, Table, TextInput } from '../../ui/components'
import { useAction } from './useAction'
import { numbers } from './formValues'
import { Choice } from './common'

interface Review { id: string; parsed: ParsedRow; choice: string }
export function Scanner({ schoolId, campus, students, onClose }: { schoolId: string; campus: string; students: Student[]; onClose: () => void }) {
  const [rows, setRows] = useState<Review[]>([])
  const [needsModel, setNeedsModel] = useState(false)
  const [model, setModel] = useState<File>()
  const [grade, setGrade] = useState('3')
  const [groupId, setGroup] = useState('')
  const [progress, setProgress] = useState<number | null>(null)
  const [receipts, setReceipts] = useState<Record<string, string>>({})
  const [imported, setImported] = useState<string[] | null>(null)
  const { groups } = useGroups(schoolId, { mine: true })
  const action = useAction()
  const roster = students.filter(s => s.schoolId === schoolId).map(s => ({ id: s.id, name: s.fullName, sex: s.gender, age: s.age, code: s.code }))
  const reviewed = (rows.length ? validateRows(rows.map(r => r.parsed)) : []).map((r, i) => {
    const match = matchRow(r, roster)
    const choice = receipts[rows[i].id] || rows[i].choice || match.chosenStudentId || (match.status === 'newStudent' && r.code ? 'new' : '')
    const errors = [...new Set([...r.issues, ...match.reasons])]
    const student = students.find(s => s.id === choice)
    const conflict = choice === 'new' && !!r.code && roster.some(s => s.code === r.code)
    if (conflict) errors.push('Este código ya existe. Verifica la coincidencia.')
    const wrongSite = !!groupId && student && (student.campus !== campus || student.retired)
    if (wrongSite) errors.push('Este estudiante no puede añadirse al grupo de esta sede.')
    return { r, match, choice, errors, valid: !!choice && !wrongSite && !conflict && match.status !== 'invalid' && (choice === 'new' || !!student || !!receipts[rows[i].id]) }
  })
  const used = reviewed.map(d => d.choice).filter(v => v && v !== 'new')
  const duplicate = used.length !== new Set(used).size
  const ready = reviewed.length > 0 && reviewed.length <= 200 && !duplicate && reviewed.every(r => r.valid)
  function edit(i: number, patch: Partial<ParsedRow>) {
    setRows(list => list.map((row, j) => i === j ? { ...row, parsed: { ...row.parsed, ...patch }, choice: '' } : row))
  }
  async function scan(file: File) {
    setProgress(0)
    const { readPhoto, SpanishModelMissing } = await import('./readPhoto')
    try {
      const parsed = await readPhoto(file, setProgress, model)
      if (!parsed.length) throw new Error('No se identificaron filas.')
      setRows(prev => [...prev, ...parsed.map(p => ({ id: crypto.randomUUID(), parsed: p, choice: '' }))])
    } catch (error) {
      if (error instanceof SpanishModelMissing) {
        setNeedsModel(true)
        throw new Error('No se pudo cargar el modelo de español. Selecciona el archivo spa.traineddata o spa.traineddata.gz y vuelve a elegir la foto.')
      }
      throw new Error('No se pudo leer la lista. Intenta con una foto nítida, tomada de frente.')
    }
    finally { setProgress(null) }
  }
  async function save() {
    let ids = imported
    if (!ids) {
      const saved = { ...receipts }
      const additions = reviewed.flatMap((d, i) => d.choice === 'new' && d.r.code ? [{ i, row: { campus, code: d.r.code, fullName: d.r.name.trim(), grade: d.r.grade ?? +grade, gender: d.r.sex || '', age: d.r.age ?? null } }] : [])
      if (additions.length) {
        const result = await importStudents(schoolId, additions.map(a => a.row))
        for (const { i, row } of additions) {
          const created = result.created.find(s => s.code === row.code)
          if (created) saved[rows[i].id] = created.id
        }
        setReceipts({ ...saved })
        if (result.skipped.length) {
          setRows(prev => prev.map(r => ({ ...r, choice: '' })))
          throw new Error('Un código ya existe. Revisa las coincidencias antes de continuar.')
        }
      }
      ids = []
      for (const [i, d] of reviewed.entries()) {
        const key = rows[i].id
        if (d.choice === 'new' && !saved[key]) {
          if (d.r.code) throw new Error('Falta confirmar un registro importado.')
          const student = await createStudent({ schoolId, campus, fullName: d.r.name.trim(), grade: d.r.grade ?? +grade, gender: d.r.sex === 'F' || d.r.sex === 'M' ? d.r.sex : '', age: d.r.age ?? null, provisional: true, clientId: key })
          saved[key] = student.id
          setReceipts({ ...saved })
        }
        ids.push(saved[key] || d.choice)
      }
      setImported(ids)
    }
    if (groupId) await addStudentsToGroup(groupId, ids)
    onClose()
  }
  return <Dialog title="Escanear lista" {...{ onClose }} busy={action.busy}>
    <fieldset disabled={action.busy || !!imported}>
      {needsModel && <Field label="Modelo de español">
        <TextInput type="file" accept=".traineddata,.gz" onChange={e => setModel(e.target.files?.[0])} />
      </Field>}
      <Field label="Foto de la lista">
        <TextInput type="file" accept="image/*" onChange={e => {
          const file = e.target.files?.[0]
          e.target.value = ''
          if (file) void action.run(() => scan(file), '')
        }} />
      </Field>
      {progress !== null && <p role="status">Leyendo la lista… {progress} %</p>}
      {!!rows.length && <>
        <h3>Revisar estudiantes</h3>
        <Choice label="Grado para filas sin grado" value={grade} options={numbers(3, 5)} onChange={setGrade} />
        <Table caption="Revisión de la lista escaneada" headers={['Texto leído', 'Nombre', 'Código', 'Sexo', 'Edad', 'Grado', 'Coincidencia', 'Revisión', '']} rows={reviewed.map(({ r, choice, errors, match }, i) => {
          const locked = !!receipts[rows[i].id]
          return {
            key: rows[i].id,
            cells: [r.rawText, ...(['name', 'code', 'sex', 'age', 'grade'] as const).map((key, k) =>
              <TextInput key={key} aria-label={['Nombre', 'Código', 'Sexo', 'Edad', 'Grado'][k] + ' fila ' + (i + 1)} disabled={locked} type={key === 'grade' || key === 'age' ? 'number' : 'text'} value={r[key] ?? ''} onChange={e => {
                const value = e.target.value
                edit(i, { [key]: key === 'grade' || key === 'age' ? value ? +value : null : key === 'sex' ? value.toUpperCase() : value })
              }} />), <Select key="identity" aria-label={'Identidad fila ' + (i + 1)} disabled={locked} value={choice} onChange={e => setRows(list => list.map((row, j) => i === j ? { ...row, choice: e.target.value } : row))}>
              <option value="">Verifica la identidad</option>
              <option value="new">Confirmar como nuevo</option>
              {roster.map(s => <option key={s.id} value={s.id}>{s.name} · {s.code}{match.candidates.some(c => c.student.id === s.id) ? ' (coincidencia)' : ''}</option>)}</Select>,
            errors.join(' · ') || 'Revisada', <Button key="remove" disabled={locked} onClick={() => setRows(list => list.filter((_, j) => j !== i))}>Quitar fila</Button>]
          }
        })} />
        {duplicate && <p role="alert">Dos filas apuntan al mismo estudiante.</p>}{rows.length > 200 && <p>El máximo es de 200 filas por importación.</p>}
        <Choice label="Añadir al grupo" value={groupId} placeholder="Solo importar" options={groups.filter(g => g.campus === campus)} onChange={setGroup} />
      </>}
    </fieldset>
    <Button variant="primary" loading={action.busy} disabled={!imported && !ready} onClick={() => action.run(save)}>{imported ? 'Completar grupo' : 'Importar lista revisada'}</Button>{action.feedback}</Dialog>
}
