import { LEVELS, levelLabel } from './levels'
import type { Student, Subject, Moment } from './types'

/** Proposes groups for a moment, preserving roster order within each level. */
export function suggestGroups(students: readonly Student[], subject: Subject, moment: Moment, teacherCount: number) {
  if (!Number.isInteger(teacherCount) || teacherCount < 1) throw new RangeError('Indica al menos un docente.')
  const buckets = new Map(LEVELS[subject].map(key => [key, [] as string[]]))
  const seen = new Set<string>()
  for (const student of students) {
    const mark = student.levels[subject]
    if (student.retired || !mark || mark.moment !== moment || seen.has(student.id)) continue
    const bucket = buckets.get(mark.level)
    if (bucket) {
      seen.add(student.id);
      bucket.push(student.id)
    }
  }
  const capacity = Math.ceil(seen.size / teacherCount)
  const pairs = ['principiante/letra', 'principiante/un_digito', 'palabra/parrafo', 'resta/division']
  const groups: { studentIds: string[]; levelLabels: string[] }[] = []
  let members: string[] = [], levels = new Set<string>()
  function close() {
    if (members.length) groups.push({ studentIds: members, levelLabels: [...levels].map(l => levelLabel(subject, l)) })
    members = []
    levels = new Set()
  }
  for (const [level, ids] of buckets) {
    if (!ids.length) continue
    if (members.length && (capacity - members.length <= 5 || levels.size > 1 || !pairs.includes([...levels, level].join('/')))) close()
    for (const id of ids) {
      members.push(id)
      levels.add(level)
      if (members.length === capacity) close()
    }
  }
  close()
  return groups
}
