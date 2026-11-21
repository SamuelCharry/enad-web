import { useEffect, useRef, useState } from 'react'
import type { PropsWithChildren, ReactNode } from 'react'
import { refreshReports } from '../../data/reports'
import { Button } from '../../ui/components'

export function Skeleton() {
  return <div className="rep-skeleton" role="status"><span className="rep-sr">Cargando datos…</span><i /><i /><i /></div>
}

export function LiveState({ loading, error, children }: PropsWithChildren<{ loading: boolean; error?: string | null }>) {
  if (loading) return <Skeleton />
  if (error) return <p role="alert">{error}</p>
  return <>{children}</>
}

const localTime = new Intl.DateTimeFormat('es-CO', { hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: 'America/Bogota' })

// A new key starts a fresh request. Late results from old filters, users, or
// focus events cannot replace the current report.
export function ReportRead<T>({ query, load, children }: {
  query: string; load: (signal: AbortSignal) => Promise<T>; children: (value: T) => ReactNode
}) {
  return <ReadInstance key={query} load={load}>{children}</ReadInstance>
}
function ReadInstance<T>({ load, children }: { load: (signal: AbortSignal) => Promise<T>; children: (value: T) => ReactNode }) {
  const [revision, setRevision] = useState(0)
  const [result, setResult] = useState<{ value: T; time: Date }>()
  const [settled, setSettled] = useState<{ revision: number; ok: boolean }>()
  const state = settled?.revision !== revision ? 'loading' : settled.ok ? 'ready' : 'error'
  const loader = useRef(load)
  useEffect(() => { loader.current = load }, [load])
  useEffect(() => {
    const refresh = () => setRevision(v => v + 1)
    window.addEventListener('focus', refresh)
    const timer = window.setInterval(() => { if (!document.hidden) refresh() }, 5 * 60_000)
    return () => { window.removeEventListener('focus', refresh); window.clearInterval(timer) }
  }, [])
  useEffect(() => {
    const controller = new AbortController()
    const { signal } = controller
    async function read() {
      try {
        if (signal.aborted) return
        const value = await loader.current(signal)
        if (signal.aborted) return
        setResult({ value, time: new Date() })
        setSettled({ revision, ok: true })
      } catch {
        if (!signal.aborted) setSettled({ revision, ok: false })
      }
    }
    queueMicrotask(() => { void read() })
    return () => controller.abort()
  }, [revision])
  return <>
    <div className="rep-refresh"><small role="status">{result && <>Última actualización · {localTime.format(result.time)}</>}</small>
      <Button loading={state === 'loading'} onClick={() => {refreshReports();setRevision(v => v + 1)}}>Actualizar</Button>
    </div>
    {state === 'error' && <p role="alert">No se pudo cargar el informe. Vuelve a intentarlo con «Actualizar».</p>}
    {!result && state === 'loading' && <Skeleton />}
    {state !== 'error' && result && children(result.value)}
  </>
}
