import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { cachedResult, reportCache, reportTtl } from './reportCache'

beforeEach(() => reportCache.clear())
afterEach(() => vi.restoreAllMocks())
it('restaura resultados de la pestaña hasta los diez minutos y separa identidades y filtros', async () => {
  const start = Date.now()
  const clock = vi.spyOn(Date, 'now').mockReturnValue(start)
  const read = vi.fn(async () => ({ students: 12 }))
  const first = await cachedResult('uid1-admin-resumen-sede1', read)
  reportCache.delete('uid1-admin-resumen-sede1')
  clock.mockReturnValue(start + reportTtl - 1)
  expect(await cachedResult('uid1-admin-resumen-sede1', read)).toEqual(first)
  expect(read).toHaveBeenCalledOnce()
  await cachedResult('uid2-admin-resumen-sede1', read)
  await cachedResult('uid1-admin-resumen-sede2', read)
  clock.mockReturnValue(start + reportTtl)
  await cachedResult('uid1-admin-resumen-sede1', read)
  expect(read).toHaveBeenCalledTimes(4)
})
it('una invalidación impide que una consulta anterior repueble sessionStorage', async () => {
  let resolve!: (n: number) => void
  const pending = cachedResult('old', () => new Promise<number>(r => { resolve = r }))
  reportCache.clear()
  resolve(1)
  await pending
  expect(Object.keys(sessionStorage).filter(k => k.startsWith('enad:report:'))).toEqual([])
  expect(await cachedResult('old', async () => 2)).toBe(2)
})
