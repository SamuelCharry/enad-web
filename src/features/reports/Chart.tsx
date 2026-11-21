import { ReportTable as Table } from './TableExport'
import { useState } from 'react'
import { LineChart, BarChart, StackedBar } from '../../ui/charts'
import { Button } from '../../ui/components'

interface Point { label: string; value: number; color?: string }
export function Chart({ type, label, axis, data }: { type: 'line' | 'bars' | 'levels'; label: string; axis: string; data: Point[] }) {
  const [table, setTable] = useState(false)
  const Plot = type === 'line' ? LineChart : type === 'levels' ? StackedBar : BarChart
  return <div className="rep-chart">
    <Button className="rep-chart-switch" variant="ghost" aria-pressed={table} onClick={() => setTable(!table)}>{table ? 'Ver gráfica' : 'Ver tabla de ' + label.toLowerCase()}</Button>
    {table ? <Table caption={label} headers={[axis, 'Estudiantes']} rows={data.map(p => ({ key: p.label, cells: [p.label, p.value] }))} /> :
      <><small>{axis} · Número de estudiantes{type === 'levels' && ' · Barra proporcional al total evaluado'}</small>
        <Plot label={label} data={data} /></>}
  </div>
}
