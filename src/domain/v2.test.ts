import { describe, expect, it, vi } from 'vitest'
import {groupLevels, recommended, validateActivity, type ActivityFields} from '../data/activities'
import { cleanDetail, validateHours } from './hoursReason'
import { entities, entityWorkbook } from './export/entities'
import type { Group, School, Student } from './types'
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
  expect(book.SheetNames).toEqual(['Personas','Estudiantes','Grupos','Asistencia','Evaluaciones','Horas','Actividades','Plan'])
  expect(book.Sheets.Grupos.F2.v).toBe('Estudiante sin registro')
  expect(book.Sheets.Plan.A1.v).toBe('Fecha')
  expect(entityWorkbook({Horas:[]}).SheetNames).toEqual(['Horas'])
})

it('resuelve personas, sedes, grupos, niveles y marcas históricas sin mostrar identificadores',() => {
  const school={id:'s',name:'Escuela Bolívar',campuses:[{id:'b',name:'Sede Alta'}]} as School
  const event={schoolId:'s',studentId:'s_1',teacherId:'t',groupId:'g',date:'2026-09-07'}
  const book=entityWorkbook({
    Personas:[{id:'t',fullName:'Luz Paz',rol:'docente',schoolIds:['s'],campusIds:{s:['b']}},{rol:'coordinador',fullName:'Sol Ríos'},{rol:'fundacion',fullName:'Ana Luz'}],
    Estudiantes:[{id:'s_1',schoolId:'s',campus:'b',fullName:'Rosa Díaz',levels:{lectura:{level:'parrafo'}}}],
    Grupos:[{id:'g',name:'Garzas',schoolId:'s',teacherId:'t',campus:'b',subject:'lectura',studentIds:['s_1']}],
    Evaluaciones:[{...event,subject:'lectura',moment:'linea_media_2',level:'parrafo'}],
    Asistencia:[{...event,status:'no_vino'}],Horas:[{schoolId:'s',date:'9999-99-99',plannedHours:-3,workedHours:99999999}]
  },[school])
  const sheets=book.Sheets
  expect(['B2','B3','B4','E2','F2'].map(cell => sheets.Personas[cell].v)).toEqual(['Docente','Coordinación','Fundación','Escuela Bolívar','Sede Alta'])
  expect(['C2','D2','E2','F2'].map(cell => sheets.Grupos[cell].v)).toEqual(['Escuela Bolívar','Sede Alta','Luz Paz','Rosa Díaz'])
  expect(['C2','D2','E2','F2'].map(cell => sheets.Asistencia[cell].v)).toEqual(['Rosa Díaz','Garzas','Luz Paz','No asistió'])
  expect(sheets.Evaluaciones.G2.v).toBe('Línea Media 2')
  expect(sheets.Evaluaciones.H2.v).toBe('Párrafo')
  expect(sheets.Estudiantes.J2.v).toBe('Párrafo')
  expect(sheets.Horas.G2.v).toBe('Revisar registro de horas')
})
