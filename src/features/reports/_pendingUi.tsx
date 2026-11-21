// Temporary Team A UI kit surface. Keep the report views independent of markup.
import type { ButtonHTMLAttributes, ComponentProps, PropsWithChildren, ReactNode } from 'react'
import { NavLink } from 'react-router-dom'
import { number } from './model'
import { LEVELS, levelColor, levelLabel } from './_pending'
import type { Subject } from '../../domain/types'

function FallbackButton({ loading, variant = 'secondary', type = 'button', ...props }: ButtonHTMLAttributes<HTMLButtonElement> & {
  loading?: boolean; variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
}) {
  return <button type={type} {...props} disabled={loading || props.disabled} aria-busy={loading} data-variant={variant} />
}
function FallbackCard({ children, ...props }: ComponentProps<'section'>) { return <section {...props}>{children}</section> }
function FallbackField({ label, children, hint, error, htmlFor }: PropsWithChildren<{ label: string; hint?: string; error?: string; htmlFor?: string }>) {
  return <label className="rep-field" htmlFor={htmlFor}>{label}{children}{hint && <small>{hint}</small>}{error && <small role="alert">{error}</small>}</label>
}
function FallbackSelect(props: ComponentProps<'select'>) { return <select {...props} /> }
function FallbackTextInput(props: ComponentProps<'input'>) { return <input {...props} type="text" /> }
function FallbackDateInput(props: ComponentProps<'input'>) { return <input {...props} type="date" /> }
function FallbackEmptyState({ title, description, children }: PropsWithChildren<{ title: string; description?: string }>) {
  return <div className="rep-empty"><p>{title}</p>{description && <p>{description}</p>}{children}</div>
}
function FallbackPageHeader({ title, children, description }: PropsWithChildren<{ title: string; description?: string }>) {
  return <header className="rep-heading"><h1>{title}</h1>{description && <p>{description}</p>}{children}</header>
}
function FallbackTable({ caption, headers, rows }: {
  caption: string; headers: readonly string[]; rows: readonly { key: string; cells: readonly ReactNode[] }[]
}) {
  return <div className="rep-scroll" role="region" aria-label={caption} tabIndex={0}><table>
    <caption className="rep-sr">{caption}</caption>
    <thead><tr>{headers.map(h => <th scope="col" key={h}>{h}</th>)}</tr></thead>
    <tbody>{rows.map(row => <tr key={row.key}>{row.cells.map((cell, i) => <td key={headers[i]}>{cell}</td>)}</tr>)}</tbody>
  </table></div>
}
function FallbackTabs({ items, label = 'Secciones' }: { items: readonly { to: string; label: string }[]; label?: string }) {
  return <nav className="rep-tabs" aria-label={label}>
    {items.map(item => <NavLink key={item.to} to={item.to} end>{item.label}</NavLink>)}
  </nav>
}
function FallbackLevelChip({ subject, level }: { subject: Subject; level?: string }) {
  const { bg, fg } = levelColor(LEVELS[subject].indexOf(level ?? ''))
  return <span className="rep-chip" style={{ background: bg, color: fg }}>{levelLabel(subject, level ?? '')}</span>
}

type Point = { label: string; value: number; color?: string }
type ChartProps = { label: string; data: readonly Point[] }
function FallbackLineChart({ label, data }: ChartProps) {
  const peak = data.reduce((max, p) => Math.max(max, p.value), 1)
  const points = data.map((p, i) => [10 + 580 * i / Math.max(data.length - 1, 1), 112 - 104 * p.value / peak])
  return <figure aria-label={label}>
    <svg viewBox="0 0 600 122" role="img" aria-label={label}>
      <path d="M10 112H590" stroke="currentColor" opacity=".25" />
      <polyline fill="none" stroke="#E52228" strokeWidth="3" points={points.map(p => p.join(',')).join(' ')} />
      {points.map(([x,y], i) => <circle key={data[i].label} cx={x} cy={y} r="4" fill="#B72619"><title>{data[i].label} · {number(data[i].value)}</title></circle>)}
    </svg>
    <figcaption className="rep-between"><span>{data[0]?.label}</span><span>{data.length > 1 && data.at(-1)?.label}</span></figcaption>
    <details><summary>Ver valores de la gráfica</summary><ul>{data.map(p => <li key={p.label}>{p.label} · {number(p.value)}</li>)}</ul></details>
  </figure>
}
function chartSegments(data: readonly Point[]) {
  const total = data.reduce((sum, p) => sum + p.value, 0)
  let end = 0
  return data.map(p => {
    const width = total ? 100 * p.value / total : 0
    const left = end
    end += width
    return { ...p, width, left }
  })
}
function FallbackStackedBar({ label, data }: ChartProps) {
  const segments = chartSegments(data)
  return <figure aria-label={label}>
    <svg viewBox="0 0 100 5" preserveAspectRatio="none" className="rep-stack" role="img" aria-label={label}>
      {segments.map(p => <rect key={p.label} x={p.left} y="0" height="5" width={p.width} fill={p.color} />)}
    </svg><figcaption className="rep-legend">{data.map(p => <span key={p.label}><i style={{ background: p.color }} />{p.label} · {number(p.value)}</span>)}</figcaption>
  </figure>
}
function FallbackHistogram({ label, data }: ChartProps) {
  const peak = data.reduce((max, p) => Math.max(max, p.value), 1)
  return <figure aria-label={label} className="rep-bars">{data.map(p => <div key={p.label}>
    <span>{p.label}</span><svg viewBox="0 0 100 8" preserveAspectRatio="none" aria-hidden="true"><rect width={100 * p.value / peak} height="8" fill="currentColor" /></svg>
    <strong>{number(p.value)}</strong>
  </div>)}</figure>
}

const kit = {
  Button: FallbackButton,
  Card: FallbackCard,
  Field: FallbackField,
  Select: FallbackSelect,
  TextInput: FallbackTextInput,
  DateInput: FallbackDateInput,
  EmptyState: FallbackEmptyState,
  PageHeader: FallbackPageHeader,
  Table: FallbackTable,
  Tabs: FallbackTabs,
  LevelChip: FallbackLevelChip,
}
const kitBindings = Object.values(import.meta.glob<typeof kit>('../../ui/components.tsx', { eager: true }))[0] ?? kit
export const Button = kitBindings.Button
export const Card = kitBindings.Card
export const Field = kitBindings.Field
export const Select = kitBindings.Select
export const TextInput = kitBindings.TextInput
export const DateInput = kitBindings.DateInput
export const EmptyState = kitBindings.EmptyState
export const PageHeader = kitBindings.PageHeader
export const Table = kitBindings.Table
export const Tabs = kitBindings.Tabs
export const LevelChip = kitBindings.LevelChip

const charts = {
  LineChart: FallbackLineChart,
  StackedBar: FallbackStackedBar,
  Histogram: FallbackHistogram,
}
const chartsBindings = Object.values(import.meta.glob<typeof charts>('../../ui/charts/index.tsx', { eager: true }))[0] ?? charts
export const LineChart = chartsBindings.LineChart
export const StackedBar = chartsBindings.StackedBar
export const Histogram = chartsBindings.Histogram
