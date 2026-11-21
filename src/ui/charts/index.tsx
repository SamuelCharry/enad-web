import type { ReactNode } from 'react'

type Point = { label: string; value: number; color?: string }
type ChartProps = { label: string; data: readonly Point[] }
const number = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 2 })
const palette = ['#b72619', '#cc6b68', '#f0bc40', '#f9d876', '#9bc184', '#56a359']
function color(point: Point, index: number) {
  const match = palette.indexOf(point.color?.toLowerCase() ?? '')
  return 'var(--level-' + ((match < 0 ? index % palette.length : match) + 1) + ')'
}

function ChartFrame({ label, data, children, legend = false }: ChartProps & { children: ReactNode; legend?: boolean }) {
  return <figure className="ui-chart"><figcaption>{label}</figcaption>
    {data.length ? <>{children}{legend ?
      <ul className="ui-legend">{data.map((point, i) => <li key={i}><i style={{ background: color(point, i) }} />
        {point.label} <strong>{number.format(point.value)}</strong></li>)}</ul> :
      <details><summary>Ver valores de la gráfica</summary><dl>{data.map((point, i) => <div key={i}>
        <dt>{point.label}</dt><dd>{number.format(point.value)}</dd></div>)}</dl></details>}
    </> : <p>Sin datos para esta gráfica.</p>}
  </figure>
}

function extent(data: readonly Point[]) {
  return data.reduce(([min, max], { value }) => [Math.min(min, value), Math.max(max, value)], [0, 0])
}

export function LineChart({ label, data }: ChartProps) {
  const values = data.filter(point => Number.isFinite(point.value))
  const [min, max] = extent(values)
  const y = (value: number) => 118 - (value - min) / (max - min || 1) * 104
  const points = values.map((point, i) => ({
    ...point, x: values.length === 1 ? 200 : 8 + 384 * i / (values.length - 1), y: y(point.value),
  }))
  return <ChartFrame label={label} data={values}><svg role="img" aria-label={label} viewBox="0 0 400 130">
    <path d={'M8 ' + y(0) + 'h384'} stroke="var(--line)" />
    <polyline points={points.map(p => p.x + ',' + p.y).join(' ')} fill="none" stroke="var(--red)" strokeWidth="2.5" />
    {points.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r="3" fill="var(--error)"><title>{p.label} · {number.format(p.value)}</title></circle>)}
  </svg><div className="ui-axis"><span>{values[0]?.label}</span>{values.length > 1 && <span>{values.at(-1)?.label}</span>}</div></ChartFrame>
}

export function BarChart({ label, data }: ChartProps) {
  const values = data.filter(point => Number.isFinite(point.value))
  const [min, max] = extent(values)
  const span = max - min || 1
  const y = (v: number) => 118 - 104 * (v - min) / span
  const step = 384 / Math.max(values.length, 1)
  return <ChartFrame label={label} data={values}><svg role="img" aria-label={label} viewBox="0 0 400 130">
    <path d={'M8 ' + y(0) + 'h384'} stroke="var(--line)" />
    {values.map((p, i) => <rect key={i} x={8 + (i + 0.15) * step} width={step * 0.7}
      y={Math.min(y(0), y(p.value))} height={Math.abs(y(p.value) - y(0))} fill="var(--ink)">
      <title>{p.label} · {number.format(p.value)}</title></rect>)}
  </svg><div className="ui-axis"><span>{values[0]?.label}</span>{values.length > 1 && <span>{values.at(-1)?.label}</span>}</div></ChartFrame>
}

// Adjacent bins share a baseline; the caller supplies the ordered bin labels.
export function Histogram({ label, data }: ChartProps) {
  const bins = data.filter(p => Number.isFinite(p.value) && p.value >= 0)
  const [, max] = extent(bins)
  const width = 384 / Math.max(bins.length, 1)
  return <ChartFrame label={label} data={bins}><svg role="img" aria-label={label} viewBox="0 0 400 130">
    {bins.map((p, i) => {
      const height = 104 * p.value / (max || 1)
      return <rect key={i} x={8 + i * width} width={width} y={118 - height} height={height}
        fill="var(--ink)" stroke="var(--paper)" strokeWidth="1"><title>{p.label} · {number.format(p.value)}</title></rect>
    })}
    <path d="M8 118h384" stroke="var(--line)" />
  </svg><div className="ui-axis"><span>{bins[0]?.label}</span>{bins.length > 1 && <span>{bins.at(-1)?.label}</span>}</div></ChartFrame>
}

function distribution(data: readonly Point[]) {
  const values = data.filter(p => Number.isFinite(p.value) && p.value >= 0)
  const total = values.reduce((sum, p) => sum + p.value, 0)
  let end = 0
  const segments = values.map(p => {
    const start = end
    const width = total ? 100 * p.value / total : 0
    end += width
    return { start, width }
  })
  return { values, total, segments }
}

export function StackedBar({ label, data }: ChartProps) {
  const { values, segments } = distribution(data)
  return <ChartFrame label={label} data={values} legend><svg viewBox="0 0 100 5" role="img" aria-label={label}>
    <rect width="100" height="5" fill="var(--neutral)" />
    {segments.map((s, i) => <rect key={i} x={s.start} width={s.width} height="5" fill={color(values[i], i)} />)}
  </svg></ChartFrame>
}
export function Donut({ label, data }: ChartProps) {
  const { values, total, segments } = distribution(data)
  return <ChartFrame label={label} data={values} legend><svg className="ui-donut" viewBox="0 0 128 128" role="img" aria-label={label}>
    <g fill="none" strokeWidth="16" transform="rotate(-90 64 64)">
      <circle cx="64" cy="64" r="52" stroke="var(--neutral)" />
      {segments.map((s, i) => s.width > 0 && <circle key={i} cx="64" cy="64" r="52" pathLength="100" stroke={color(values[i], i)}
        strokeDasharray={s.width + ' ' + (100 - s.width)} strokeDashoffset={-s.start} />)}
    </g>
    <text x="64" y="64" dy=".35em" textAnchor="middle" fill="var(--ink)">{number.format(total)}</text>
  </svg></ChartFrame>
}
