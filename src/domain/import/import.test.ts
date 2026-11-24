// @vitest-environment node
import { expect, it } from 'vitest'
import * as XLSX from 'xlsx'
import { parseImport } from './parser'
import { buildImportTemplate } from './templates'
import { importColumns, type ImportKind } from './schema'
import { buildExcelExport } from '../export/excel'

const schools = [{ id: 'ie1', name: 'Institución Núñez', campuses: [{ id: 's1', name: 'Sede Principal' }] }, { id: 'ie2', name: 'Otra', campuses: [] }]
function csv(kind: ImportKind, source: string, existingStudents: { schoolId: string; code: string }[] = []) {
  return parseImport({ kind, filename: 'DATOS.CSV', bytes: new TextEncoder().encode(source), schools, existingStudents })
}
it('conserva ceros, acentos y separadores dentro de comillas', () => {
  const result = csv('students', '\uFEFFIE;SEDE;CÓDIGO;NÓMBRE DEL ESTUDIANTE;GRADO;Género;EDAD;MUESTRA\r\nInstitución Núñez;Sede Principal;0012;"  Pérez; Ana  ";3.0;f;12;2\r\n')
  expect(result.validRows[0]?.data).toEqual({ schoolId: 'ie1', campus: 's1', code: '0012', fullName: 'Pérez; Ana', grade: 3, gender: 'F', age: 12, sample: 2 })
  for (const alias of ['nombre', 'estudiante', 'nombre completo']) expect(csv('students', 'IE,código,' + alias + ',grado\nie2,1,Ana,5').validRows).toHaveLength(1)
})
it('mantiene filas originales y reporta errores de datos y duplicados por institución', () => {
  const result = csv('students', 'Institución,Sede,Código,Nombre,Grado,Edad,Sexo,Muestra\n\nie1,Inexistente,123,,7,19,X,0\nInexistente,s1,124,Ana,3,8,F,1\nie1,s1,A-1,Ana,3,9,F,1\nie1,s1,a1,Beto,3,9,M,1\nie2,,a1,Luz,3,9,F,1\nie2,,002,Sol,5.1,8,F,2', [{ schoolId: 'ie2', code: '0-02' }])
  expect(result.validRows.map(r => r.number)).toEqual([5, 7])
  expect(result.rows[0].number).toBe(3)
  for (const text of ['sede', 'estudiante', 'grado', 'edad', 'sexo', 'muestra']) expect(result.rows[0].errors.join(' ')).toContain(text)
  expect(result.rows[5].errors).toHaveLength(2)
})
it.each(Object.keys(importColumns) as ImportKind[])('reconoce la plantilla de %s sin registros', async kind => {
  const bytes = await buildImportTemplate(kind).arrayBuffer()
  const book = XLSX.read(bytes, { type: 'array' })
  expect(book.SheetNames).toEqual(['Plantilla'])
  expect(parseImport({ kind, filename: 't.xlsx', bytes, schools }).rows).toEqual([])
  const archive = XLSX.CFB.read(new Uint8Array(bytes), { type: 'buffer' })
  expect(new TextDecoder().decode(XLSX.CFB.find(archive, '/xl/styles.xml').content)).toContain('<b/>')
  expect(new TextDecoder().decode(XLSX.CFB.find(archive, '/xl/worksheets/sheet1.xml').content)).toContain('r="A1" s="1"')
})
it('interpreta fechas nativas, niveles de matemáticas y fórmulas con valor de caché', async () => {
  const book = XLSX.read(await buildImportTemplate('evaluations').arrayBuffer(), { type: 'array' })
  const sheet = book.Sheets.Plantilla
  XLSX.utils.sheet_add_aoa(sheet, [['ie1', '001', 'Matemáticas', 'Línea media 1', '2 dígitos', 45942, 2]], { origin: 'A2' })
  XLSX.utils.sheet_add_aoa(sheet, [['ie1', '002', 'Lectura', 'Línea base', 'Letra', '2025-10-12', 1]], { origin: 'A3' })
  sheet.F2.z = 'yyyy-mm-dd' // Excel serial 45942 is 2025-10-12 in the 1900 date system.
  sheet.G3 = { t: 'n', v: 1, f: '2-1' }
  const preview = parseImport({ kind: 'evaluations', filename: 'histórico.xlsx', bytes: XLSX.write(book, { bookType: 'xlsx', type: 'array' }), schools })
  expect(preview.validRows[0].data).toMatchObject({ moment: 'linea_media_1', level: 'dos_digitos', date: '2025-10-12', sample: 2 })
  expect(preview.rows[1].errors.join(' ')).toContain('fórmula')
  expect(csv('evaluations', 'Institución,Código,Área,Momento,Nivel,Fecha\nie1,1,Lectura,Mal,División,2025-02-30').rows[0].errors).toHaveLength(3)
})
it('resuelve docentes, sedes y grupos y rechaza encabezados inválidos', () => {
  const teachers = csv('teachers', 'Nombre,Correo,IE,Sede,Jornada\nAna,ana@enad.app,ie1,s1,Mañana\nBeto,x@@y,ie2,,Inválida')
  expect(teachers.validRows[0].data).toEqual({ fullName: 'Ana', username:'ana', email: 'ana@enad.app', schoolIds: ['ie1'], campusIds: { ie1: ['s1'] }, jornada: 'mañana' })
  expect(teachers.rows[1].errors).toHaveLength(2)
  expect(() => csv('students', 'código,nombre,grado\n1,Ana,3')).toThrow('Faltan columnas')
  expect(() => csv('students', 'ie,código,nombre,estudiante,grado\nie1,1,Ana,Ana,3')).toThrow('repetida')
  const ie = csv('schools', 'ID institución,Nombre,Proyecto,Región,Departamento,Municipio,Zona,ID sede,Sede\nie3,Nueva,P,Caribe,Bolívar,Turbaco,Rural,s2,Norte\nie4,Otra,P,Caribe,Bolívar,Turbaco,Rural,s3,')
  expect(ie.validRows[0].data.campuses).toEqual([{ id: 's2', name: 'Norte', jornada: 'única' }])
  expect(ie.rows[1].errors.join(' ')).toContain('sede')
  expect(csv('groups', 'IE,Nombre,Área,ID docente\nie1,Grupo,Matemáticas,uid').validRows[0].data).toEqual({ schoolId: 'ie1', name: 'Grupo', subject: 'matematicas', teacherId: 'uid' })
})
it('exporta Datos y Cruces con encabezados, tipos y valores literales seguros', async () => {
  const payload = {
    raw: ['=', '+', '-', '@'].map(prefix => ({ fullName: prefix + 'Ana', code: '0004', age: 9, linea_base: 'palabra' })),
    crosses: { weeklyHours: [{ teacherName: 'Diana', week: 3, planned: 8, worked: 6.5 }] }
  }
  const book = XLSX.read(await buildExcelExport(payload).arrayBuffer(), { type: 'array' })
  expect(book.SheetNames).toEqual(['Datos', 'Cruces'])
  const data = book.Sheets.Datos
  expect(data.A1.v).toBe('Estudiante')
  expect(data.B2.v).toBe('0004')
  expect(data.D2).toMatchObject({ v: 9, t: 'n' })
  expect(data.N2.v).toBe('palabra')
  for (const [i, prefix] of ['=', '+', '-', '@'].entries()) expect(data['A' + (i + 2)].v).toBe("'" + prefix + 'Ana')
  const cross = XLSX.utils.sheet_to_json<unknown[]>(book.Sheets.Cruces, { header: 1 })
  expect(cross).toContainEqual(['Diana', 3, 8, 6.5])
})
it('aplana los cruces anidados del gateway y conserva momentos por materia', async () => {
  const payload = {
    raw: [{ studentId: 's1', school: 'IE San José', fullName: 'Ana', lectura_linea_base: 'palabra' }],
    crosses: {
      levels: { lectura: { overall: { distribution: { linea_base: { palabra: 1 } } }, gender: { F: 1, M: 0 }, age: { 9: 1 } } },
      attendance: { bySchool: [{ name: 'IE San José', rate: 80 }], byTeacher: [{ fullName: 'Diana', rate: 75.5 }] },
      hours: { byTeacher: [{ fullName: 'Diana', weekly: [{ week: 3, planned: 8, worked: 6.5 }] }] }
    }
  }
  const book = XLSX.read(await buildExcelExport(payload).arrayBuffer(), { type: 'array' })
  const data = XLSX.utils.sheet_to_json<unknown[]>(book.Sheets.Datos, { header: 1 })
  expect(data[0][0]).toBe('IE')
  expect(data[0]).toContain('Lectura · Línea base')
  const cross = XLSX.utils.sheet_to_json<unknown[]>(book.Sheets.Cruces, { header: 1 })
  for (const r of [['Diana', 3, 8, 6.5], ['IE San José', 80], ['lectura', 'Línea base', 'palabra', 1], ['F', 1]]) expect(cross).toContainEqual(r)
})

it('acepta la plantilla v2 de docentes con usuario y sin correo', () => {
  const data = csv('teachers','Nombre,Usuario,IE\nLuz García,luz.g,ie1')
  expect(data.validRows[0].data.username).toBe('luz.g')
})
