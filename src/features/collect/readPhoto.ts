import { createWorker, OEM, type Worker } from 'tesseract.js'
import { set } from 'idb-keyval'
import workerPath from 'tesseract.js/dist/worker.min.js?url'
import corePath from 'tesseract.js-core/tesseract-core-lstm.wasm.js?url'
import { parseRows } from '../../domain/ocr/rowParser'

export class SpanishModelMissing extends Error { }

export async function readPhoto(file: File, progress: (percent: number) => void, model?: File) {
  const langPath = new URL(import.meta.env.BASE_URL + 'ocr/', document.baseURI).href
  // Tesseract 7 reports some initialization errors to errorHandler without rejecting createWorker.
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
        errorHandler: error => reject(new SpanishModelMissing(String(error))),
      })
    }
    void start().then(resolve, reject)
  })
  try {
    const { data } = await worker.recognize(file, {}, { blocks: true })
    const lines = (data.blocks ?? []).flatMap(block => block.paragraphs.flatMap(paragraph =>
      paragraph.lines.map(line => ({
        top: line.bbox.y0, bottom: line.bbox.y1,
        elements: line.words.map(word => ({
          text: word.text, left: word.bbox.x0, right: word.bbox.x1, confidence: word.confidence / 100,
        })),
      }))
    ))
    return parseRows(lines)
  } finally {
    await worker.terminate()
  }
}
