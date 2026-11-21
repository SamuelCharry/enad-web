import { beforeEach, expect, it, vi } from 'vitest'
import { createWorker } from 'tesseract.js'
import { set } from 'idb-keyval'
import { readPhoto, SpanishModelMissing } from '../collect/readPhoto'

const worker = vi.hoisted(() => ({ recognize: vi.fn(), terminate: vi.fn() }))
vi.mock('tesseract.js', () => ({ createWorker: vi.fn(async () => worker), OEM: { LSTM_ONLY: 1 } }))
vi.mock('tesseract.js/dist/worker.min.js?url', () => ({ default: '/assets/worker.js' }))
vi.mock('tesseract.js-core/tesseract-core-lstm.wasm.js?url', () => ({ default: '/assets/core.js' }))
vi.mock('idb-keyval', () => ({ set: vi.fn() }))
beforeEach(() => { vi.clearAllMocks(); worker.recognize.mockResolvedValue({ data: { blocks: [] } }) })

it('usa los recursos locales y termina el trabajador después de leer', async () => {
  const file = new File([], 'lista.jpg')
  await readPhoto(file, vi.fn())
  expect(createWorker).toHaveBeenCalledWith('spa', 1, expect.objectContaining({ langPath: new URL(import.meta.env.BASE_URL + 'ocr/', document.baseURI).href }))
  expect(set).not.toHaveBeenCalled()
  expect(worker.recognize).toHaveBeenCalledWith(file, {}, { blocks: true })
  expect(worker.terminate).toHaveBeenCalledOnce()
})

it('carga un modelo escogido por el docente con el código de idioma correcto', async () => {
  const model = new File([], 'spa.traineddata')
  const bytes = Uint8Array.from([1, 2, 3])
  Object.defineProperty(model, 'arrayBuffer', { value: async () => bytes.buffer })
  await readPhoto(new File([], 'lista.jpg'), vi.fn(), model)
  expect(set).toHaveBeenCalledWith('enad-ocr-local/spa.traineddata', bytes)
  expect(createWorker).toHaveBeenCalledWith('spa', 1, expect.objectContaining({ cachePath: 'enad-ocr-local' }))
})

it('permite recuperar la carga del idioma si el trabajador informa un error de inicialización', async () => {
  vi.mocked(createWorker).mockImplementationOnce(async (_lang, _engine, options) => {
    options?.errorHandler?.(new Error('modelo no disponible'))
    return new Promise(() => {})
  })
  await expect(readPhoto(new File([], 'lista.jpg'), vi.fn())).rejects.toBeInstanceOf(SpanishModelMissing)
})
