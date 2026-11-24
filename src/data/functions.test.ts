import { expect, it, vi } from 'vitest'
import { createAccount, deleteAccount, mergeStudents, resetPassword } from './functions'
const mocks = vi.hoisted(() => ({region:vi.fn(() => ({})),emulator:vi.fn(),call:vi.fn()}))
vi.mock('./firebase',() => ({app:{},emulatorHost:'127.0.0.1'}))
vi.mock('firebase/functions',() => ({
  getFunctions:mocks.region, connectFunctionsEmulator:mocks.emulator,
  httpsCallable:(_instance:unknown,name:string) => (input:object) => mocks.call(name,input),
}))
it('uses the contract callables and the regional emulator for every account operation',async () => {
  const profile = {rol:'docente' as const,username:'ana.paz',fullName:'Ana Paz',schoolIds:['ie1']}
  const credentials = {uid:'new',username:'ana.paz',password:'test-secret'}
  mocks.call.mockResolvedValueOnce({data:credentials}).mockResolvedValueOnce({data:{password:'reset-secret'}})
    .mockResolvedValueOnce({data:{deleted:true}}).mockResolvedValueOnce({data:{moved:{attendance:2,evaluations:3,groups:1}}})
  expect(await createAccount(profile)).toEqual(credentials)
  expect(await resetPassword('new')).toEqual({password:'reset-secret'})
  expect(await deleteAccount('new')).toEqual({deleted:true})
  expect(await mergeStudents('duplicado','original')).toHaveProperty('moved.groups',1)
  expect(mocks.region).toHaveBeenCalledWith({},'southamerica-east1')
  expect(mocks.emulator).toHaveBeenCalledWith({},'127.0.0.1',5001)
  expect(mocks.call.mock.calls).toEqual([['createAccount',profile],['resetPassword',{uid:'new'}],['deleteAccount',{uid:'new'}],['mergeStudents',{fromId:'duplicado',intoId:'original'}]])
})
it('validates usernames locally and preserves callable errors in Spanish',async () => {
  expect(() => createAccount({username:'Ana Paz',fullName:'Ana Paz',rol:'docente',schoolIds:['s']})).toThrow(/usuario/)
  mocks.call.mockRejectedValueOnce({code:'functions/permission-denied',message:'Solo puedes gestionar tu colegio.'})
  await expect(deleteAccount('otro')).rejects.toMatchObject({status:403,message:'Solo puedes gestionar tu colegio.'})
})

it('presenta el nombre de usuario duplicado sin el código del servicio',async () => {
  mocks.call.mockRejectedValueOnce({code:'functions/invalid-argument',message:'Ese usuario ya existe. [400]'})
  await expect(createAccount({username:'ana.paz',fullName:'Ana Paz',rol:'docente',schoolIds:['s']})).rejects.toMatchObject({status:409,message:'Ese usuario ya está en uso. Elige otro.'})
})
