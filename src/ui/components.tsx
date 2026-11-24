import { useContext, createContext, useEffect, useId, useLayoutEffect, useRef } from 'react'
import type { ComponentProps, PropsWithChildren, ReactNode } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import type { Subject } from '../domain/types'
import { levelScale } from './levels'

function classes(base: string, extra?: string) {
  return extra ? base + ' ' + extra : base
}

export function Spinner({ label = 'Cargando…' }: { label?: string }) {
  return <span role="status" className="ui-spinner"><span className="sr-only">{label}</span></span>
}

export function Button({ variant = 'secondary', loading = false, disabled, type = 'button', children, className, ...props }:
  ComponentProps<'button'> & { variant?: 'primary' | 'secondary' | 'ghost' | 'danger'; loading?: boolean }) {
  return <button {...props} type={type} data-variant={variant} className={classes('ui-button', className)}
    disabled={disabled || loading} aria-busy={loading}>{loading && <Spinner />}{children}</button>
}

export function Card({ className, ...props }: ComponentProps<'section'>) {
  return <section className={classes('ui-card', className)} {...props} />
}

const FieldContext = createContext<{ id: string; describedBy?: string; invalid: boolean } | null>(null)

export function Field({ label, children, hint, error, htmlFor }: PropsWithChildren<{
  label: string; hint?: string; error?: string; htmlFor?: string
}>) {
  const generated = useId()
  const id = htmlFor ?? generated
  const describedBy = [hint && id + '-hint', error && id + '-error'].filter(Boolean).join(' ') || undefined
  return <div className="ui-field"><label htmlFor={id}>{label}</label>
    <FieldContext.Provider value={{ id, describedBy, invalid: Boolean(error) }}>{children}</FieldContext.Provider>
    {hint && <small id={id + '-hint'}>{hint}</small>}
    {error && <small role="alert" className="ui-error" id={id + '-error'}>{error}</small>}
  </div>
}

function useControl() {
  const field = useContext(FieldContext)
  return { id: field?.id, 'aria-describedby': field?.describedBy, 'aria-invalid': field?.invalid || undefined }
}
export function TextInput({ className, type = 'text', ...props }: ComponentProps<'input'>) {
  return <input {...useControl()} {...props} type={type} className={classes('ui-control', className)} />
}
export function DateInput(props: ComponentProps<'input'>) { return <TextInput {...props} type="date" /> }
export function NumberInput(props: ComponentProps<'input'>) { return <TextInput {...props} type="number" /> }
export function Select({ className, ...props }: ComponentProps<'select'>) {
  const control = useControl()
  const select = useRef<HTMLSelectElement>(null)
  const mirror = useRef<HTMLSpanElement>(null)
  useLayoutEffect(() => {
    if (mirror.current) mirror.current.textContent = select.current?.selectedOptions[0]?.label || ''
  })
  return <span className="ui-select"><select ref={select} {...control} {...props} className={classes('ui-control', className)}
    onChange={event => {
      if (mirror.current) mirror.current.textContent = event.currentTarget.selectedOptions[0]?.label || ''
      props.onChange?.(event)
    }}/><span className="select-value" aria-hidden="true" ref={mirror}/></span>
}

export function Segmented<T extends string>({ label, value, options, onChange, disabled }: {
  label: string; value: T; options: readonly { value: T; label: string }[]; onChange: (value: T) => void; disabled?: boolean
}) {
  const name = useId()
  return <fieldset className="ui-segmented" disabled={disabled}><legend className="sr-only">{label}</legend>
    {options.map(option => <label key={option.value}>
      <input type="radio" name={name} value={option.value} checked={option.value === value} onChange={() => onChange(option.value)} />
      <span>{option.label}</span>
    </label>)}
  </fieldset>
}

export function Dialog({ title, children, onClose, busy = false, open = true }: PropsWithChildren<{
  title: string; onClose: () => void; busy?: boolean; open?: boolean
}>) {
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  useEffect(() => {
    const dialog = ref.current
    if (!open || !dialog) return
    dialog.showModal()
    return () => dialog.close()
  }, [open])
  return <dialog ref={ref} aria-labelledby={titleId} className="ui-dialog"
    onCancel={e => { e.preventDefault(); if (!busy) onClose() }}>
    <h2 id={titleId}>{title}</h2>{children}
    <Button disabled={busy} onClick={onClose}>Cerrar</Button>
  </dialog>
}

// The shared entry point includes the hook alongside Toast by contract.
// oxlint-disable-next-line react/only-export-components
export { useToast } from './useToast'

export function Toast({ message, onClose }: { message: string; onClose?: () => void }) {
  return <div className="ui-toast"><span role="status">{message}</span>
    {onClose && <button type="button" onClick={onClose}>Cerrar</button>}
  </div>
}

export function EmptyState({ title, description, children }: PropsWithChildren<{ title: string; description?: string }>) {
  return <div className="ui-empty"><strong>{title}</strong>{description && <p>{description}</p>}{children}</div>
}

export function Table({ caption, headers, rows }: {
  caption: string; headers: readonly string[]; rows: readonly { key: string; cells: readonly ReactNode[] }[]
}) {
  return <div className="ui-table" role="region" aria-label={caption} tabIndex={0}><table>
    <caption className="sr-only">{caption}</caption>
    <thead><tr>{headers.map((header, i) => <th key={i} scope="col">{header}</th>)}</tr></thead>
    <tbody>{rows.map(row => <tr key={row.key}>{row.cells.map((cell, i) => <td key={i}>{cell}</td>)}</tr>)}</tbody>
  </table></div>
}

export function Tabs({ items, label = 'Secciones' }: { items: readonly { to: string; label: string }[]; label?: string }) {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const active = items.find(item => item.to === pathname.replace(/\/$/, '')) ?? items[0]
  return <nav className="ui-tabs" aria-label={label}>
    <div className="ui-tab-links">{items.map(item =>
      <NavLink key={item.to} end to={item.to}>{item.label}</NavLink>)}</div>
    <div className="ui-tab-picker"><Field label="Sección"><Select value={active?.to ?? ''} onChange={e => navigate(e.target.value)}>
      {items.map(item => <option key={item.to} value={item.to}>{item.label}</option>)}
    </Select></Field></div>
  </nav>
}
export function Badge({ children, className, ...props }: ComponentProps<'span'>) {
  return <span {...props} className={classes('ui-badge', className)}>{children}</span>
}
export function LevelChip({ subject, level }: { subject: Subject; level?: string }) {
  const idx = levelScale[subject].findIndex(([key]) => key === level)
  return <Badge data-level={idx + 1}>{levelScale[subject][idx]?.[1] ?? (level || 'Sin nivel')}</Badge>
}
export function PageHeader({ title, description, children }: PropsWithChildren<{ title: string; description?: string }>) {
  return <header className="ui-page-header"><h1>{title}</h1>{description && <p>{description}</p>}{children}</header>
}
export function SyncStatus({ pending, dirty = false }: { pending: boolean; dirty?: boolean }) {
  return <span role="status" className="ui-sync" data-pending={pending} data-dirty={dirty}>
    {dirty ? 'Sin guardar' : pending ? 'Pendiente de envío' : 'Guardado'}
  </span>
}
