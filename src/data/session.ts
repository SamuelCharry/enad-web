import { useSyncExternalStore } from 'react'
import { onAuthStateChanged, signInWithEmailAndPassword, signOut as firebaseSignOut, type User } from 'firebase/auth'
import { doc, onSnapshot } from 'firebase/firestore'
import type { UserProfile } from '../domain/types'
import { auth, db } from './firebase'
import { api, apiError, fail, profileOf, reportCache } from './core'

type Session = { loading: boolean; user: User | null; profile: UserProfile | null; error?: string }
const initial: Session = { loading: true, user: null, profile: null }
let state = initial
const listeners = new Set<() => void>()
function publish(next: Session) {
  if (state.profile && JSON.stringify(state.profile) !== JSON.stringify(next.profile)) reportCache.clear()
  state = next
  listeners.forEach(listener => listener())
}
let stop: (() => void) | undefined
function subscribe(update: () => void) {
  listeners.add(update)
  if (!stop) {
    let profileStop: (() => void) | undefined
    const authStop = onAuthStateChanged(auth, user => {
      profileStop?.()
      publish({ loading: !!user, user, profile: null })
      if (!user) return
      const failed = (error: unknown) => {
        if (auth.currentUser?.uid === user.uid) publish({ loading: false, user, profile: null, error: apiError(error).message })
      }
      profileStop = onSnapshot(doc(db, 'users', user.uid), snap => {
        if (auth.currentUser?.uid !== user.uid) return
        try { publish({ loading: false, user, profile: profileOf(snap) }) } catch (error) { failed(error) }
      }, failed)
    })
    stop = () => {
      authStop();
      profileStop?.()
    }
  }
  return () => {
    listeners.delete(update)
    if (!listeners.size) {
      stop?.();
      stop = undefined;
      state = initial
    }
  }
}
/** Observes active session changes, including role revocation. */
export function watchSession(cb: (s: Session) => void) {
  cb(state)
  return subscribe(() => cb(state))
}
/** Signs in with either an ENAd username or an email. */
export async function signIn(usernameOrEmail: string, password: string): Promise<void> {
  const login = usernameOrEmail.trim().toLowerCase()
  const email = login && !login.includes('@') ? login + '@enad.app' : login
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !password) fail(400, 'Escribe tu usuario o correo y tu contraseña.')
  await api(() => signInWithEmailAndPassword(auth, email, password))
  reportCache.clear()
}
/** Ends the primary Firebase session and clears its reports. */
export async function signOut(): Promise<void> {
  reportCache.clear()
  await api(() => firebaseSignOut(auth))
}
/** Subscribes to Auth and the active user's live profile. */
export function useSession(): Session { return useSyncExternalStore(subscribe, () => state) }
/** Whether this active user may collect data. */
export function canWrite(profile: UserProfile | null): boolean {
  return profile?.activo === true && (profile.rol === 'docente' || profile.rol === 'admin')
}
