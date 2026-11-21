import type { UserProfile } from '../../domain/types'
import { LegacyHome } from '../../app/Home'

/** Inicio de coordinación, fundación y admin. Propiedad de Team H. */
export function ManagerHome(_props: { profile: UserProfile }) {
  return <LegacyHome />
}
