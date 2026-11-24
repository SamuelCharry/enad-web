import { getFunctions, httpsCallable, connectFunctionsEmulator } from 'firebase/functions'
import type { Jornada, Role } from '../domain/types'
import { ApiError } from '../domain/types'
import { app, emulatorHost } from './firebase'
import { reportCache } from './reportCache'

let instance: ReturnType<typeof getFunctions> | undefined
async function invoke<T>(name: string, payload: object): Promise<T> {
  if (!instance) {
    instance = getFunctions(app, 'southamerica-east1')
    if (emulatorHost) connectFunctionsEmulator(instance, emulatorHost, 5001)
  }
  try {
    const response = await httpsCallable<object,T>(instance, name)(payload)
    reportCache.clear()
    return response.data
  } catch (error) {
    const code = (error as {code?: string}).code
    const statuses: Record<string,number> = {
      'functions/permission-denied':403, 'functions/unauthenticated':401, 'functions/not-found':404,
      'functions/invalid-argument':400, 'functions/already-exists':409, 'functions/failed-precondition':409,
    }
    if (code && statuses[code]) throw new ApiError(statuses[code], (error as Error).message)
    throw new ApiError(503, 'No se pudo completar la solicitud. Revisa tu conexión e intenta de nuevo.')
  }
}
export interface AccountInput { fullName: string; username: string; rol: Role; schoolIds: string[]; campusIds?: Record<string,string[]>; jornada?: Jornada }
export function createAccount(input: AccountInput) {
  if (!input.fullName.trim() || !/^[a-z0-9.]{3,30}$/.test(input.username)) throw new ApiError(400, 'Escribe el nombre y un usuario de 3 a 30 letras minúsculas, números o puntos.')
  return invoke<{uid:string; username:string; password:string}>('createAccount',input)
}
export const deleteAccount = (uid:string) => invoke<{deleted:true}>('deleteAccount',{uid})
export const resetPassword = (uid:string) => invoke<{password:string}>('resetPassword',{uid})
export const mergeStudents = (fromId:string, intoId:string) => invoke<{moved:{attendance:number; evaluations:number; groups:number}}>('mergeStudents',{fromId,intoId})
