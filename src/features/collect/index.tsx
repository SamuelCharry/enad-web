import { LoadError } from '../../ui/LoadError'
import { useState } from 'react'
import { Link, Navigate, Route, Routes, useSearchParams } from 'react-router-dom'
import { useSession } from '../../data/session'
import type { UserProfile } from '../../domain/types'
import { useSchools } from '../../data/scope'
import { type ImportKind } from '../../domain/import/schema'
import { Button, PageHeader, Tabs } from '../../ui/components'
import { SchoolScope } from './common'
import { Attendance } from './Attendance'
import { Evaluations } from './Evaluation'
import { Hours } from './Hours'
import { Groups } from './Groups'
import { Students } from './Students'
import { Schools, Teachers } from './Directories'
import { HistoryDirectory } from './admin/HistoryDirectory'
import { Program } from './Program'
import { FileImport } from './FileImport'
import { TaskGuide } from '../teacher/TaskGuide'
import '../teacher/teacher.css'
import { DataQuality, ImportHistory } from './admin/Audit'
import { Rosters } from './admin/Rosters'
import './collect.css'

const teacherSections = [['asistencia', 'Asistencia'], ['evaluacion', 'Evaluación formativa'], ['horas', 'Horas'], ['grupos', 'Grupos'], ['estudiantes', 'Estudiantes']] as const
const adminSections = [['instituciones', 'Instituciones y sedes'], ['docentes', 'Docentes'], ['estudiantes', 'Estudiantes'], ['grupos', 'Grupos'], ['evaluaciones', 'Evaluaciones históricas'], ['configuracion', 'Configuración del programa'], ['calidad','Calidad de datos'], ['importaciones','Historial de importaciones']] as const
function ImportButton({ kind }: { kind: ImportKind }) {
  const { schools, loading, error } = useSchools()
  const [open, setOpen] = useState(false)
  if (error) return <LoadError message={error} />
  return <>
    <Button disabled={loading} onClick={() => setOpen(true)}>Importar archivo</Button>{open && <FileImport {...{ kind, schools }} onClose={() => setOpen(false)} />}</>
}
function TeacherScreen({ section, profile }: { section: typeof teacherSections[number][0]; profile: UserProfile }) {
  const [params, setParams] = useSearchParams()
  const [revision, setRevision] = useState(0)
  const groupId = params.get('group') || ''
  const scopeParams = new URLSearchParams(params)
  scopeParams.delete('guide')
  const content = <><SchoolScope key={revision + scopeParams.toString()} includeUnassigned={section === 'estudiantes' || section === 'evaluacion'} allSites={section === 'grupos'} onScopeChange={(school, campus) => {
    const next = new URLSearchParams({ school })
    if (campus !== null) next.set('campus', campus)
    if (params.has('guide')) next.set('guide','1')
    setParams(next, { replace: true })
  }} initialSchool={params.get('school') || ''} initialCampus={params.get('campus')} profile={profile} withCampus={section !== 'asistencia' && section !== 'horas'}>{(school, campus) => {
    switch (section) {
      case 'asistencia': return <Attendance schoolId={school.id} initialDate={params.get('date')} initialGroup={groupId} uid={profile.uid} school={school} />
      case 'evaluacion': return <Evaluations schoolId={school.id} campus={campus} initialGroup={groupId} initialSubject={params.get('subject')} initialMoment={params.get('moment')} school={school} studentId={params.get('student')} />
      case 'horas': return <Hours schoolId={school.id} />
      case 'grupos': return <Groups schoolId={school.id} initialGroup={groupId} campuses={school.campuses.filter(c => !profile.campusIds[school.id]?.length || profile.campusIds[school.id].includes(c.id))} {...{ campus, profile }} />
      case 'estudiantes': return <Students {...{ school, campus }} admin={false} uid={profile.uid} initialStudent={params.get('student')} scanOnOpen={params.has('scan')} />
    }
  }}</SchoolScope><Button variant="ghost" onClick={() => setRevision(v => v + 1)}>Volver a cargar los datos</Button></>
  return <TaskGuide enabled={params.has('guide')} section={section} onClose={() => {
    const next = new URLSearchParams(params)
    next.delete('guide')
    setParams(next, { replace: true })
  }}>{content}</TaskGuide>
}
function AdminScreen({ section, profile }: { section: typeof adminSections[number][0]; profile: UserProfile }) {
  if (!profile.activo || profile.rol !== 'admin') return <p role="alert">Se necesita una cuenta de administración activa.</p>
  if (section === 'calidad') return <DataQuality/>
  if (section === 'importaciones') return <ImportHistory/>
  if (section === 'configuracion') return <div className="admin-workspace"><Program /></div>
  const kind = { instituciones: 'schools', docentes: 'teachers', estudiantes: 'students', grupos: 'groups', evaluaciones: 'evaluations' } as const
  return <div className="admin-workspace">
    <ImportButton kind={kind[section]} />
    {section === 'instituciones' ? <Schools /> : section === 'docentes' ? <Teachers /> :
      section === 'estudiantes' || section === 'grupos' ? <Rosters kind={section}/> :
      <HistoryDirectory/>}</div>
}
export function CollectRoutes() {
  const { loading, profile, error } = useSession()
  if (loading) return <p role="status">Cargando sesión…</p>
  if (error || !profile?.activo) return <section>
    <p>{error || 'Ingresa con una cuenta activa para acceder a la recolección.'}</p>
    <Link to="/login">Ir al ingreso</Link>
  </section>
  const admin = profile.rol === 'admin'
  if (!admin && profile.rol !== 'docente') return <section className="collect">
    <PageHeader title="Recolección de datos" />
    <p>Tu perfil tiene acceso de solo lectura. Puedes consultar los informes del programa.</p>
    <Link to="/visualizacion">Ir a visualización de datos</Link>
  </section>
  const sections = admin ? adminSections : teacherSections
  return <section className="collect" key={profile.uid}>
    <PageHeader title={admin ? 'Carga de datos' : 'Recolección de datos'} />
    <Tabs label="Secciones de recolección" items={sections.map(([path, label]) => ({ to: '/recoleccion/' + path, label }))} />
    <Routes>{admin ? adminSections.map(([section, label]) => <Route path={section} key={section} element={<div key={section}>
      <h2>{label}</h2>
      <AdminScreen {...{ section, profile }} />
    </div>} />) :
      teacherSections.map(([section, label]) => <Route path={section} key={section} element={<div className="teacher-screen" key={section}>
        <h2>{label}</h2>
        <TeacherScreen {...{ section, profile }} />
      </div>} />)}
      <Route path="*" element={<Navigate replace to={'/recoleccion/' + sections[0][0]} />} />
    </Routes>
  </section>
}
