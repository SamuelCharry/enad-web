import { useEffect, type RefObject } from 'react'
import { Button } from '../../ui/components'

export function Print({ report }: { report: RefObject<HTMLDivElement | null> }) {
  useEffect(() => {
    let expanded: HTMLDetailsElement[] = []
    function prepare() {
      expanded = Array.from(report.current?.querySelectorAll<HTMLDetailsElement>('details:not([open])') ?? [])
      expanded.forEach(detail => { detail.open = true })
    }
    function restore() {
      expanded.forEach(detail => { detail.open = false })
      expanded = []
    }
    window.addEventListener('beforeprint', prepare)
    window.addEventListener('afterprint', restore)
    return () => {
      window.removeEventListener('beforeprint', prepare)
      window.removeEventListener('afterprint', restore)
      restore()
    }
  }, [report])
  return <Button onClick={() => window.print()}>Imprimir vista</Button>
}
