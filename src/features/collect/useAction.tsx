import { useRef, useState } from 'react'

export function useAction() {
  const lock = useRef(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  async function run(work: () => Promise<unknown>, success = 'Guardado') {
    if (lock.current) return
    lock.current = true
    setBusy(true)
    setError('')
    setMessage('')
    try {
      const result = await work()
      const pending = typeof result === 'object' && result !== null && 'syncState' in result && result.syncState === 'pending'
      setMessage(pending ? 'Guardado en este dispositivo · Pendiente de envío' : success)
    }
    catch (e) { setError(e instanceof Error ? e.message : 'No se pudo completar la operación. Intenta de nuevo.') }
    finally {
      lock.current = false
      setBusy(false)
    }
  }
  return { busy, run, feedback: <>{error && <p role="alert">{error}</p>}{message && <p role="status">{message}</p>}</> }
}
