import { createWorker, OEM, type Worker } from 'tesseract.js'
import { set } from 'idb-keyval'
import workerPath from 'tesseract.js/dist/worker.min.js?url'
import corePath from 'tesseract.js-core/tesseract-core-lstm.wasm.js?url'
import { candidatesFromLines, type NameLine } from '../../domain/ocr/namePage'
import { getFunctions, connectFunctionsEmulator, httpsCallable } from 'firebase/functions'
import { app } from '../../data/firebase'

let regional: ReturnType<typeof getFunctions> | undefined
async function cloud(file: File, schoolId: string): Promise<NameLine[]> {
  if (!regional) {
    regional = getFunctions(app, 'southamerica-east1')
    if (import.meta.env.VITE_USE_EMULATORS === 'true' || app.options.projectId?.startsWith('demo-')) {
      connectFunctionsEmulator(regional, import.meta.env.VITE_EMULATOR_HOST || 'localhost', 5001)
    }
  }
  const imageBase64 = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result).split(',')[1])
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
  const { data } = await httpsCallable<{ schoolId: string; imageBase64: string }, { engine: string; lines: NameLine[] }>(regional, 'ocrRoster', { timeout: 12000 })({ schoolId, imageBase64 })
  if (data.engine !== 'cloud-vision' || !Array.isArray(data.lines) ||
    data.lines.some(l => typeof l?.text !== 'string' || (l.confidence != null &&
      (!Number.isFinite(l.confidence) || l.confidence < 0 || l.confidence > 1)))) throw new Error('Lectura incompleta')
  return data.lines
}


export class SpanishModelMissing extends Error { override name = 'SpanishModelMissing' }

async function local(file: File, progress: (percent: number) => void, model?: File) {
  const langPath = new URL(import.meta.env.BASE_URL + 'ocr/', document.baseURI).href
  // Tesseract 7 reports some initialization errors to errorHandler without rejecting createWorker.
  let failRecognition: ((reason: Error) => void) | undefined
  const worker = await new Promise<Worker>((resolve, reject) => {
    const start = async () => {
      // Tesseract 7 initializes Lang objects with their bytes as the name.
      // Stage an optional local model in its existing IndexedDB cache and initialize by ISO code.
      const cachePath = model ? 'enad-ocr-local' : undefined
      if (model) await set(cachePath + '/spa.traineddata', new Uint8Array(await model.arrayBuffer()))
      return createWorker('spa', OEM.LSTM_ONLY, {
        workerPath, corePath, langPath, cachePath,
        logger: event => {
          if (event.status === 'recognizing text') progress(Math.round(event.progress * 100))
        },
        errorHandler: error => (failRecognition ?? reject)(new SpanishModelMissing(String(error))),
      })
    }
    void start().then(resolve, reject)
  })
  try {
    const { data } = await Promise.race([worker.recognize(file, {}, { blocks: true }),
    new Promise<never>((_, reject) => { failRecognition = reject })])
    return (data.blocks ?? []).flatMap(block => block.paragraphs.flatMap(paragraph =>
      paragraph.lines.map(line => ({
        text: line.text.trim(), confidence: line.confidence / 100,
        box: { x: line.bbox.x0, y: line.bbox.y0, w: line.bbox.x1 - line.bbox.x0, h: line.bbox.y1 - line.bbox.y0 }
      }))))
  } finally {
    await worker.terminate()
  }
}

export async function readPhoto(file: File, progress: (percent: number) => void, model?: File, schoolId?: string) {
  if (schoolId && file.size <= 4 * 1024 * 1024 && navigator.onLine !== false) {
    try { return { ...candidatesFromLines(await cloud(file, schoolId)), engine: 'Lectura en línea' } }
    catch { /* The same cropped page can be read locally. */ }
  }
  return { ...candidatesFromLines(await local(file, progress, model)), engine: 'Lectura en este dispositivo' }
}
