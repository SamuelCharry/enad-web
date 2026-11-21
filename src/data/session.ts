import type { User } from 'firebase/auth'
import type { UserProfile } from '../domain/types'
export async function signIn(_usernameOrEmail: string, _password: string): Promise<void> { throw new Error('No implementado') }
export async function signOut(): Promise<void> { throw new Error('No implementado') }
export function useSession(): { loading: boolean; user: User | null; profile: UserProfile | null; error?: string } {
  return { loading: false, user: null, profile: null }
}
export function canWrite(profile: UserProfile | null): boolean { return profile?.rol === 'docente' || profile?.rol === 'admin' }
