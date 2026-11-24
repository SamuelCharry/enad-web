import { nameKey } from '../nameKey'
import { cleanName, validateName } from '../text/studentNameRules'

export interface NameLine { text: string; confidence?: number | null; box?: { x: number; y: number; w: number; h: number } }
export interface NameCandidate { name: string; raw: string; confidence: number | null; flags: string[] }

const header = /^(?:c[oó]digos?|sexo|edad|nombres?|apellidos?|lista|listado|grado|curso|fecha|docente|colegio|institución|observaci[oó]n(?:es)?|notas?|total|asistencia|página|estudiantes?|lunes|martes|miércoles|jueves|viernes)\b/iu
const date = /^(?:\d{1,4}[/.-]\d{1,2}[/.-]\d{1,4}|\d{1,2}\s+de\s+\p{L}+\s+de\s+\d{4})\b/u
const monthDate = /^\d{1,2}\s+(?:de\s+)?(?:enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)\b/iu
const note = /^(?:traer|llevar|recordar|pendientes?|revisar|firma|falta|faltan|faltaron|ausentes?|no (?:vino|asisti[oó]))\b/iu
const continuation = /\s(?:de|del|la|las|los|y)$/iu
// A trailing sex marker beside an age/grade is a printed table column. An isolated M. can be an initial.
const demographicColumns = /\s+(?:[fm]\s+\d{1,2}|\d{1,2}\s+[fm])(?:\s+[345][°º]?)?$/iu
const damaged = /[^\p{L}\p{M}\s'’-]/u
function join(a: NameLine, b: NameLine): NameLine {
  const confidence = [a.confidence, b.confidence].filter((n): n is number => n != null)
  return { text: a.text + ' ' + b.text, confidence: confidence.length ? Math.min(...confidence) : null, box: b.box }
}

function beside(a: NameLine, b: NameLine) {
  const p = a.box, q = b.box
  return p && q && q.x >= p.x + p.w * .8 && q.x - p.x - p.w < 3 * Math.max(p.h, q.h)
    && Math.abs(p.y + p.h / 2 - q.y - q.h / 2) < .45 * Math.min(p.h, q.h)
}

export function candidatesFromLines(lines: readonly NameLine[]) {
  const rows: NameCandidate[] = []
  const seen = new Set<string>()
  let previous: NameLine | undefined
  let omitted = 0
  function emit() {
    if (!previous) return
    const raw = previous.text
    const name = cleanName(raw)
    const key = nameKey(name)
    if (name.includes(' ') && !seen.has(key)) {
      seen.add(key)
      if (rows.length === 45) omitted++
      else {
        const confidence = previous.confidence ?? null
        const flags = new Set(validateName(raw, confidence))
        if (damaged.test(raw) || /\s-\s/u.test(raw) || /(\p{L})\1\1/iu.test(raw) || !/[aeiouáéíóúü]/iu.test(name)) flags.add('formato_nombre')
        rows.push({ raw, name, confidence, flags: [...flags] })
      }
    }
    previous = undefined
  }
  for (const line of lines) {
    const raw = line.text.trim()
    const text = raw.replace(/^[-•]\s+/u, '').replace(/^\d+(?:\s*[.)-]\s*|\s+)(?=\p{L})/u, '').replace(demographicColumns, '')
    if (!text || header.test(text) || note.test(text) || date.test(raw) || monthDate.test(raw) || !cleanName(text)) {
      emit()
      continue
    }
    const next = { ...line, text }
    const single = !cleanName(text).includes(' ')
    const adjacentFragment = previous && beside(previous,next) && (single || !cleanName(previous.text).includes(' '))
    const wrappedSurname = previous && single && continuation.test(previous.text)
    if (previous && (adjacentFragment || wrappedSurname)) {
      previous = join(previous,next)
    } else {
      emit()
      previous = next
    }
  }
  emit()
  return { rows, omitted }
}
