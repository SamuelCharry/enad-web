import { LoadError } from '../../ui/LoadError'
import { lazy, Suspense, useState } from 'react'
import type { School, Student } from '../../domain/types'
import { createStudent, importStudents, patchStudent, useStudents } from '../../data/students'
import { Button, Card, Dialog, Field, SyncStatus, TextInput } from '../../ui/components'
import { useAction } from './useAction'
import { genders, matches, numbers } from './formValues'
import { Choice, Search } from './common'
import { StudentDetail } from '../reports/Roster'
import { groupLink } from '../teacher/navigation'
import { Link } from 'react-router-dom'
import type { Group } from '../../domain/types'
import { FileImport } from './FileImport'
const Scanner = lazy(() => import('./Scanner').then(m => ({ default: m.Scanner })))

export function Students({ school, campus, admin, uid, initialStudent, scanOnOpen }: { school: School; campus: string; admin: boolean; uid?: string; initialStudent?: string | null; scanOnOpen?: boolean }) {
  const { students, loading, error } = useStudents(school.id)
  const [search, setSearch] = useState('')
  const [open, setOpen] = useState<'new' | 'file' | 'scan' | null>(scanOnOpen ? 'scan' : null)
  const [edit, setEdit] = useState<string | null>(null)
  const [selected, select] = useState(initialStudent)
  const [scannedGroup, setScannedGroup] = useState<Group>()
  const [notice, setNotice] = useState('')
  const [receiptId, setReceiptId] = useState('')
  const receipt = students.find(s => s.id === receiptId)
  const detail = students.find(s => s.id === selected && s.campus === campus)
  const visible = students.filter(s => s.schoolId === school.id && s.campus === campus && matches(search, s.fullName, s.code, s.grade))
  const existing = edit ? students.find(s => s.id === edit) : undefined
  if (error) return <LoadError message={error} />
  return <>
    {notice && <p role="status">{notice}</p>}
    {receipt && 'syncState' in receipt && <SyncStatus pending={receipt.syncState === 'pending'} />}
    {scannedGroup && <Link className="ui-link-button" to={groupLink('asistencia', scannedGroup)}>Tomar asistencia de este grupo</Link>}
    {detail && !admin ? <>{'syncState' in detail && <SyncStatus pending={detail.syncState === 'pending'} />}<p>{school.name} · {school.campuses.find(c => c.id === campus)?.name || 'Sin sede asignada'}</p>
      <Button onClick={() => setEdit(detail.id)}>Editar estudiante</Button>
      <StudentDetail student={detail} onBack={() => select(null)} backLabel="Volver a estudiantes" /></> : <>
    <div className="collect-toolbar">
      <Search value={search} onChange={setSearch} />
      <Button variant="primary" onClick={() => setOpen('new')}>Añadir estudiante</Button>
      {!admin && <>
        <Button disabled={loading} onClick={() => setOpen('scan')}>Escanear lista</Button>
        <Button disabled={loading} onClick={() => setOpen('file')}>Importar archivo</Button>
      </>}</div>
    {loading ? <p>Cargando estudiantes…</p> : visible.length ? visible.map(s => <Card key={s.id}>
      <div className="collect-row">
        <div>
          <h3>{admin ? s.fullName : <Button variant="ghost" onClick={() => select(s.id)}>{s.fullName}</Button>}</h3>
          <small>{s.code} · Grado {s.grade}°{s.retired ? ' · Retirado' : ''}</small>
        </div>{!admin && 'syncState' in s && s.syncState === 'pending' && <SyncStatus pending />}{admin && <Button onClick={() => setEdit(s.id)}>Editar estudiante</Button>}</div>
    </Card>) : <p>Cambia la búsqueda o añade el primer estudiante de la sede.</p>}</>}
    {(open === 'new' || existing) && <StudentEditor {...{ school, campus, admin }} student={existing} canEditIdentity={!!existing?.provisional && 'createdBy' in existing && existing.createdBy === uid} onSaved={id => { setReceiptId(id); setNotice('Estudiante registrado en la lista.') }} onClose={() => {
      setOpen(null)
      setEdit(null)
    }} />}
    {open === 'file' && <FileImport kind="students" schools={[school]} scope={{ schoolId: school.id, campus, students }} onClose={() => setOpen(null)} />}
    {open === 'scan' && !loading && <Suspense fallback={<p role="status">Cargando escáner…</p>}>
      <Scanner onSaved={group => { setScannedGroup(group); setNotice('Lista revisada en este dispositivo.') }} schoolId={school.id} {...{ students, campus }} onClose={() => setOpen(null)} />
    </Suspense>}</>
}
export function StudentEditor({ school, campus, admin, student, canEditIdentity = false, classRegistration = false, onSaved, onClose }: { classRegistration?: boolean; school: School; campus: string; admin: boolean; student?: Student; canEditIdentity?: boolean; onSaved?: (id: string, pending: boolean) => void | Promise<void>; onClose: () => void }) {
  const [name, setName] = useState(student?.fullName ?? '')
  const [code, setCode] = useState(student?.code ?? '')
  const [site, setSite] = useState(student?.campus ?? campus)
  const [grade, setGrade] = useState(String(student?.grade ?? ''))
  const [gender, setGender] = useState<Student['gender']>(student?.gender ?? '')
  const [age, setAge] = useState(String(student?.age ?? ''))
  const [sample, setSample] = useState(String(student?.sample ?? ''))
  const [retired, setRetired] = useState(student?.retired ?? false)
  const [clientId] = useState(() => crypto.randomUUID())
  const action = useAction()
  const identity = !student || admin || canEditIdentity
  const [created, setCreated] = useState<{ id: string; pending: boolean }>()
  const [confirmRetire, setConfirmRetire] = useState(false)
  const changed = !student || name.trim() !== student.fullName || site !== student.campus || +grade !== student.grade ||
    gender !== student.gender || (age ? +age : null) !== student.age || (sample ? +sample : null) !== student.sample || retired !== student.retired
  return <Dialog title={student ? 'Editar estudiante' : 'Añadir estudiante'} {...{ onClose }} busy={action.busy}>
    <form onSubmit={e => {
      e.preventDefault()
      if (!name.trim() || !grade || (classRegistration && (!gender || !age)) || (admin && !student && !code.trim())) return
      if (student && retired && !student.retired && !confirmRetire) { setConfirmRetire(true); return }
      void action.run(async () => {
        const fields = { fullName: name.trim(), campus: site, grade: +grade, gender, age: age ? +age : null }
        let receipt = created
        if (student) {
          const result = await patchStudent(student.id, {
            ...(identity && fields.fullName !== student.fullName ? { fullName: fields.fullName } : {}),
            ...(identity && site !== student.campus ? { campus: site } : {}),
            ...(identity && +grade !== student.grade ? { grade: +grade } : {}),
            ...(gender !== student.gender ? { gender } : {}),
            ...(fields.age !== student.age ? { age: fields.age } : {}),
            ...(retired !== student.retired ? { retired } : {}),
            ...((sample ? +sample : null) !== student.sample ? { sample: sample ? +sample : null } : {})
          })
          receipt = { id: student.id, pending: result.syncState === 'pending' }
        } else if (!receipt) {
          if (!admin && code.trim()) {
            const result = await importStudents(school.id, [{ ...fields, code: code.trim() }])
            if (!result.created.length) throw new Error('Este código ya existe. Busca al estudiante en la lista.')
            receipt = { id: result.created[0].id, pending: result.syncState === 'pending' }
          } else {
            const result = await createStudent({ ...fields, schoolId: school.id, ...(admin ? { code: code.trim() } : { provisional: true, clientId }) })
            receipt = { id: result.id, pending: 'syncState' in result && result.syncState === 'pending' }
          }
          setCreated(receipt)
        }
        if (receipt) {
          try { await onSaved?.(receipt.id, receipt.pending) }
          catch { throw new Error('El estudiante ya se creó. Vuelve a intentar añadirlo al grupo.') }
        }
        onClose()
      })
    }}>
      <fieldset disabled={action.busy || !!created || confirmRetire}>
        <Field label="Nombre completo">
          <TextInput required disabled={!identity} value={name} onChange={e => setName(e.target.value)} />
        </Field>
        {((!student && !classRegistration) || admin) && <Field label={admin ? "Código" : "Código oficial (opcional)"}>
            <TextInput required={admin} disabled={!!student} value={code} onChange={e => setCode(e.target.value)} />
          </Field>}
          {(admin || canEditIdentity) && <Choice label="Sede" options={school.campuses} placeholder="Sin asignar" value={site} onChange={setSite} />}
        <Choice disabled={!identity} required label="Grado" value={grade} options={numbers(3, 5)} placeholder="Selecciona el grado" onChange={setGrade} />
        <Choice required={classRegistration} label="Sexo" value={gender} options={genders} placeholder="Selecciona" onChange={setGender} />
        <Choice required={classRegistration} label="Edad en años" value={age} options={numbers(5, 18)} placeholder="Selecciona" onChange={setAge} />
        {student && <>
          <Choice label="Muestra" value={sample} options={numbers(1, 4)} placeholder="Sin asignar" onChange={setSample} />
          <label>
            <input type="checkbox" checked={retired} onChange={e => setRetired(e.target.checked)} /> Estudiante retirado</label>
        </>}
      </fieldset>{confirmRetire && <p>¿Confirmas el retiro de {student?.fullName} del programa? <Button disabled={action.busy} onClick={() => { setRetired(false); setConfirmRetire(false) }}>Cancelar retiro</Button></p>}
      <div className="teacher-save"><Button type="submit" disabled={!changed || !name.trim() || !grade} loading={action.busy} variant="primary">{confirmRetire ? 'Confirmar retiro' : created ? 'Completar registro' : 'Guardar estudiante'}</Button></div>{action.feedback}</form>
  </Dialog>
}
