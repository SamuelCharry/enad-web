import { utils, writeFile } from 'xlsx'

export const entities = ['Docentes','Estudiantes','Grupos','Asistencia','Evaluaciones','Horas','Actividades','Plan'] as const
export type Entity = typeof entities[number]
type Rows = Partial<Record<Entity,Record<string,unknown>[]>>
export function entityWorkbook(data:Rows) {
  const book = utils.book_new()
  for (const name of entities) {
    if (!data[name]) continue
    const rows = data[name].map(row => Object.fromEntries(Object.entries(row).map(([k,v]) => [k,v !== null && typeof v === 'object' ? JSON.stringify(v) : v])))
    utils.book_append_sheet(book,utils.json_to_sheet(rows,{header:['id']}),name)
  }
  return book
}
export const downloadEntities = (data:Rows,file:string) => writeFile(entityWorkbook(data),'ENAd-'+file+'.xlsx')
