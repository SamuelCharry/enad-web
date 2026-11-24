import { entities, downloadEntities, type Entity } from '../../domain/export/entities'
import { readEntities } from '../../data/downloads'
import { useAction } from '../collect/useAction'
import { Button } from '../../ui/components'

export function Downloads() {
  const action = useAction()
  const download = (entity?:Entity) => action.run(async () => {
    const rows = await readEntities(entity ? [entity] : entities)
    downloadEntities(rows,entity || 'completo')
  },'Archivo preparado.')
  return <><Button variant="primary" loading={action.busy} onClick={() => download()}>Descargar todo</Button>{action.feedback}
    <h2>Descargar una tabla</h2>{entities.map(entity => <div className="collect-row" key={entity}><span>{entity}</span>
      <Button disabled={action.busy} aria-label={'Descargar '+entity} onClick={() => download(entity)}>Descargar</Button></div>)}</>
}
