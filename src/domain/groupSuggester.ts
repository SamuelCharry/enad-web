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
  const capacity = Math.ceil(seen.size/teacherCount)
  const pairs = ['principiante/letra', 'principiante/un_digito', 'palabra/parrafo', 'resta/division']
  const blocks: {studentIds:string[]; levels:string[]}[] = []
  for (const [level, ids] of buckets) {
    if (!ids.length) continue
    const prior = blocks.at(-1)
    if (prior && pairs.includes([...prior.levels,level].join('/'))) {
      prior.levels.push(level)
      prior.studentIds.push(...ids)
    } else blocks.push({studentIds:[...ids], levels:[level]})
  }
  const slots = blocks.map(b => Math.ceil(b.studentIds.length / 60))
  let used = slots.reduce((a,b) => a+b,0)
  if (used > teacherCount) throw new RangeError('Estos niveles necesitan al menos '+used+' docentes para formar grupos compatibles de hasta 60 estudiantes.')
  while (used < Math.min(teacherCount, seen.size)) {
    let largest = -1
    blocks.forEach((b,i) => {
      if (slots[i] < b.studentIds.length && (largest < 0 || b.studentIds.length / slots[i] > blocks[largest].studentIds.length / slots[largest])) largest = i
    })
    slots[largest]++
    used++
  }
  const marks = new Map(students.map(s => [s.id,s.levels[subject]?.level]))
  return blocks.flatMap((block,i) => {
    const result = []
    let start = 0
    const boundary = buckets.get(block.levels[0])!.length
    for (let left = slots[i]; left > 0; left--) {
      const end = start + Math.ceil((block.studentIds.length-start)/left)
      const splitAtLevel = left > 1 && boundary > start && boundary <= end &&
        capacity <= 60 && end-boundary <= 5 && block.studentIds.length-boundary <= (left-1)*60
      const stop = splitAtLevel ? boundary : end
      const studentIds = block.studentIds.slice(start,stop)
      const levels = new Set(studentIds.map(id => marks.get(id)!))
      result.push({studentIds, levelLabels:[...levels].map(l => levelLabel(subject,l))})
      start = stop
    }
    return result
  })
}
