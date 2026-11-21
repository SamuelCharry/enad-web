import { foldOcrConfusions } from '../nameKey'
import type { ParsedRow } from './rowParser'
import { blockingIssues } from './rowValidator'
import { nameSimilarity } from './similarity'

/** Authoritative roster fields used to resolve a scanned row. */
export interface RosterStudent {
  id: string;
  name: string;
  code?: string | null;
  age?: number | null;
  sex?: string | null
}
/** Review outcome, including alternatives and the reason for manual confirmation. */
export interface RowDecision {
  status: 'invalid' | 'review' | 'matched' | 'newStudent'
  candidates: { student: RosterStudent; score: number }[]
  reasons: string[]
  chosenStudentId?: string
}
/** Matches a validated transcription against authoritative codes and names. */
export function matchRow(row: ParsedRow, roster: RosterStudent[]): RowDecision {
  const errors = blockingIssues(row)
  if (errors.length) return { status: 'invalid', candidates: [], reasons: errors }
  const cautions = new Set([...row.readingIssues, ...row.issues])
  if (!cautions.size && Object.values(row.confidence).some(v => v < .6)) cautions.add('Lectura de baja confianza. Verifica los datos.')
  const code = foldOcrConfusions(row.code?.trim() ?? '')
  function demographics(s: RosterStudent) {
    return Number(row.age != null && s.age != null && Math.abs(row.age - s.age) <= 1) + Number(!!row.sex && s.sex?.toUpperCase() === row.sex.toUpperCase())
  }
  const ranked = roster.map(student => ({ student, score: nameSimilarity(row.name, student.name) }))
  const exact = ranked.filter(c => code && c.student.code?.trim() === code).sort((a, b) => b.score - a.score)
  if (exact.length) {
    if (exact.length > 1) cautions.add('El código corresponde a varios estudiantes.')
    if (exact[0].score < .8) cautions.add('El código coincide, pero el nombre leído es diferente.')
    const alternatives = ranked.filter(c => !exact.includes(c) && c.score >= .8 && c.score >= exact[0].score - .030000000001).sort((a, b) => b.score - a.score)
    if (alternatives.length) cautions.add('El nombre también coincide con otro estudiante. Verifica el código.')
    if (cautions.size) return { status: 'review', candidates: [...exact, ...alternatives].slice(0, 3), reasons: [...cautions] }
    return { status: 'matched', candidates: exact, reasons: ['Coincide el código.'], chosenStudentId: exact[0].student.id }
  }
  ranked.sort((a, b) => b.score - a.score || demographics(b.student) - demographics(a.student) || (a.student.id < b.student.id ? -1 : Number(a.student.id > b.student.id)))
  const best = ranked[0], candidates = ranked.slice(0, 3)
  if (!best || best.score < .8) return { status: cautions.size ? 'review' : 'newStudent', candidates: [], reasons: [...cautions] }
  if (ranked[1] && best.score - ranked[1].score <= .030000000001) cautions.add('Hay dos nombres con una coincidencia similar.')
  if (code && best.student.code?.trim()) cautions.add('El código leído difiere del registrado.')
  if (best.score < .93) cautions.add('Confirma la coincidencia del nombre.')
  if (cautions.size) return { status: 'review', candidates, reasons: [...cautions] }
  return { status: 'matched', candidates, reasons: ['Coincide el nombre.'], chosenStudentId: best.student.id }
}
