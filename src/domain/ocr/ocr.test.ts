import { expect, it } from 'vitest'
import { parseRows, type ParsedRow, type OcrLine } from './rowParser'
import { validateRows, blockingIssues } from './rowValidator'
import { matchRow } from './rosterMatcher'
import { jaroWinkler, nameSimilarity, normalizedLevenshtein } from './similarity'

const cell = (text: string, left: number, right: number, confidence?: number) => ({ text, left, right, confidence })
const line = (top: number, ...elements: ReturnType<typeof cell>[]): OcrLine => ({ top, bottom: top + 10, elements })
const row = (name: string, fields: Partial<ParsedRow> = {}): ParsedRow => ({ rawText: name, name, confidence: {}, readingIssues: [], issues: [], ...fields })
it('lee la hoja de compilación por geometría, conserva evidencia y excluye pies y niveles', () => {
  const result = parseRows([
    line(0, cell('Formato de Compilación de Resultados', 0, 200)),
    line(20, cell('# Serie', 0, 30), cell('Código', 45, 80), cell('Nombre', 95, 130), cell('del', 131, 145), cell('estudiante', 148, 195),
      cell('# muestra base', 280, 330), cell('Edad', 350, 375), cell('Grado', 390, 415), cell('Sexo', 435, 455), cell('Nivel', 480, 505)),
    line(40, cell('1', 0, 7), cell('O123', 45, 70, .92)),
    line(44, cell('Muñoz', 95, 130, .99), cell('Rios', 135, 160, .87), cell('Ana', 170, 190), cell('Lucía', 195, 218)),
    line(42, cell('2', 280, 288), cell('10', 352, 365), cell('5', 393, 400), cell('f', 438, 445), cell('1', 485, 492)),
    line(65, cell('Total:', 95, 130), cell('1', 400, 410)), line(80, cell('Porcentaje', 95, 145), cell('100%', 400, 430)),
  ].reverse())
  expect(result).toHaveLength(1)
  expect(result[0]).toMatchObject({ name: 'Muñoz Rios Ana Lucía', code: '0123', age: 10, grade: 5, sex: 'F', confidence: { name: .87, code: .92 }, issues: [] })
  expect(result[0].rawText).toContain('O123')
})
it('lee listas planas, conserva ceros e identifica datos dudosos', () => {
  const parsed = parseRows(['01O9 Garcia Diaz Maria 9 4 F', '2. Juan Camilo Díaz García', 'Sofia Pérez 00001 12 M', '32101 Fabricio Gil quinto 22 X']
    .map((s, i) => line(i * 20, cell(s, 0, 200))))
  expect(parsed[0]).toMatchObject({ name: 'Garcia Diaz Maria', code: '0109', age: 9, grade: 4, sex: 'F' })
  expect(parsed[1]).toMatchObject({ name: 'Juan Camilo Díaz García', code: null })
  expect(parsed[2]).toMatchObject({ code: '00001', age: 12 })
  expect(parsed[3]).toMatchObject({ name: 'Fabricio Gil', grade: 5, age: 22, sex: 'X' })
  expect(blockingIssues(parsed[3])).toHaveLength(2)
  expect(parseRows([line(10, cell('Ana Gil', 0, 40), cell('Julio Peña', 160, 235))])[0].issues[0]).toContain('dos estudiantes')
})
it('separa paneles contiguos y descarta únicamente el pie del panel correspondiente', () => {
  const result = parseRows([line(0, cell('Codigo', 0, 30), cell('Nombre', 60, 110), cell('Código', 250, 285), cell('Nombre', 320, 360)),
  line(24, cell('0002', 250, 275), cell('Luis Diaz', 320, 385)), line(20, cell('0001', 0, 25), cell('María Gil', 60, 130)),
  line(45, cell('0003', 0, 25), cell('Juan Ruiz', 60, 130)), line(65, cell('Total', 60, 110), cell('0004', 250, 276), cell('José García', 320, 385))])
  expect(result.map(r => r.code)).toEqual(['0001', '0002', '0003', '0004'])
  expect(result.map(r => r.name)).toEqual(['María Gil', 'Luis Diaz', 'Juan Ruiz', 'José García'])
})
it('conserva filas anteriores a un encabezado y reconoce casillas F/M', () => {
  const result = parseRows([line(0, cell('Institución Educativa Las Palmas · Sede La Primavera', 0, 240)),
  line(15, cell('302100 Valentina Muñoz Ríos 8 F', 0, 200)), line(30, cell('Nombre', 0, 45), cell('Sexo', 200, 222)),
  line(45, cell('F', 190, 196), cell('M', 230, 236)), line(65, cell('Andrea Rojas', 0, 76), cell('X', 190, 196)),
  line(85, cell('Mario Peña', 0, 75), cell('X', 230, 236)), line(105, cell('Julio Ruiz', 0, 75), cell('X', 190, 196), cell('X', 230, 236))])
  expect(result[0].name).toBe('Valentina Muñoz Ríos')
  expect(result.map(r => r.sex)).toEqual(['F', 'F', 'M', 'F/M'])
  expect(blockingIssues(result[3])).toHaveLength(1)
})
it('conserva lecturas ilegibles y confianza desconocida', () => {
  const result = parseRows([line(0, cell('Nombre', 0, 40), cell('Edad', 100, 125)), line(20, cell('Sofía Peña', 0, 60, .59), cell('abc', 100, 119)),
  line(40, cell('Ana Ruiz', 0, 60), cell('10', 100, 110, .6))])
  expect(result[0].age).toBeNull()
  expect(result[0].issues).toHaveLength(2)
  expect(result[0].issues.join(' ')).toContain('abc')
  expect(result[1].issues).toEqual([])
  expect(parseRows([{ top: 5, bottom: 4, elements: [cell('bad', 0, 20)] }])).toEqual([])
})
it('revalida los dos duplicados tras editar o retirar una fila', () => {
  const dupe = validateRows([row('Ana María Pérez', { code: '01O1' }), row('Maria Pérez Ana', { code: '0101' })])
  for (const d of dupe) expect(blockingIssues(d)).toHaveLength(2)
  expect(validateRows([dupe[1]])[0].issues).toEqual([])
  expect(blockingIssues(row('An4', { code: '7Q3', age: 19, sex: 'X', grade: 8 }))).toHaveLength(6)
})
it('reproduce las distancias y confusiones del comparador móvil', () => {
  expect(jaroWinkler('martha', 'marhta')).toBeCloseTo(.96111, 4)
  expect(normalizedLevenshtein('kitten', 'sitting')).toBeCloseTo(4 / 7)
  expect(nameSimilarity('Camila Ortega', 'Carnila Ortega')).toBe(1)
  expect(nameSimilarity('Camila Ortega', 'Camila 0rtega')).toBe(1)
  expect(nameSimilarity('Daniela Ruiz', 'Daniela Ruiz Rojas')).toBe(1)
  expect(nameSimilarity('José Rodríguez', 'Jose Rodriguz')).toBeGreaterThanOrEqual(.93)
  expect(nameSimilarity('Luis Gil', 'Katherine Zapata')).toBeLessThan(.8)
  expect(nameSimilarity('', '')).toBe(0)
})
const twins = [{ id: 'a', name: 'Ana María López Ruiz', code: '0058', age: 9, sex: 'F' }, { id: 'b', name: 'Ana María López Ríos', code: '0059', age: 12, sex: 'F' }]
it('confirma un código solo si el nombre y los candidatos lo respaldan', () => {
  expect(matchRow(row(twins[0].name, { code: 'OO58' }), twins)).toMatchObject({ status: 'matched', chosenStudentId: 'a' })
  expect(matchRow(row(twins[1].name, { code: '0058' }), twins).candidates.map(c => c.student.id)).toEqual(['a', 'b'])
  expect(matchRow(row(twins[0].name, { code: '0058' }), [twins[0], { ...twins[0], id: 'otro', code: '0053' }]).status).toBe('review')
  expect(matchRow(row('Beatriz Cotes', { code: '0058' }), twins).status).toBe('review')
  expect(matchRow(row(twins[0].name, { code: '0077' }), twins).status).toBe('review')
  expect(matchRow(row(twins[0].name, { code: '0058' }), [twins[0], twins[0]]).status).toBe('review')
  expect(matchRow(row('Ana María Lopes Ruiz'), [twins[0]]).status).toBe('matched')
  const ambiguous = matchRow(row('Ana María López', { age: 11, sex: 'F' }), twins)
  expect(ambiguous.status).toBe('review')
  expect(ambiguous.candidates[0].student.id).toBe('b')
  expect(matchRow(row('Jose'), twins).status).toBe('invalid')
  expect(matchRow(row('Beatriz Cotes'), twins).status).toBe('newStudent')
})
it('reconoce al menos el 95 % de 40 lecturas entre 60 estudiantes sin asignaciones equivocadas', () => {
  const roster = schoolNames.map((name, i) => ({ name, id: 's' + i, code: String(105000 + i) }))
  let correct = 0, reviewed = 0
  noisyReadings.forEach((name, i) => {
    const d = matchRow(row(name, { code: noisyCodes[i] }), roster)
    if (d.status === 'matched') {
      expect(d.chosenStudentId).toBe('s' + i);
      correct++
    }
    else if (d.status === 'review' && d.candidates.some(c => c.student.id === 's' + i)) reviewed++
  })
  expect(correct).toBeGreaterThanOrEqual(25)
  expect((correct + reviewed) / noisyReadings.length).toBeGreaterThanOrEqual(.95)
})

// Synthetic students and independent OCR readings; the index is the expected
// identity. The last 20 roster entries are distractors, including relatives.
const schoolNames = [
  'María José Cárdenas Ruiz',
  'Andrés Felipe Torres Gil',
  'Valentina Ospina López',
  'Juan Sebastián Niño Díaz',
  'Luciana García Pérez',
  'Samuel Rincón Duarte',
  'Camila Pardo León',
  'David Santiago Mora',
  'Isabella Flórez Ríos',
  'Mateo Álvarez Restrepo',
  'Manuela Ramírez Solano',
  'Daniela Gómez Franco',
  'Sofía Mendoza Uribe',
  'Tomás Vargas Soto',
  'Valeria Escobar Ramos',
  'Nicolás Jiménez Hoyos',
  'Mariana Vélez Yepes',
  'Emilio Quintero Paz',
  'Sara Mejía Patiño',
  'Jerónimo Montoya Cruz',
  'Luisa Fernanda Ortiz',
  'Pedro Antonio Pacheco',
  'Paula Andrea Suárez',
  'Esteban Salazar Peña',
  'Natalia Cabrera Díaz',
  'Iván Guerrero Silva',
  'Laura Catalina Roa',
  'Diana Lucía Molina',
  'Ana Isabel Salcedo',
  'Luis Miguel Orozco',
  'Carlos Alberto Caicedo',
  'Tatiana Sepúlveda Ávila',
  'Julián Romero Lara',
  'Andrea Marcela Parra',
  'Felipe Acosta Rueda',
  'María Paula Duque Vera',
  'Óscar Javier Zúñiga',
  'Carolina Prieto Neira',
  'Diego Alejandro Becerra',
  'Gabriela Sánchez Melo',
  'María José Cárdenas Rúa',
  'Andrés Torres Gil',
  'Valentina Osorio López',
  'Santiago Mora Gil',
  'Carlos Andrés Caicedo',
  'Daniel Gómez Franco',
  'Gabriela Sánchez Mesa',
  'Lucía Molina Cano',
  'Mateo Restrepo Arias',
  'Lorena Flórez Ríos',
  'Yerson Valdés Marín',
  'Ángela Correa Gómez',
  'Jorge Iván Villegas',
  'Yulieth Villamizar Rico',
  'Deisy Clavijo Cano',
  'Brayan Puentes Ortiz',
  'Daniel Enrique Barbosa',
  'Karen Camacho Rosas',
  'Lina María Velandia',
  'Sebastián Hurtado Guerra',
];

const noisyReadings = [
  'Maria Jose Cardenas',
  'Andres Torres Gil',
  'Valentina Lopez Ospina',
  'Juan Sebastian Nino Diaz',
  'Luciana Garcia Peres',
  'Samuel Rincon',
  'Carnila Pardo Leon',
  'David Santlago Mora',
  'Isabella Rios Florez',
  'Mateo Alvarez Restrepo',
  'Manue1a Ramirez Solano',
  'Daniela Gomez Frano',
  'Sofia Mendoza',
  'Tomas Soto Vargas',
  'Valeria Escobar Rarnos',
  'Nicolas Jimenez Hoyo',
  'Mariana Velez',
  'Emilio Quintero Pas',
  'Sara Patino Mejia',
  'Jeronimo Mont0ya Cruz',
  'Luisa Fernanda Ortis',
  'Pedro Antonio Paheco',
  'Paula Suarez Andrea',
  'Esteban Salasar Pena',
  'Natalia Cabrera Dia',
  'Ivan Silva Guerrero',
  'Laura Catalina  Roa',
  'Diana Lucia Molina',
  'Ana Isabel Salcdo',
  'Luis Orozco Miguel',
  'Carlos Caicedo',
  'Tatiana Avila Sepulveda',
  'Julian Rornero Lara',
  'Andrea Marcela Para',
  'Felipe Rueda Acosta',
  'María Paula Duque',
  'Oscar Javier Zuniga',
  'Carolina Prieto Niera',
  'Diego Becerra Alejandro',
  'Gabriela Sanchez',
];

// Codes actually legible in these scans. Both contain digit/letter substitutions.
const noisyCodes: Record<number, string> = { 21: '1O5O21', 28: '1O5O28' };
