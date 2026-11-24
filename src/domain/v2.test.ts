import { describe, expect, it, vi } from 'vitest'
import {groupLevels, recommended, validateActivity, type ActivityFields} from '../data/activities'
import { cleanDetail, validateHours } from './hoursReason'
import { entities, entityWorkbook } from './export/entities'
import type { Group, Student } from './types'
vi.mock('../data/firebase',() => ({db:{}}))
const activity:ActivityFields={title:'Lectura en pareja',description:'',minutes:20,active:true,subject:'lectura',levels:['letra'],link:null}
describe('Plan de clase',() => {
  it('matches active activities to the most frequent levels among active members, including ties',() => {
    const g = {studentIds:['1','2','3','4'],subject:'lectura'} as Group
    const students = ['letra','palabra','cuento','letra','cuento'].map((level,i) => ({
      id:String(i+1),retired:i===2,active:i!==3,levels:{lectura:{level}}
    } as Student))
    const levels = groupLevels(g,students)
    expect(levels).toEqual(['letra','palabra'])
    expect(recommended(activity,g,levels)).toBe(true)
    expect(recommended({...activity,active:false},g,levels)).toBe(false)
    expect(recommended({...activity,subject:'matematicas'},g,levels)).toBe(false)
    expect(recommended(activity,g,[])).toBe(false)
  })
  it('validates the activity fields and external link',() => {
    expect(validateActivity(activity)).toBeUndefined()
    for (const patch of [{minutes:5.5},{minutes:121},{levels:['resta']},{levels:[]},{link:'http://test.invalid'},{title:' A '},{description:'x'.repeat(1001)}])
      expect(validateActivity({...activity,...patch})).toBeTruthy()
  })
})
it('validates half hours including boundaries, and removes joined emoji and flags',() => {
  for (const n of [0.5,1,23.5,24]) expect(validateHours({planned:0,worked:n})).toBeNull()
  for (const n of [NaN,-0.5,24.5,1.25]) expect(validateHours({planned:0,worked:n})).toBeTruthy()
  expect(cleanDetail('Reunión 👩🏽‍🏫📚🇨🇴1️⃣')).toBe('Reunión ')
})
it('exports all eight entities, empty sheet headers, nested fields and individual tables',() => {
  const book=entityWorkbook(Object.fromEntries(entities.map(k => [k,k === 'Grupos' ? [{id:'g',studentIds:['s']}] : []])))
  expect(book.SheetNames).toEqual(['Docentes','Estudiantes','Grupos','Asistencia','Evaluaciones','Horas','Actividades','Plan'])
  expect(book.Sheets.Grupos.B2.v).toBe('["s"]')
  expect(book.Sheets.Plan.A1.v).toBe('id')
  expect(entityWorkbook({Horas:[]}).SheetNames).toEqual(['Horas'])
})
