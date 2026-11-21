import type { Group, School, Student, UserProfile } from '../domain/types'
import { LEVELS, SUBJECTS, subjectLabel } from '../domain/levels'
import { nameKey } from '../domain/nameKey'

export interface QualityIssue { kind: string; record: string; detail: string; directory: string; search: string; key: string; schoolId?: string; studentId?: string }
export function qualityIssues(students: Student[], groups: Group[], users: UserProfile[], schools: School[]) {
  const issues: QualityIssue[] = []
  const schoolNames = new Map(schools.map(s => [s.id, s.name]))
  const teacher = new Map(users.filter(u => u.rol === 'docente').map(u => [u.uid, u]))
  const byStudent = new Set(students.filter(s => !s.retired && s.active !== false).map(s => s.id))
  const names = new Map<string, Student[]>()
  function add(kind: string, id: string, record: string, detail: string, directory: string, search: string) {
    issues.push({ kind, key: JSON.stringify([kind, id]), record, detail, directory, search })
  }
  for (const s of students) {
    if (!byStudent.has(s.id)) continue
    const missing = SUBJECTS.filter(subject => !LEVELS[subject].includes(s.levels?.[subject]?.level ?? ''))
    const school = schoolNames.get(s.schoolId) ?? s.schoolId
    if (missing.length) issues.push({
      kind: 'Estudiantes sin nivel', key: JSON.stringify(['nivel', s.id]), record: s.fullName,
      detail: school + ' · ' + missing.map(subjectLabel).join(' y '), directory: 'evaluaciones',
      schoolId: s.schoolId, studentId: s.id, search: s.code
    })
    const key = s.nameKey || nameKey(s.fullName)
    if (key) {
      const same = JSON.stringify([s.schoolId, key])
      const list = names.get(same) ?? []
      list.push(s)
      names.set(same, list)
    }
  }
  for (const list of names.values()) if (list.length > 1) for (const s of list) {
    add('Posibles duplicados', s.id, s.fullName, (schoolNames.get(s.schoolId) ?? s.schoolId) + ' · Códigos ' + list.map(v => v.code).join(', '), 'estudiantes', s.code)
  }
  for (const g of groups) {
    const owner = teacher.get(g.teacherId), school = schoolNames.get(g.schoolId) ?? g.schoolId
    if (!owner?.activo || !owner.schoolIds?.includes(g.schoolId)) add('Grupos sin docente asignado', g.id, g.name, school, 'grupos', g.name)
    if (!g.studentIds?.some(id => byStudent.has(id))) add('Grupos sin estudiantes activos', g.id, g.name, school, 'grupos', g.name)
  }
  for (const u of users) {
    const schools = u.schoolIds ?? []
    if (u.rol === 'docente' && !schools.length) add('Docentes sin institución', u.uid, u.fullName, u.email, 'docentes', u.email)
    if (!u.activo && (schools.length || (u.regions ?? []).length || Object.values(u.campusIds ?? {}).some(ids => ids.length) || groups.some(g => g.teacherId === u.uid))) {
      add('Usuarios inactivos con asignaciones', u.uid, u.fullName, u.email, u.rol === 'docente' ? 'docentes' : '', u.email)
    }
  }
  return issues
}
