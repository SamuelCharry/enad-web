import { useOutletContext } from 'react-router-dom'
import type { UserProfile } from '../domain/types'
import { TeacherHome } from '../features/teacher/TeacherHome'
import { ManagerHome } from '../features/manage/ManagerHome'

export function Home() {
  const profile = useOutletContext<UserProfile>()
  return profile.rol === 'docente' ? <TeacherHome profile={profile} /> : <ManagerHome profile={profile} />
}
