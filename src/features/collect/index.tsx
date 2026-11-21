import { useState } from 'react'
import { Link, Navigate, Route, Routes } from 'react-router-dom'
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
import { History } from './History'
import { Program } from './Program'
import { FileImport } from './FileImport'
import './collect.css'

const teacherSections = [['asistencia', 'Asistencia'], ['evaluacion', 'Evaluación formativa'], ['horas', 'Horas'], ['grupos', 'Grupos'], ['estudiantes', 'Estudiantes']] as const
const adminSections = [['instituciones', 'Instituciones y sedes'], ['docentes', 'Docentes'], ['estudiantes', 'Estudiantes'], ['grupos', 'Grupos'], ['evaluaciones', 'Evaluaciones históricas'], ['configuracion', 'Configuración del programa']] as const
function ImportButton({ kind }: { kind: ImportKind }) {
  const { schools, loading } = useSchools()
  const [open, setOpen] = useState(false)
  return <>
    <Button disabled={loading} onClick={() => setOpen(true)}>Importar archivo</Button>{open && <FileImport {...{ kind, schools }} onClose={() => setOpen(false)} />}</>
}
function TeacherScreen({ section, profile }: { section: typeof teacherSections[number][0]; profile: UserProfile }) {
  return <SchoolScope profile={profile} withCampus={section !== 'asistencia' && section !== 'horas'}>{(school, campus) => {
    switch (section) {
      case 'asistencia': return <Attendance schoolId={school.id} />
      case 'evaluacion': return <Evaluations schoolId={school.id} campus={campus} />
      case 'horas': return <Hours schoolId={school.id} />
      case 'grupos': return <Groups schoolId={school.id} {...{ campus, profile }} />
      case 'estudiantes': return <Students {...{ school, campus }} admin={false} />
    }
  }}</SchoolScope>
}
function AdminScreen({ section, profile }: { section: typeof adminSections[number][0]; profile: UserProfile }) {
  if (section === 'configuracion') return <Program />
  const kind = { instituciones: 'schools', docentes: 'teachers', estudiantes: 'students', grupos: 'groups', evaluaciones: 'evaluations' } as const
  return <>
    <ImportButton kind={kind[section]} />
    {section === 'instituciones' ? <Schools /> : section === 'docentes' ? <Teachers /> :
      <SchoolScope profile={profile} withCampus={section !== 'evaluaciones'}>{(school, campus) => section === 'estudiantes' ? <Students {...{ school, campus }} admin /> :
        section === 'grupos' ? <Groups schoolId={school.id} {...{ campus, profile }} /> : <History schoolId={school.id} />}</SchoolScope>}</>
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
      teacherSections.map(([section, label]) => <Route path={section} key={section} element={<div key={section}>
        <h2>{label}</h2>
        <TeacherScreen {...{ section, profile }} />
      </div>} />)}
      <Route path="*" element={<Navigate replace to={'/recoleccion/' + sections[0][0]} />} />
    </Routes>
  </section>
}
