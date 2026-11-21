import { useSession } from '../../data/session'
import { Foundation } from './Foundation'
import { Teacher } from './Teacher'
import { Skeleton } from './ReportState'
import './reports.css'

export function ReportRoutes() {
  const { profile, loading, error } = useSession()
  if (loading) return <div className="rep"><Skeleton /></div>
  if (error || !profile?.activo) return <p role="alert">{error || 'Necesitas una sesión activa para consultar los informes.'}</p>
  const scope = JSON.stringify([profile.uid, profile.rol, profile.schoolIds, profile.campusIds, profile.regions, profile.projectId])
  return <div className="rep" key={scope}>{profile.rol === 'docente' ? <Teacher profile={profile} /> : <Foundation />}</div>
}
