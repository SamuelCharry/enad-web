import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react'
import type { Group, Student } from '../../domain/types'
import { addStudentsToGroup, useGroups } from '../../data/groups'
import { createStudent } from '../../data/students'
import { reasonLabel } from '../../domain/text/studentNameRules'
import { reviewerForRoster, scanReceipt, type ReviewName } from '../../domain/ocr/reviewNames'
import { Button, Dialog, Field, Segmented, Select, TextInput } from '../../ui/components'
import { useAction } from './useAction'
import { Choice } from './common'
import { checkPhoto } from '../teacher/photoQuality'
import { PageCrop } from './crop/PageCrop'

interface Page { id: string; url: string; engine: string; omitted: number }
interface Entry { existing?: string; row: ReviewName; grade: number; flags: string[] }
interface Submission { entries: Entry[]; group?: Group; ids: string[]; pending: boolean }
export function Scanner({ schoolId, campus, campusName, students, onClose, onSaved }: {
  campusName?:string; onSaved?: (group?: Group) => void; schoolId: string; campus: string; students: Student[]; onClose: () => void
}) {
  const [rows, setRows] = useState<ReviewName[]>([])
  const [pages, setPages] = useState<Page[]>([])
  const [preview, setPreview] = useState<Page>()
  const [warning, setWarning] = useState('')
  const [model, setModel] = useState<File>()
  const [needsModel, setNeedsModel] = useState(false)
  const [progress, setProgress] = useState<number | null>(null)
  const [groupId, setGroup] = useState('')
  const [receipt, setReceipt] = useState('')
  const [submission, setSubmission] = useState<Submission>()
  const action = useAction()
  const urls = useRef(new Set<string>())
  useEffect(() => { const all = urls.current; return () => all.forEach(url => URL.revokeObjectURL(url)) }, [])
  const { groups, loading, error } = useGroups(schoolId, { mine: true })
  const inCampus = (value:string) => value === campus || value === campusName
  const group = groups.find(g => g.id === groupId && g.schoolId === schoolId && inCampus(g.campus))
  const roster = useMemo(() => students.filter(s => s.schoolId === schoolId), [students, schoolId])
  const members = new Set(group?.studentIds)
  const counts = [0, 0, 0, 0, 0, 0]
  for (const s of roster) if (members.has(s.id)) counts[s.grade]++
  const defaultGrade = [3, 4, 5].sort((a, b) => counts[b] - counts[a])[0]
  const reviewer = useMemo(() => reviewerForRoster(roster), [roster])
  const review = useMemo(() => rows.map(reviewer), [reviewer, rows])
  const identities = new Set<string>()
  const repeated = new Set<string>()
  for (const r of review) {
    if (r.problem) continue
    if (identities.has(r.identity)) repeated.add(r.identity)
    identities.add(r.identity)
  }
  const outside = group ? review.flatMap(r => {
    const student = roster.find(s => s.id === r.id)
    return student && !inCampus(student.campus) ? [student.fullName] : []
  }) : []
  const projectedSize = new Set([...(group?.studentIds || []),...review.map(r => r.id === 'new' ? r.identity : r.id)]).size
  const overCapacity = !!group && projectedSize > 60
  const ready = !outside.length && !overCapacity && rows.length > 0 && rows.length <= 200 && !repeated.size && review.every(r => !r.problem) && (!groupId || !!group)
  function patch(id: string, changes: Partial<ReviewName>) {
    setRows(prev => prev.map(r => r.id === id ? { ...r, ...changes } : r))
  }
  function release(url: string) { urls.current.delete(url); URL.revokeObjectURL(url) }
  function chooseFile(e: ChangeEvent<HTMLInputElement>, replacing?: Page) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    void action.run(async () => {
      const url = URL.createObjectURL(file)
      urls.current.add(url)
      setWarning(await checkPhoto(url).catch(() => 'Comprueba que los nombres se lean bien.'))
      setPreview({ url, id: replacing?.id ?? crypto.randomUUID(), engine: '', omitted: 0 })
    }, '')
  }
  async function scan(file: File, page: Page) {
    setProgress(0)
    try {
      const { readPhoto } = await import('./readPhoto')
      const result = await readPhoto(file, setProgress, model, schoolId)
      const old = pages.find(p => p.id === page.id)
      if (!result.rows.length && old) throw new Error('No encontramos nombres. Conservamos la página anterior.')
      const updated = { ...page, engine: result.engine, omitted: result.omitted }
      setPages(prev => old ? prev.map(p => p.id === page.id ? updated : p) : [...prev, updated])
      setRows(prev => [...prev.filter(r => r.page !== page.id), ...result.rows.map(r => ({
        ...r,
        id: crypto.randomUUID(), page: page.id, input: r.name, gender: '' as const
      }))])
      if (old) release(old.url)
      setPreview(undefined)
    } catch (e) {
      if (e instanceof Error && e.name === 'SpanishModelMissing') {
        setNeedsModel(true)
        throw new Error('Falta el modelo de español. Selecciona el archivo y vuelve a leer la foto.')
      }
      throw e
    } finally { setProgress(null) }
  }
  function addRow(page: string) {
    setRows(prev => [...prev, { page, id: crypto.randomUUID(), raw: '', name: '', input: '', confidence: null, flags: [], gender: '' }])
  }
  async function save() {
    let draft = submission
    if (!draft) {
      if (!ready) return
      draft = {
        group, ids: [], pending: false, entries: rows.map((row, i) => ({
          row, grade: row.grade ?? defaultGrade,
          existing: review[i].id === 'new' ? undefined : review[i].id, flags: review[i].flags
        }))
      }
    }
    for (const { row, grade, existing, flags } of draft.entries.slice(draft.ids.length)) {
      if (existing) { draft.ids.push(existing); continue }
      const s = await createStudent({
        schoolId, campus, fullName: row.input, grade, gender: row.gender, provisional: true,
        clientId: row.id, source: 'ocr', ocrConfidence: row.confidence, reviewReasons: flags
      })
      draft.ids.push(s.id)
      setSubmission(draft)
      draft.pending ||= 'syncState' in s && s.syncState === 'pending'
    }
    if (draft.group) {
      if (draft.entries.some(e => !e.existing)) setSubmission(draft)
      const result = await addStudentsToGroup(draft.group.id, draft.ids)
      draft.pending ||= result?.syncState === 'pending'
    }
    const matched = draft.entries.filter(e => e.existing).length
    setReceipt(scanReceipt(matched, draft.entries.length - matched, draft.pending)+(draft.group ? ' Grupo: '+draft.group.name+'.' : ''))
    onSaved?.(draft.group)
  }
  return <Dialog title="Escanear lista" onClose={onClose} busy={action.busy || progress !== null}>
    {receipt ? <p role="status">{receipt}</p> : <>
      <fieldset disabled={action.busy || !!submission || progress !== null} hidden={!!preview}>
        <label className="ui-button scan-file">Tomar foto de la lista<input type="file" accept="image/*" capture="environment" onChange={chooseFile} /></label>
        <label className="ui-button scan-file">Elegir imagen<input type="file" accept="image/*" onChange={chooseFile} /></label>
      </fieldset>
      {preview && <>
        {needsModel && <label className="ui-button scan-file">Modelo de español<input type="file" accept=".traineddata,.gz" onChange={e => setModel(e.target.files?.[0])} /></label>}
        <PageCrop key={preview.url} url={preview.url} warning={warning} busy={progress !== null} onRead={f => scan(f, preview)}
          onCancel={() => { release(preview.url); setPreview(undefined) }} />
      </>}
      {progress !== null && <p role="status">Leyendo la lista… {progress || ''}{progress ? ' %' : ''}</p>}
      {!preview && <fieldset disabled={action.busy || !!submission}>
        {pages.map((page, i) => <details key={page.id} open={rows.every(r => r.page !== page.id) || undefined}>
          <summary>Página {i + 1} · {page.engine}</summary><img src={page.url} alt={'Lista original, página ' + (i + 1)} />
          {rows.every(r => r.page !== page.id) && <p>No encontramos nombres. Añade una fila o toma otra foto.</p>}
          <label className="ui-button scan-file">{'Volver a escanear la página ' + (i + 1)}<input type="file" accept="image/*" onChange={e => chooseFile(e, page)} /></label>
          <Button disabled={rows.filter(r => r.page === page.id).length >= 45} onClick={() => addRow(page.id)}>Añadir una fila omitida</Button>
        </details>)}
        {pages.map(p => p.omitted > 0 && <p role="status" key={p.id}>{p.omitted} nombres fuera del límite de 45. Escanea el resto en otra página.</p>)}
        {!pages.length && <Button disabled={rows.length >= 45} onClick={() => addRow('')}>Añadir una fila omitida</Button>}
        {!!rows.length && <>
          <Choice label="Añadir al grupo" value={groupId} placeholder="Sin grupo" disabled={loading || !!error}
            options={groups.filter(g => inCampus(g.campus) && g.schoolId === schoolId)} onChange={setGroup} />
          {!!outside.length && <p role="alert">{outside.join(', ')} pertenece a otra sede. Quita la fila o elige «Sin grupo».</p>}
          {overCapacity && <p role="alert">El grupo admite hasta 60 integrantes. Quita filas o elige «Sin grupo».</p>}
          {error && <p role="alert">{error}</p>}
          {rows.map((r, i) => {
            const result = review[i], matched = result.id && result.id !== 'new'
            const problem = result.problem || (repeated.has(result.identity) ? 'La fila está repetida. Revisa o quita una.' : '')
            const label = problem ? 'Revisar' : matched ? 'Ya registrado' : result.flags.length ? 'Revisar' : 'Nuevo'
            const selected = result.matches.find(m => m.student.id === result.id)?.student
            return <section className="scan-row" key={r.id}>
              {result.matches.length ? <details open={problem ? true : undefined}><summary><span className="scan-status" data-review={label === 'Revisar'}>{label}</span>
                {selected && ' · ' + selected.fullName}</summary>
                <Field label={'Identidad · fila ' + (i + 1)}><Select value={result.id} onChange={e => patch(r.id, { choice: e.target.value })}>
                  <option value="">Elige un estudiante</option>{result.matches.map(({ student: s }) => <option key={s.id} value={s.id}>{s.fullName} · {s.grade}° · {s.code}</option>)}
                  <option value="new">Es un estudiante nuevo</option></Select></Field></details> :
                <span className="scan-status" data-review={label === 'Revisar'}>{label}</span>}
              {problem ? <p>{problem}</p> : !matched && result.flags.length > 0 && <p>{[...new Set(result.flags.map(reasonLabel))].join(' · ')}</p>}
              <Field label={'Nombre · fila ' + (i + 1)}><TextInput value={r.input} onChange={e => patch(r.id, { input: e.target.value, choice: undefined })} /></Field>
              <div role="group" aria-label="Sexo">{(['F', 'M'] as const).map(s => <Button key={s} disabled={!!selected} aria-pressed={(selected?.gender ?? r.gender) === s}
                onClick={() => patch(r.id, { gender: r.gender === s ? '' : s })}>{s === 'F' ? 'Niña' : 'Niño'}</Button>)}</div>
              <Segmented disabled={!!selected} label="Grado" value={String(selected?.grade ?? r.grade ?? defaultGrade)}
                options={[3, 4, 5].map(g => ({ value: String(g), label: g + '°' }))} onChange={g => patch(r.id, { grade: Number(g) })} />
              <Button variant="ghost" onClick={() => setRows(prev => prev.filter(row => row.id !== r.id))}>Quitar fila</Button>
            </section>
          })}
          {rows.length > 200 && <p>Revisa hasta 200 estudiantes por lista.</p>}
        </>}
      </fieldset>}
      {!preview && !!rows.length && <Button variant="primary" loading={action.busy} disabled={!submission && !ready} onClick={() => action.run(save, '')}>
        {submission ? 'Reintentar guardado' : 'Guardar lista'}</Button>}
      {action.feedback}
    </>}
  </Dialog>
}
