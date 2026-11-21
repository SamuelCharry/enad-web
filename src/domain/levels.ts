import type { Moment, Subject } from './types'

/** Subject identifiers stored in Firestore. */
export const SUBJECTS: Subject[] = ['lectura', 'matematicas']
/** Evaluation moments in display order. */
export const MOMENTS: Moment[] = ['linea_base', 'linea_media_1', 'linea_media_2', 'linea_final', 'verificacion']
/** Increasing mastery within each subject. */
export const LEVELS: Record<Subject, string[]> = {
  lectura: ['principiante', 'letra', 'palabra', 'parrafo', 'cuento', 'comprension'],
  matematicas: ['principiante', 'un_digito', 'dos_digitos', 'resta', 'division', 'problema_escrito'],
}
const labels = {
  lectura: ['Principiante', 'Letra', 'Palabra', 'Párrafo', 'Cuento', 'Comprensión'],
  matematicas: ['Principiante', '1 dígito', '2 dígitos', 'Resta', 'División', 'Problema escrito'],
}
/** Spanish level label, retaining unknown historical values. */
export function levelLabel(subject: Subject, level: string) { return labels[subject][LEVELS[subject].indexOf(level)] ?? level }
/** Spanish moment label. */
export function momentLabel(m: Moment) { return ['Línea Base', 'Línea Media 1', 'Línea Media 2', 'Línea Final', 'Verificación'][MOMENTS.indexOf(m)] ?? m }
/** Spanish subject label. */
export function subjectLabel(s: Subject) { return s === 'lectura' ? 'Lectura' : 'Matemáticas' }
/** Only ordered moments contribute to the student's current level. */
export const MOMENT_ORDER: Partial<Record<Moment, number>> = { linea_base: 0, linea_media_1: 1, linea_media_2: 2, linea_final: 3 }
/** Whether an evaluation can replace the stored level. */
export function shouldOverwriteLevel(current: Moment | undefined, next: Moment) {
  const order = MOMENT_ORDER[next]
  const previous = current ? MOMENT_ORDER[current] : undefined
  return order !== undefined && order >= (previous ?? -1)
}
