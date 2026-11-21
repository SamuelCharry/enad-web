// Minimal native controls until the corresponding Team A exports are available.
import { NavLink } from "react-router-dom"
import { useEffect, useRef, type ComponentProps, type ReactNode } from 'react'
export function Button({ variant = 'secondary', loading, disabled, type = 'button', ...props }: ComponentProps<'button'> & { variant?: 'primary' | 'secondary' | 'danger' | 'ghost'; loading?: boolean }) {
  return <button type={type} data-variant={variant} disabled={disabled || loading} aria-busy={loading} {...props} />
}
export function Card(props: ComponentProps<'section'>) { return <section className="collect-card" {...props} /> }
export function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="collect-field">
    <span>{label}</span>{children}</label>
}
export function Select(props: ComponentProps<'select'>) { return <select {...props} /> }
export function TextInput(props: ComponentProps<'input'>) { return <input {...props} /> }
export function DateInput(props: ComponentProps<'input'>) { return <input type="date" {...props} /> }
export function NumberInput(props: ComponentProps<'input'>) { return <input type="number" {...props} /> }
export function Dialog({ title, children, onClose, busy }: { title: string; children: ReactNode; onClose: () => void; busy?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const el = ref.current
    el?.showModal()
    return () => el?.close()
  }, [])
  return <dialog ref={ref} className="collect-dialog" aria-label={title} onCancel={e => {
    e.preventDefault()
    if (!busy) onClose()
  }}>
    <h2>{title}</h2>{children}
    <Button disabled={busy} onClick={onClose}>Cerrar</Button>
  </dialog>
}

export function Table({ caption, headers, rows }: { caption: string; headers: readonly string[]; rows: readonly { key: string; cells: readonly ReactNode[] }[] }) {
  return <div className="ui-table" role="region" aria-label={caption} tabIndex={0}>
    <table>
      <caption>{caption}</caption>
      <thead>
        <tr>{headers.map((h, i) => <th scope="col" key={i}>{h}</th>)}</tr>
      </thead>
      <tbody>{rows.map(r => <tr key={r.key}>{r.cells.map((c, i) => <td key={i}>{c}</td>)}</tr>)}</tbody>
    </table>
  </div>
}
export function PageHeader({ title }: { title: string }) {
  return <header>
    <h1>{title}</h1>
  </header>
}
export function Tabs({ label, items }: { label?: string; items: readonly { to: string; label: string }[] }) {
  return <nav className="ui-tabs" aria-label={label}>{items.map(item => <NavLink key={item.to} end to={item.to}>{item.label}</NavLink>)}</nav>
}
