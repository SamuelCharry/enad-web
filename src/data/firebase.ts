import { initializeApp } from 'firebase/app'
import { connectAuthEmulator, getAuth } from 'firebase/auth'
import { connectFirestoreEmulator, initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from 'firebase/firestore'

// Public web config of Firebase project enad-entrega-final (same project as the mobile app).
export const firebaseConfig = {
  apiKey: 'AIzaSyBTaf_EkzWtq-lhJ1RJC1VOH1dGYxkq2QU',
  authDomain: 'enad-entrega-final.firebaseapp.com',
  projectId: 'enad-entrega-final',
  storageBucket: 'enad-entrega-final.firebasestorage.app',
  messagingSenderId: '761115672008',
  appId: '1:761115672008:web:2741a5d8d574a8675b14fd',
}

export const emulatorHost = import.meta.env.VITE_USE_EMULATORS === 'true' ? import.meta.env.VITE_EMULATOR_HOST || 'localhost' : undefined
export const app = initializeApp(emulatorHost ? { ...firebaseConfig, projectId: import.meta.env.VITE_EMULATOR_PROJECT_ID || 'demo-enad', authDomain: (import.meta.env.VITE_EMULATOR_PROJECT_ID || 'demo-enad') + '.firebaseapp.com' } : firebaseConfig)
export const auth = getAuth(app)
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
})

if (emulatorHost) {
  connectAuthEmulator(auth, 'http://' + emulatorHost + ':9099', { disableWarnings: true })
  connectFirestoreEmulator(db, emulatorHost, 8080)
}
