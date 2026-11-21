import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { signOut } from '../data/session'
import { Button, Spinner } from '../ui/components'

export function SwitchUser() {
  const navigate = useNavigate()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(false)
  async function switchUser() {
    setBusy(true)
    setError(false)
    try {
      await signOut()
      navigate('/login', { replace: true })
    } catch {
      setError(true)
    } finally {
      setBusy(false)
    }
  }
  return <div className="switch-user"><Button loading={busy} onClick={switchUser}>Cambiar usuario</Button>
    {error && <p role="alert">No se pudo cerrar la sesión. Intenta de nuevo.</p>}
  </div>
}

export function CheckingSession() {
  return <main className="session-state"><Spinner label="Verificando sesión" /><p>Verificando tu sesión…</p></main>
}
