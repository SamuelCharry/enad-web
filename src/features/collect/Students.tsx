import { useState } from 'react'
import type { School, Student } from '../../domain/types'
import { createStudent, patchStudent, useStudents } from './_pending'
import { Button, Card, Dialog, Field, TextInput } from './_pendingUi'
import { useAction } from './useAction'
import { genders, matches, numbers } from './formValues'
import { Choice, Search } from './common'
import { FileImport } from './FileImport'
import { Scanner } from './Scanner'

export function Students({ school, campus, admin }: { school: School; campus: string; admin: boolean }) {
  const { students, loading, error } = useStudents(school.id)
  const [search, setSearch] = useState('')
  const [open, setOpen] = useState<'new' | 'file' | 'scan' | null>(null)
  const [edit, setEdit] = useState<string | null>(null)
  const visible = students.filter(s => s.schoolId === school.id && s.campus === campus && matches(search, s.fullName, s.code, s.grade))
  const existing = edit ? students.find(s => s.id === edit) : undefined
  if (error) return <p role="alert">{error}</p>
  return <>
    <div className="collect-toolbar">
      <Search value={search} onChange={setSearch} />
      <Button variant="primary" onClick={() => setOpen('new')}>Añadir estudiante</Button>
      {!admin && <>
        <Button onClick={() => setOpen('scan')}>Escanear lista</Button>
        <Button onClick={() => setOpen('file')}>Importar archivo</Button>
      </>}</div>
    {loading ? <p>Cargando estudiantes…</p> : visible.length ? visible.map(s => <Card key={s.id}>
      <div className="collect-row">
        <div>
          <h3>{s.fullName}</h3>
          <small>{s.code} · Grado {s.grade}°{s.retired ? ' · Retirado' : ''}</small>
        </div>{admin && <Button onClick={() => setEdit(s.id)}>Editar estudiante</Button>}</div>
    </Card>) : <p>Sin estudiantes en esta selección.</p>}
    {(open === 'new' || existing) && <StudentEditor {...{ school, campus, admin }} student={existing} onClose={() => {
      setOpen(null)
      setEdit(null)
    }} />}
    {open === 'file' && <FileImport kind="students" schools={[school]} scope={{ schoolId: school.id, campus, students }} onClose={() => setOpen(null)} />}
    {open === 'scan' && <Scanner schoolId={school.id} {...{ students, campus }} onClose={() => setOpen(null)} />}</>
}
function StudentEditor({ school, campus, admin, student, onClose }: { school: School; campus: string; admin: boolean; student?: Student; onClose: () => void }) {
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
  return <Dialog title={student ? 'Editar estudiante' : 'Añadir estudiante'} {...{ onClose }} busy={action.busy}>
    <form onSubmit={e => {
      e.preventDefault()
      if (!name.trim() || !grade || (admin && !student && !code.trim()) || (!admin && (!gender || !age))) return
      void action.run(async () => {
        const fields = { fullName: name.trim(), campus: site, grade: +grade, gender, age: age ? +age : null }
        if (student) await patchStudent(student.id, { ...fields, retired, sample: sample ? +sample : null })
        else await createStudent({ ...fields, schoolId: school.id, ...(admin ? { code: code.trim() } : { provisional: true, clientId }) })
        onClose()
      })
    }}>
      <fieldset disabled={action.busy}>
        <Field label="Nombre completo">
          <TextInput required value={name} onChange={e => setName(e.target.value)} />
        </Field>
        {admin && <>
          <Field label="Código">
            <TextInput required disabled={!!student} value={code} onChange={e => setCode(e.target.value)} />
          </Field>
          <Choice label="Sede" options={school.campuses} placeholder="Sin asignar" value={site} onChange={setSite} />
        </>}
        <Choice required label="Grado" value={grade} options={numbers(3, 5)} placeholder="Selecciona el grado" onChange={setGrade} />
        <Choice required={!admin} label="Sexo" value={gender} options={genders} placeholder="Selecciona" onChange={setGender} />
        <Choice required={!admin} label="Edad en años" value={age} options={numbers(5, 18)} placeholder="Selecciona" onChange={setAge} />
        {student && <>
          <Choice label="Muestra" value={sample} options={numbers(1, 4)} placeholder="Sin asignar" onChange={setSample} />
          <label>
            <input type="checkbox" checked={retired} onChange={e => setRetired(e.target.checked)} /> Estudiante retirado</label>
        </>}
        <Button type="submit" variant="primary">Guardar estudiante</Button>
      </fieldset>{action.feedback}</form>
  </Dialog>
}
