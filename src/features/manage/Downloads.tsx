import { entities, downloadEntities, type Entity } from '../../domain/export/entities'
import { useSchools } from '../../data/scope'
import { LoadError } from '../../ui/LoadError'
import { readEntities } from '../../data/downloads'
import { useAction } from '../collect/useAction'
import { Icon } from '../../ui/Icon'
import { Button } from '../../ui/components'

export function Downloads() {
  const action = useAction()
  const schools = useSchools()
  const download = (entity?:Entity) => action.run(async () => {
    const selected = entity ? [entity] : entities
    const related:Record<Entity,Entity[]> = {Personas:[],Estudiantes:[],Grupos:['Personas','Estudiantes'],
      Asistencia:['Personas','Estudiantes','Grupos'],Evaluaciones:['Personas','Estudiantes','Grupos'],Horas:['Personas'],Actividades:[],Plan:['Personas','Grupos']}
    const rows = await readEntities([...new Set(selected.flatMap(e => [e,...related[e]]))])
    downloadEntities(rows,entity || 'completo',schools.schools,selected)
  },'Archivo preparado.')
  if (schools.error) return <LoadError message={schools.error}/>
  if (schools.loading) return <p role="status">Cargando instituciones…</p>
  return <><div className="collect-row"><h2>Libro completo</h2>
    <Button variant="primary" loading={action.busy} aria-label="Descargar libro completo" title="Descargar libro completo"
      onClick={() => download()}><Icon name="download"/></Button></div>{action.feedback}
    <h2>Tablas</h2>{entities.map(entity => <div className="collect-row" key={entity}><span>{entity}</span>
      <Button variant="ghost" disabled={action.busy} aria-label={'Descargar '+entity} title={'Descargar '+entity}
        onClick={() => download(entity)}><Icon name="download"/></Button></div>)}</>
}
