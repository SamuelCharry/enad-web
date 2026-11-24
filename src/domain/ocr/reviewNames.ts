import type { Student } from '../types'
import { nameKey } from '../nameKey'
import { cleanName, rosterMatches, validateName } from '../text/studentNameRules'
import type { NameCandidate } from './namePage'

export interface ReviewName extends NameCandidate {
  id: string
  page: string
  input: string
  gender: Student['gender']
  grade?: number
  choice?: string
}
type Matches = ReturnType<typeof rosterMatches<Student>>
export function reviewName(row: ReviewName, matches: Matches) {
  const strong = matches.filter(m => m.score >= .80)
  const best = strong[0]
  const key = nameKey(cleanName(row.input))
  const different = !!best && key !== nameKey(best.student.fullName)
  const partial = different && key.split(' ').length !== nameKey(best.student.fullName).split(' ').length
  const uncertain = best && (best.score < .93 || partial || (different && row.confidence != null && row.confidence < .85) ||
    (strong[1] && best.score - strong[1].score <= .030000000001))
  const choice = row.choice === 'new' || matches.some(m => m.student.id === row.choice) ? row.choice : undefined
  const id = choice ?? (uncertain ? '' : best?.student.id ?? 'new')
  const flags = [...new Set([...validateName(row.input, row.confidence), ...(row.input === row.name ? row.flags : []),
  ...(id === 'new' ? matches.map(m => 'posible_duplicado:' + m.student.id) : [])])]
  const problem = !cleanName(row.input) ? 'Escribe el nombre o quita la fila.' :
    !id ? 'Elige a qué estudiante corresponde.' : ''
  const identity = id === 'new' ? 'new:' + nameKey(cleanName(row.input)) : 'id:' + id
  return { id, flags, problem, identity }
}

/** Editing one row in a long list only requires matching that row again. */
export function reviewerForRoster(roster: readonly Student[]) {
  const cache = new WeakMap<ReviewName, Matches>()
  return (row: ReviewName) => {
    let matches = cache.get(row)
    if (!matches) {
      matches = rosterMatches(row.input, roster)
      cache.set(row, matches)
    }
    return { ...reviewName(row, matches), matches }
  }
}

export function scanReceipt(matched: number, created: number, pending: boolean) {
  const existing = matched === 1 ? '1 ya estaba registrado' : matched + ' ya estaban registrados'
  const fresh = created === 1 ? '1 nuevo' : created + ' nuevos'
  const sent = pending ? 'para revisión de la fundación. Pendiente de envío.' :
    (created === 1 ? 'enviado' : 'enviados') + ' a revisión de la fundación.'
  return existing + ', ' + fresh + ' ' + sent
}
