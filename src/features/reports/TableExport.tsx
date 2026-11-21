import { useState, useRef, type ComponentProps, type RefObject } from 'react'
import { Button, Table } from '../../ui/components'

/** Export displayed columns, links and chips as literal text, retaining codes with leading zeros. */
export function TableExport({ container, label }: { container: RefObject<HTMLDivElement | null>; label: string }) {
  const [busy, setBusy] = useState(false), [message, setMessage] = useState('')
  async function download() {
    const table = container.current?.querySelector('table')
    if (!table) { setMessage('Abre un detalle con filas para exportar sus tablas.'); return }
    setBusy(true)
    setMessage('')
    try {
      const x = await import('xlsx'), book = x.utils.book_new()
      {
        const title = table.caption?.textContent || 'Tabla'
        const grid = Array.from(table.rows).filter(row => !row.hasAttribute('data-export-ignore')).map(row =>
          Array.from(row.cells).filter(cell => !cell.hasAttribute('data-export-ignore')).map(cell => {
            const value = cell.querySelector<HTMLElement>('[data-export-number]')?.dataset.exportNumber
            return value === undefined ? (cell.innerText ?? cell.textContent ?? '').trim() : Number(value)
          }))
        x.utils.book_append_sheet(book, x.utils.aoa_to_sheet([[title], ...grid]), title.replace(/[^\p{L}\p{N} ]/gu, '').slice(0, 31) || 'Tabla')
      }
      x.writeFile(book, 'Tablas-ENAd.xlsx')
      setMessage('Archivo de tablas preparado.')
    } catch { setMessage('No se pudo descargar el archivo. Intenta de nuevo.') }
    finally { setBusy(false) }
  }
  return <><Button onClick={download} loading={busy} variant="ghost">{label}</Button>{message && <p role="status">{message}</p>}</>
}


export function ReportTable(props: ComponentProps<typeof Table>) {
  const container = useRef<HTMLDivElement>(null)
  const rows = props.rows.map(row => ({
    key: row.key,
    cells: row.cells.map((content, i) =>
      <div key={i} data-label={props.headers[i]} data-export-number={typeof content === 'number' ? content : undefined}><div>{content}</div></div>)
  }))
  return <div className="rep-table-block" ref={container}><Table {...props} rows={rows} />
    {props.rows.length > 0 && <div className="rep-table-export"><TableExport container={container} label={'Exportar tabla · ' + props.caption} /></div>}</div>
}
