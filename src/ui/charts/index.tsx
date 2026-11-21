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

const plotHeight = 144
const tickFormat = new Intl.NumberFormat('es-CO', { maximumSignificantDigits: 6 })

function verticalScale(values: readonly Point[]) {
  const [min, max] = extent(values)
  // Round outwards to readable intervals, keeping whole counts on integer ticks.
  const target = (max - min) / 4 || 1
  const magnitude = 10 ** Math.floor(Math.log10(target))
  const multiple = [1, 2, 5, 10].find(n => n * magnitude >= target) ?? 10
  const step = Math.max(values.every(p => Number.isInteger(p.value)) ? 1 : 0, multiple * magnitude)
  const first = Math.floor(min / step)
  const last = Math.max(first + 1, Math.ceil(max / step))
  const ticks = Array.from({ length: last - first + 1 }, (_, i) => (last - i) * step)
  const y = (value: number) => (last - value / step) / (last - first) * plotHeight
  return { ticks, y }
}

function ScaledChart({ label, data, bars }: ChartProps & { bars?: boolean }) {
  const values = data.filter(point => Number.isFinite(point.value))
  const { ticks, y } = verticalScale(values)
  const column = 100 / Math.max(values.length, 1)
  const x = (i: number) => values.length === 1 ? 50 : bars ? (i + 0.5) * column : i * 100 / (values.length - 1)
  return <ChartFrame label={label} data={values}>
    <div className="ui-plot">
      <div className="ui-y-ticks" aria-hidden="true">
        {ticks.map(tick => <span key={tick}>{tickFormat.format(tick)}</span>)}
      </div>
      <svg role="img" aria-label={label} height={plotHeight}>
        {ticks.map(tick => <line key={tick} x2="100%" y1={y(tick)} y2={y(tick)}
          stroke={tick === 0 ? 'var(--soft-ink)' : 'var(--line)'} />)}
        <line y2={plotHeight} stroke="var(--soft-ink)" />
        {!bars && <svg width="100%" height={plotHeight} viewBox={`0 0 100 ${plotHeight}`} preserveAspectRatio="none">
          <polyline points={values.map((p, i) => x(i) + ',' + y(p.value)).join(' ')} fill="none"
            vectorEffect="non-scaling-stroke" stroke="var(--red)" strokeWidth="2.5" />
        </svg>}
        {values.map((p, i) => {
          const title = <title>{p.label} · {number.format(p.value)}</title>
          return bars ? <rect key={i} x={(i + 0.15) * column + '%'} width={column * 0.7 + '%'}
            y={Math.min(y(0), y(p.value))} height={Math.abs(y(p.value) - y(0))} fill="var(--ink)">{title}</rect>
            : <circle key={i} cx={x(i) + '%'} cy={y(p.value)} r="3" fill="var(--error)">{title}</circle>
        })}
      </svg>
      <div className="ui-axis" data-single={values.length === 1}><span>{values[0]?.label}</span>
        {values.length > 1 && <span>{values.at(-1)?.label}</span>}</div>
    </div>
  </ChartFrame>
}

export function LineChart(props: ChartProps) { return <ScaledChart {...props} /> }
export function BarChart(props: ChartProps) { return <ScaledChart {...props} bars /> }

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
