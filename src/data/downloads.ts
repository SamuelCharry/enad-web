import { collection, collectionGroup, getDocs, orderBy, query, where, type Query } from 'firebase/firestore'
import { api, caller } from './core'
import { db } from './firebase'
import { entities, type Entity } from '../domain/export/entities'

export function readEntities(selected:readonly Entity[] = entities) {
  return api(async () => {
    const p = await caller('manager')
    const ids = [...new Set(p.schoolIds)]
    const result:Partial<Record<Entity,Record<string,unknown>[]>> = {}
    await Promise.all(selected.map(async name => {
      let queries:Query[]
      if (name === 'Personas') {
        const teachers = query(collection(db,'users'),where('rol','==','docente'))
        queries = p.rol === 'fundacion' ? [collection(db,'users')] : ids.map(id => query(teachers,where('schoolIds','array-contains',id)))
      } else if (name === 'Actividades') queries = [collection(db,'activities')]
      else {
        const paths = {Estudiantes:'students',Grupos:'groups',Asistencia:'attendance',Evaluaciones:'evaluations',Horas:'hours',Plan:'plan'}
        const source = ['Plan','Asistencia','Evaluaciones'].includes(name) ? collectionGroup(db,paths[name]) : collection(db,paths[name])
        queries = p.rol === 'fundacion' ? [source] : ids.map(id => query(source,where('schoolId','==',id),...(name === 'Plan' ? [orderBy('date')] : [])))
      }
      const docs = (await Promise.all(queries.map(q => getDocs(q)))).flatMap(page => page.docs)
      result[name] = [...new Map(docs.map(d => [d.ref.path,d])).values()].filter(d => name !== 'Estudiantes' || !d.data().mergedInto).map(d => {
        const data = d.data()
        if (name === 'Personas') {
          return {id:d.id,rol:data.rol,username:data.username,fullName:data.fullName,email:data.email,jornada:data.jornada,activo:data.activo,
            schoolIds:(data.schoolIds || []).filter((id:string) => p.rol === 'fundacion' || ids.includes(id)),
            campusIds:Object.fromEntries(Object.entries(data.campusIds || {}).filter(([id]) => p.rol === 'fundacion' || ids.includes(id)))}
        }
        return {...data,id:d.id,...(name === 'Plan' && {groupId:d.ref.parent.parent?.id})}
      })
    }))
    if (p.rol === 'coordinador' && result.Personas) result.Personas.push({...p,id:p.uid})
    return result
  })
}
