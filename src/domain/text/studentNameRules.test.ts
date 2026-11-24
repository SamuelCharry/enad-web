import { describe, expect, it } from 'vitest'
import fixtures from '../../../../docs/name_rules_vectors.json'
import { cleanName, rosterMatches, validateName } from './studentNameRules'
import { candidatesFromLines } from '../ocr/namePage'
import { reviewName, type ReviewName } from '../ocr/reviewNames'
import type { Student } from '../types'

describe('Contrato compartido de nombres', () => {
  for (const v of fixtures.names) it(JSON.stringify(v.input) + ' / ' + v.confidence, () => {
    expect(cleanName(v.input)).toBe(v.clean)
    expect(cleanName(v.clean)).toBe(v.clean)
    expect(validateName(v.input, v.confidence)).toEqual(v.flags)
  })
  for (const p of fixtures.pages) it(p.title, () => {
    const page = candidatesFromLines(p.lines)
    expect(page.rows.map(r => r.name)).toEqual(p.names)
    expect(page.omitted).toBe(p.omitted)
  })
})
it('conserva las advertencias sin impedir el envío y exige resolver homónimos', () => {
  const [candidate] = candidatesFromLines([{ text: 'ANA MAR1A', confidence: .5 }]).rows
  const row: ReviewName = { ...candidate, id: 'r', page: 'p', input: candidate.name, gender: '' }
  const roster = ['a', 'b'].map(id => ({ id, fullName: candidate.name } as Student))
  const found = rosterMatches(row.input, roster)
  expect(reviewName(row, found).id).toBe('')
  expect(reviewName({ ...row, choice: 'b' }, found).id).toBe('b')
  const changed = { ...row, input: 'Ruth Vélez', choice: undefined }
  expect(reviewName(changed, rosterMatches(changed.input, roster))).toMatchObject({ id: 'new', problem: '', flags: ['ocr_baja_confianza'] })
  expect(reviewName(row, [])).toMatchObject({ id: 'new', problem: '', flags: expect.arrayContaining(['ocr_baja_confianza', 'mayusculas', 'formato_nombre']) })
})

it('descarta coincidencias de nombres de pila con apellidos distintos', () => {
  const rows = [{id:'r',fullName:'Camila Rendón Hernández'},{id:'s',fullName:'Ana Sofía Salazar Marín'},{id:'h',fullName:'Camila Gómez Henao'}]
  expect(rosterMatches('camila gomez henao',rows).map(m => m.student.id)).toEqual(['h'])
  expect(rosterMatches('Ana Mar1a',rows)).toEqual([])
  expect(rosterMatches('Henao Camila Gómez',rows)[0]?.student.id).toBe('h')
})
