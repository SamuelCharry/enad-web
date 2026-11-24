import { useRef, useState, type ReactNode } from 'react'
import { Button, Card, SyncStatus } from '../../ui/components'
import { GuideReceipt } from './guideContext'

type Step = { instruction: string; target: string; optional?: boolean }
const steps: Record<string, Step[]> = {
  asistencia: [
    { instruction: 'Elige el grupo con el que trabajaste.', target: 'group' },
    { instruction: 'Revisa la fecha de la clase.', target: 'date' },
    { instruction: 'Marca a cada integrante. Puedes comenzar con todos presentes y cambiar las excepciones.', target: 'attendance' },
    { instruction: 'Si llegó alguien nuevo, añádelo al grupo.', target: 'add', optional: true },
    { instruction: 'Guarda la lista y confirma las marcas.', target: 'save' },
  ],
  horas: [
    { instruction: 'Elige la institución donde trabajaste.', target: 'school', optional: true },
    { instruction: 'Selecciona el día que vas a reportar.', target: 'date' },
    { instruction: 'Escribe las horas planeadas para ese día.', target: 'planned' },
    { instruction: 'Escribe cuántas horas realizaste.', target: 'worked' },
    { instruction: 'Si realizaste menos horas, selecciona el motivo y explica qué pasó.', target: 'reason', optional: true },
    { instruction: 'Revisa los valores y guarda el reporte.', target: 'save' },
  ],
  evaluacion: [
    { instruction: 'Elige el área que vas a evaluar.', target: 'subject' },
    { instruction: 'Selecciona el momento de evaluación.', target: 'moment' },
    { instruction: 'Abre la ficha de un estudiante, elige el nivel y guarda la evaluación.', target: 'student' },
  ],
}

export function TaskGuide({ section, children, onClose, enabled }: { enabled: boolean; section: string; children: ReactNode; onClose: () => void }) {
  const [index, setIndex] = useState(0)
  const [pending, setPending] = useState<boolean>()
  const [error, setError] = useState('')
  const form = useRef<HTMLDivElement>(null)
  const flow = steps[section]
  if (!flow) return <>{children}</>
  const step = flow[index]
  function control(target: string) {
    return form.current?.querySelector<HTMLElement>('[data-guide="' + target + '"]')
  }
  function advance() {
    const element = control(step.target)
    if ((!element && !step.optional) || (element instanceof HTMLInputElement && (!element.value || !element.validity.valid)) ||
      (element instanceof HTMLSelectElement && !element.value) || element?.dataset.complete === 'false') {
      setError('Completa este paso en el formulario para continuar.')
      element?.focus()
      return
    }
    setError('')
    const next = Math.min(index+1,flow.length-1)
    setIndex(next)
    control(flow[next].target)?.focus()
  }
  return <GuideReceipt.Provider value={enabled ? setPending : undefined}>{enabled && <Card className="teacher-guide" aria-label="Guía de registro">
    {pending !== undefined ? <><h3>Registro completado</h3><SyncStatus pending={pending} /></> :
      <><h3>Guía · Paso {index+1} de {flow.length}</h3><p aria-live="polite">{step.instruction}</p>
        {error && <p role="alert">{error}</p>}
        <div className="teacher-tools">{index > 0 && <Button onClick={() => { setError(''); setIndex(index-1) }}>Anterior</Button>}
          {index < flow.length-1 && <Button onClick={advance}>{step.target === 'add' ? 'Continuar sin añadir' : 'Continuar'}</Button>}</div></>}
    <Button variant="ghost" onClick={() => { setIndex(0); setPending(undefined); setError(''); onClose() }}>{pending === undefined ? 'Salir de la guía' : 'Terminar guía'}</Button>
  </Card>}<div ref={form}>{children}</div></GuideReceipt.Provider>
}
