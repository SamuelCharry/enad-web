import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from 'firebase/firestore'

// Public web config of Firebase project enad-entrega-final (same project as the mobile app).
export const firebaseConfig = {
  apiKey: 'AIzaSyBTaf_EkzWtq-lhJ1RJC1VOH1dGYxkq2QU',
  authDomain: 'enad-entrega-final.firebaseapp.com',
  projectId: 'enad-entrega-final',
  storageBucket: 'enad-entrega-final.firebasestorage.app',
  messagingSenderId: '761115672008',
  appId: '1:761115672008:web:2741a5d8d574a8675b14fd',
}

export const app = initializeApp(firebaseConfig)
export const auth = getAuth(app)
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
})
