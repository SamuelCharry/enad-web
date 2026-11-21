import { expect, it } from 'vitest'
import { qualityIssues } from './quality'
import type { Group, Student, UserProfile } from '../domain/types'

it('agrupa nameKey dentro de la institución, omite retirados y detecta asignaciones inválidas', () => {
  const s: Student = { id: 'a', schoolId: 'ie', campus: 'c', code: '01', nameKey: 'ana paz', fullName: 'Ana Paz', grade: 3, age: null, sample: null, gender: '', active: true, retired: false, provisional: false, levels: { lectura: { level: 'letra', moment: 'linea_base', date: '2026-01-01' } } }
  const u: UserProfile = { uid: 't', rol: 'docente', activo: false, fullName: 'Sol', email: 's@example.test', schoolIds: [], campusIds: {}, jornada: 'única', regions: [] }
  const g: Group = { id: 'g', name: 'Grupo', schoolId: 'ie', campus: 'c', subject: 'lectura', teacherId: 't', teacherName: 'Sol', studentIds: ['retirado'] }
  const issues = qualityIssues([s, { ...s, id: 'b', code: '02' }, { ...s, id: 'c', schoolId: 'otra' }, { ...s, id: 'retirado', retired: true }], [g], [u], [])
  expect(issues.filter(i => i.kind === 'Posibles duplicados').map(i => i.search)).toEqual(['01', '02'])
  expect(issues.find(i => i.kind === 'Estudiantes sin nivel')?.detail).toContain('Matemáticas')
  expect(issues.filter(i => i.kind.startsWith('Grupos'))).toHaveLength(2)
  expect(issues.filter(i => i.kind.startsWith('Usuarios') || i.kind.startsWith('Docentes'))).toHaveLength(2)
})
