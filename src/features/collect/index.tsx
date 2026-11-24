import { Home } from '../../app/Home'
import { homePath } from '../../app/navigation'
import { Pending } from '../teacher/Pending'
import { Help } from '../teacher/TeacherHome'
import { Review } from '../manage/Review'
import { Activities } from '../manage/Activities'
import { Downloads } from '../manage/Downloads'
import { LoadError } from '../../ui/LoadError'
import { useState } from 'react'
import { Link, Navigate, Route, Routes, useSearchParams } from 'react-router-dom'
import { useSession } from '../../data/session'
import type { UserProfile } from '../../domain/types'
import { useGroups } from '../../data/groups'
import { useSchools } from '../../data/scope'
import { type ImportKind } from '../../domain/import/schema'
import { Button } from '../../ui/components'
import { SchoolScope } from './common'
import { TeacherAttendance } from './Attendance'
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
const managementSections = ['colegios','personas','estudiantes','grupos','historicas','programa','calidad','importaciones'] as const
function ImportButton({ kind }: { kind: ImportKind }) {
  const { schools, loading, error } = useSchools()
  const [open, setOpen] = useState(false)
  if (error) return <LoadError message={error} />
  return <>
    <Button disabled={loading} onClick={() => setOpen(true)}>Importar archivo</Button>{open && <FileImport {...{ kind, schools }} onClose={() => setOpen(false)} />}</>
}
function EvaluationStart({profile}:{profile:UserProfile}) {
  const [params] = useSearchParams()
  const {groups,loading,error} = useGroups(undefined,{mine:true})
  if (loading) return <p role="status">Cargando grupos…</p>
  if (error) return <LoadError message={error}/>
  const group = groups.find(g => g.id === params.get('group')) || groups.find(g => (!params.has('school') || g.schoolId === params.get('school')) && (!params.has('campus') || g.campus === params.get('campus')) && (!params.get('subject') || g.subject === params.get('subject')))
  if (!group) return <TeacherScreen section="evaluacion" profile={profile}/>
  const next = new URLSearchParams(params)
  next.set('school',group.schoolId)
  next.set('group',group.id)
  next.set('campus',group.campus)
  return <Navigate replace to={'/portal/evaluacion?'+next}/>
}
function ScanSchool({profile}:{profile:UserProfile}) {
  const {schools,loading,error} = useSchools()
  if (error) return <LoadError message={error}/>
  if (loading) return <p role="status">Cargando colegios…</p>
  return <section><h2>Elige el colegio de la lista</h2><nav className="shortcut-list" aria-label="Colegio de la lista">
    {schools.filter(s => profile.schoolIds.includes(s.id)).map(s => <Link key={s.id} to={'/portal/estudiantes?'+new URLSearchParams({school:s.id,scan:'1'})}>{s.name}</Link>)}
  </nav></section>
}
function TeacherRoute({section,profile}:{section:typeof teacherSections[number][0];profile:UserProfile}) {
  const [params] = useSearchParams()
  if (section === 'evaluacion' && (!params.has('school') || (params.has('group') && !params.has('campus')))) return <EvaluationStart profile={profile}/>
  if (!params.has('school') && section === 'estudiantes' && params.has('scan') && profile.schoolIds.length > 1) return <ScanSchool profile={profile}/>
  return <TeacherScreen section={section} profile={profile}/>
}
function TeacherScreen({ section, profile }: { section: typeof teacherSections[number][0]; profile: UserProfile }) {
  const [params, setParams] = useSearchParams()
  const groupId = params.get('group') || ''
  const scopeParams = new URLSearchParams(params)
  scopeParams.delete('guide')
  const content = section === 'asistencia' ? <TeacherAttendance key={JSON.stringify([groupId,params.get('date')])} initialGroup={groupId} initialDate={params.get('date')} uid={profile.uid}/> : <><SchoolScope allCampuses={section === 'evaluacion' || section === 'grupos'} key={scopeParams.toString()} includeUnassigned={section === 'estudiantes' || section === 'evaluacion'} allSites={section === 'grupos'} onScopeChange={(school, campus) => {
    const next = new URLSearchParams({ school })
    if (campus !== null) next.set('campus', campus)
    if (params.has('guide')) next.set('guide','1')
    setParams(next, { replace: true })
  }} initialSchool={params.get('school') || ''} initialCampus={params.get('campus')} profile={profile} withCampus={section !== 'horas'}>{(school, campus) => {
    switch (section) {
      case 'evaluacion': return <Evaluations schoolId={school.id} campus={campus} initialGroup={groupId} initialSubject={params.get('subject')} initialMoment={params.get('moment')} school={school} studentId={params.get('student')} />
      case 'horas': return <Hours schoolId={school.id} />
      case 'grupos': return <Groups schoolId={school.id} initialGroup={groupId} campuses={school.campuses.filter(c => !profile.campusIds[school.id]?.length || profile.campusIds[school.id].includes(c.id))} {...{ campus, profile }} />
      case 'estudiantes': return <Students {...{ school, campus }} admin={false} uid={profile.uid} initialStudent={params.get('student')} scanOnOpen={params.has('scan')} />
    }
  }}</SchoolScope></>
  return <TaskGuide enabled={params.has('guide')} section={section} onClose={() => {
    const next = new URLSearchParams(params)
    next.delete('guide')
    setParams(next, { replace: true })
  }}>{content}</TaskGuide>
}
export function CollectRoutes() {
  const {profile} = useSession()
  if (!profile?.activo) return <p role="alert">Ingresa con una cuenta activa.</p>
  const teacher = profile.rol === 'docente', foundation = profile.rol === 'fundacion'
  const home = <Navigate replace to={homePath(profile.rol)}/>
  const imports = {colegios:'schools',personas:'teachers',estudiantes:'students',grupos:'groups',historicas:'evaluations'} as const
  return <section className="collect" key={profile.uid}><Routes>
    <Route path={teacher ? 'hoy' : 'inicio'} element={<Home/>}/>
    <Route path="actividades" element={<Activities role={profile.rol}/>}/>
    {teacher ? <>
      {teacherSections.map(([section]) => <Route key={section} path={section} element={<div className="teacher-screen"><TeacherRoute section={section} profile={profile}/></div>}/>)}
      <Route path="pendientes" element={<Pending uid={profile.uid}/>}/><Route path="ayuda" element={<Help/>}/>
    </> : <>
      <Route path="revision" element={<Review/>}/><Route path="descargas" element={<Downloads/>}/>
      {managementSections.filter(s => foundation || !['programa','historicas','calidad','importaciones'].includes(s)).map(section =>
        <Route key={section} path={section} element={<div className="admin-workspace">
          {section === 'colegios' ? <Schools restricted={!foundation}/> : section === 'personas' ? <Teachers profile={profile}/> :
           section === 'programa' ? <Program/> : section === 'importaciones' ? <ImportHistory/> : section === 'calidad' ? <DataQuality/> :
           section === 'historicas' ? <HistoryDirectory/> : <Rosters kind={section}/>}
          {foundation && section in imports && <details><summary>Importar registros</summary><ImportButton kind={imports[section as keyof typeof imports]}/></details>}
        </div>}/>)}
    </>}
    <Route path="*" element={home}/>
  </Routes></section>
}
