import { Button } from './components'

/** A fresh route load also reattaches listeners that Firestore terminated. */
export function LoadError({ message }: { message?: string | null }) {
  return <div role="alert"><p>{message || 'No pudimos cargar los datos ahora. Intenta de nuevo en unos minutos.'}</p>
    <Button onClick={() => window.location.reload()}>Reintentar</Button></div>
}
