import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { httpsCallable, connectFunctionsEmulator } from 'firebase/functions'
import { createWorker } from 'tesseract.js'
import { readPhoto } from './readPhoto'

const call = vi.hoisted(() => vi.fn())
const worker = vi.hoisted(() => ({ recognize: vi.fn(), terminate: vi.fn() }))
vi.mock('firebase/functions', () => ({ getFunctions: vi.fn(() => ({})), httpsCallable: vi.fn(() => call), connectFunctionsEmulator: vi.fn() }))
vi.mock('../../data/firebase', () => ({ app: { options: { projectId: 'demo-enad' } } }))
vi.mock('tesseract.js', () => ({ createWorker: vi.fn(async () => worker), OEM: { LSTM_ONLY: 1 } }))
beforeEach(() => {
  vi.clearAllMocks()
  worker.recognize.mockResolvedValue({ data: { blocks: [{ paragraphs: [{ lines: [{ text: 'Rosa Pérez', confidence: 72, bbox: { x0: 0, y0: 0, x1: 30, y1: 10 } }] }] }] } })
})
afterEach(() => vi.restoreAllMocks())
it('usa la función regional del emulador con el colegio y la imagen recortada', async () => {
  call.mockResolvedValue({ data: { engine: 'cloud-vision', lines: [{ text: 'ANA RUIZ', confidence: .8 }] } })
  const result = await readPhoto(new File(['abc'], 'foto.jpg'), vi.fn(), undefined, 's1')
  expect(connectFunctionsEmulator).toHaveBeenCalledWith(expect.anything(), 'localhost', 5001)
  expect(httpsCallable).toHaveBeenCalledWith(expect.anything(), 'ocrRoster', expect.anything())
  expect(call).toHaveBeenCalledWith({ schoolId: 's1', imageBase64: 'YWJj' })
  expect(result).toMatchObject({ engine: 'Lectura en línea', rows: [{ name: 'Ana Ruiz', flags: ['mayusculas', 'ocr_baja_confianza'] }] })
  expect(createWorker).not.toHaveBeenCalled()
})
it.each(['offline', 'error', 'demasiado grande'])('lee localmente con %s', async mode => {
  vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(mode !== 'offline')
  const file = new File(['abc'], 'foto.jpg')
  if (mode === 'demasiado grande') Object.defineProperty(file, 'size', { value: 4 * 1024 * 1024 + 1 })
  call.mockRejectedValue(new Error('unavailable'))
  const result = await readPhoto(file, vi.fn(), undefined, 's1')
  expect(call).toHaveBeenCalledTimes(mode === 'error' ? 1 : 0)
  expect(result).toMatchObject({ engine: 'Lectura en este dispositivo', rows: [{ name: 'Rosa Pérez', confidence: .72, flags: ['ocr_baja_confianza'] }] })
  expect(worker.terminate).toHaveBeenCalledOnce()
})
