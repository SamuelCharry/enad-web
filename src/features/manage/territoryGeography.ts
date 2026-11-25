import departments from './colombia-departments.json'

const normalize = (name: string) => name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '')
const ids = new Map(departments.flatMap(d => [[normalize(d.name), d.id], [normalize('CO-' + d.id), d.id]] as [string, string][]))
for (const name of ['Bogotá', 'Bogotá Distrito Capital', 'Distrito Capital de Bogotá', 'Bogotá Distrito Capital de Colombia']) ids.set(normalize(name), 'DC')
for (const name of ['San Andrés', 'San Andrés, Providencia y Santa Catalina', 'Archipiélago de San Andrés, Providencia y Santa Catalina']) ids.set(normalize(name), 'SAP')
export const unknown = 'sin-departamento'
export const departmentId = (name: string) => ids.get(normalize(name || '')) ?? unknown
