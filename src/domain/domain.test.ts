import { describe, expect, it, vi } from 'vitest'
import { colombiaToday, rangeOf, weekOf, weeksElapsed } from './weeks'
import { LEVELS, MOMENTS, levelLabel, momentLabel, shouldOverwriteLevel } from './levels'
import { levelColor } from './levelPalette'
import { foldOcrConfusions, nameKey } from './nameKey'
import { formatReason, parseReason, validateHours } from './hoursReason'
import { suggestGroups } from './groupSuggester'
import type { Student, Subject } from './types'

const cfg = { projectName: 'ENAd', year: 2026, implementationStartDate: '2026-09-09', breaks: [{ from: '2026-10-06', to: '2026-10-09', label: 'Receso' }] }
describe('semanas de implementación', () => {
  it.each([['2026-09-06', null], ['2026-09-07', 1], ['2026-09-09', 1], ['2026-09-13T23:59:00', 1], ['2026-09-14', 2],
  ['2026-10-04', 4], ['2026-10-07', null], ['2026-10-12', 5]] as const)('%s → %s', (date, week) => expect(weekOf(date, cfg)).toBe(week))
  it('omite semanas completas y conserva la relación inversa', () => {
    expect(rangeOf(5, cfg)).toEqual({ from: '2026-10-12', to: '2026-10-18' })
    for (let n = 1; n <= 12; n++) {
      const r = rangeOf(n, cfg)
      expect(weekOf(r.from, cfg)).toBe(n)
      expect(weekOf(r.to, cfg)).toBe(n)
    }
    expect(['2026-09-01', '2026-10-08', '2026-10-13'].map(d => weeksElapsed(cfg, d))).toEqual([0, 4, 5])
    expect(() => rangeOf(0, cfg)).toThrow('semana')
  })
  it('cambia la fecha a medianoche de Colombia', () => {
    vi.useFakeTimers()
    try {
      vi.setSystemTime(new Date('2026-11-21T04:59:59Z'))
      expect(colombiaToday()).toBe('2026-11-20')
      vi.advanceTimersByTime(1000)
      expect(colombiaToday()).toBe('2026-11-21')
    } finally { vi.useRealTimers() }
  })
})
it('respeta las escalas, colores y todos los pares de momentos', () => {
  expect(LEVELS.matematicas.map(l => levelLabel('matematicas', l))).toEqual(['Principiante', '1 dígito', '2 dígitos', 'Resta', 'División', 'Problema escrito'])
  expect(LEVELS.lectura.map(l => levelLabel('lectura', l))).toEqual(['Principiante', 'Letra', 'Palabra', 'Párrafo', 'Cuento', 'Comprensión'])
  expect(MOMENTS.map(momentLabel)).toEqual(['Línea Base', 'Línea Media 1', 'Línea Media 2', 'Línea Final', 'Verificación'])
  expect(levelColor(1)).toEqual({ bg: '#CC6B68', fg: '#1D1D1B' })
  for (const current of [undefined, ...MOMENTS]) for (const [i, next] of MOMENTS.entries()) {
    const expected = i < 4 && (!current || current === 'verificacion' || i >= MOMENTS.indexOf(current))
    expect(shouldOverwriteLevel(current, next)).toBe(expected)
  }
})
it('normaliza tildes, signos, espacios y caracteres confundibles sin perder repeticiones', () => {
  expect(nameKey('  María   Muñoz Álvarez ')).toBe('alvarez maria munoz')
  expect(nameKey('A\u0301lvarez Nin\u0303o')).toBe('alvarez nino')
  expect(nameKey('Zoé O’Neill')).toBe('oneill zoe')
  expect(nameKey('!!! 123')).toBe('')
  expect(nameKey('Ana\tMaría\nGÜISA')).toBe('ana guisa maria')
  expect(nameKey('Ana Ana')).toBe('ana ana')
  expect(foldOcrConfusions('OoIl|SBZG')).toBe('001115826')
  expect(foldOcrConfusions('C0rte5', false)).toBe('Cortes')
})
it('valida categoría y detalle y conserva motivos históricos', () => {
  const check = (reason: string | null) => validateHours({ planned: 4, worked: 3, reason })
  expect(check('Salud')).toBe('Escribe el motivo.')
  expect(check(null)).toBe('Selecciona un motivo.')
  expect(check('Salud: cita médica')).toBeNull()
  expect(check('Salud: ' + 'x'.repeat(201))).toContain('200')
  expect(check('Salud: ' + 'x'.repeat(200))).toBeNull()
  expect(formatReason('Salud', '  cita médica  ')).toBe('Salud: cita médica')
  expect(parseReason('Lluvia')).toEqual({ category: 'Otro', detail: 'Lluvia' })
  expect(check('Lluvia')).toBeTruthy()
  expect(validateHours({ planned: 4, worked: 4, reason: null })).toBeNull()
  for (const n of [Infinity, NaN, 25, -1]) expect(validateHours({ planned: n, worked: 4, reason: null })).toBeTruthy()
  expect(validateHours({ planned: 0, worked: 0, reason: null })).toBeTruthy()
})
function roster(counts: Record<string, number>, subject: Subject = 'lectura'): Student[] {
  return Object.entries(counts).flatMap(([level, n]) => Array.from({ length: n }, (_, i) => ({
    id: level + i, schoolId: 's', campus: '', code: '', fullName: 'Estudiante ' + i, nameKey: '', grade: 4, gender: '', age: null, sample: null, provisional: false,
    active: true, retired: false, levels: { [subject]: { level, moment: 'linea_base', date: '2026-09-09' } },
  })))
}
describe('propuestas de grupos', () => {
  it('divide 150 estudiantes en seis grupos de 25 en orden de nivel', () => {
    const groups = suggestGroups(roster({ cuento: 50, principiante: 75, letra: 25 }), 'lectura', 'linea_base', 6)
    expect(groups.map(g => g.studentIds.length)).toEqual(Array(6).fill(25))
    expect(groups[0].levelLabels).toEqual(['Principiante'])
    expect(new Set(groups.flatMap(g => g.studentIds)).size).toBe(150)
  })
  it.each([1, 5, 6])('aplica el umbral de cierre con %d cupos', vacancy => {
    const first = suggestGroups(roster({ principiante: 15 - vacancy, letra: 15 + vacancy }), 'lectura', 'linea_base', 2)[0]
    expect(first.studentIds.length).toBe(vacancy <= 5 ? 15 - vacancy : 15)
    expect(first.levelLabels.length).toBe(vacancy <= 5 ? 1 : 2)
  })
  it.each([['lectura', 'palabra', 'parrafo'], ['matematicas', 'principiante', 'un_digito'], ['matematicas', 'resta', 'division']] as const)(
    'mezcla la pareja permitida %s %s/%s', (s, first, next) => {
      const group = suggestGroups(roster({ [first]: 3, [next]: 18 }, s), s, 'linea_base', 2)[0]
      expect(group.levelLabels).toEqual([levelLabel(s, first), levelLabel(s, next)])
      expect(group.studentIds.length).toBe(11)
    })
  it('omite retirados, duplicados y áreas o momentos distintos', () => {
    const [a, b] = roster({ letra: 2 })
    const rows = [a, a, { ...b, retired: true }, ...roster({ resta: 2 }, 'matematicas')]
    expect(suggestGroups(rows, 'lectura', 'linea_base', 3)[0].studentIds).toEqual([a.id])
    expect(suggestGroups(rows, 'lectura', 'linea_final', 2)).toEqual([])
    expect(suggestGroups([], 'lectura', 'linea_base', 1)).toEqual([])
    expect(() => suggestGroups([], 'lectura', 'linea_base', 0)).toThrow()
    expect(suggestGroups(roster({ letra: 3, palabra: 27 }), 'lectura', 'linea_base', 2)[0].studentIds).toHaveLength(3)
  })
})
