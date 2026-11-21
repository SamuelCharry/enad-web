import { Fragment, useRef, useState, type ReactNode } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Button, Card } from '../../../ui/components'
import { Search } from '../common'
import { matches } from '../formValues'
import { Pager } from '../FileImport'
import { TableExport } from '../../reports/TableExport'
import './admin.css'

export interface DirectoryRow { id: string; cells: ReactNode[]; search: string }
export function Directory({ title, headers, rows, create, editor, editLabel = 'Editar', loading = false }: {
  title: string; headers: string[]; rows: DirectoryRow[]; create?: string; editLabel?: string; loading?: boolean
  editor?: (id: string | null, close: (message?: string) => void) => ReactNode
}) {
  const container = useRef<HTMLDivElement>(null)
  const [params] = useSearchParams()
  const [query, setQuery] = useState(params.get('buscar') || ''), [requested, setPage] = useState(0)
  const [selected, setSelected] = useState<string | null | undefined>()
  const [notice, setNotice] = useState('')
  const filtered = rows.filter(r => matches(query, r.search))
  const page = Math.min(requested, Math.max(0, Math.ceil(filtered.length / 20) - 1))
  function close(message?: string) { setSelected(undefined); setNotice(message || '') }
  return <div className="admin-directory"><div className="collect-toolbar"><Search value={query} onChange={q => { setQuery(q); setPage(0); close() }} />
    {create && <Button variant="primary" onClick={() => { setSelected(null); setNotice('') }}>{create}</Button>}</div>
    {notice && <p role="status">{notice}</p>}
    {selected === null && editor && <Card>{editor(null, close)}</Card>}
    {loading ? <p role="status">Cargando registros…</p> : filtered.length ? <>
      <div ref={container} className="ui-table admin-table"><table><caption className="sr-only">{title}</caption><thead><tr>{headers.map(h => <th scope="col" key={h}>{h}</th>)}{editor && <th scope="col" data-export-ignore>Acciones</th>}</tr></thead>
        <tbody>{filtered.slice(page * 20, page * 20 + 20).map(r => <Fragment key={r.id}><tr>{r.cells.map((cell, i) => <td key={headers[i]} data-label={headers[i]}>{cell}</td>)}{editor &&
          <td data-export-ignore><Button aria-expanded={selected === r.id} onClick={() => { setNotice(''); setSelected(selected === r.id ? undefined : r.id) }}>{editLabel}</Button></td>}</tr>
          {editor && selected === r.id && <tr className="admin-expanded" data-export-ignore><td colSpan={headers.length + 1}>{editor(r.id, close)}</td></tr>}</Fragment>)}</tbody></table></div>
      <TableExport container={container} label="Exportar página a Excel" />
      <Pager page={page} count={filtered.length} setPage={p => { setPage(p); close() }} /></> :
      <p>{query ? 'No hay coincidencias. Prueba otro nombre o código.' : create ? 'Todavía no hay registros. Usa «' + create + '» para comenzar.' : 'No hay registros para esta selección. Revisa los filtros o vuelve después del próximo registro.'}</p>}
  </div>
}
