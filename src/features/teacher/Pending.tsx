import { classDate } from '../../domain/weeks'
import { retrySubmission, usePending } from '../../data/pending'
import { Button } from '../../ui/components'
import { useAction } from '../collect/useAction'

export function Pending({uid}:{uid:string}) {
  const tickets = usePending(uid)
  const action = useAction()
  return <section>{!tickets.length && <p>Todos tus registros están enviados.</p>}
    {tickets.map(t => <article className="collect-row" key={t.key}><div><strong>{t.label}</strong><p>{classDate(t.date)} · {t.failed || 'Pendiente de envío'}</p></div>
      {t.writes.filter(w => !w.update).length > 1 && <details><summary>Ver {t.writes.filter(w => !w.update).length} marcas</summary>
        <ul>{t.writes.filter(w => !w.update).map(w => <li key={w.path}>{w.data.studentId} · {w.data.status === 'vino' ? 'Asistió' : w.data.status === 'no_vino' ? 'No asistió' : 'Retirado'}</li>)}</ul></details>}
      <Button disabled={action.busy} onClick={() => action.run(() => retrySubmission(t),'')}>Reintentar</Button></article>)}
    {action.feedback}</section>
}
