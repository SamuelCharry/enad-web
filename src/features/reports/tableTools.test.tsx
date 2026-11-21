import { createRef } from 'react'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { utils, writeFile } from 'xlsx'
import { Chart } from './Chart'
import { Print } from './Print'
import { ReportTable } from './TableExport'
vi.mock('xlsx', async original => ({ ...await original<typeof import('xlsx')>(), writeFile: vi.fn() }))
afterEach(cleanup)
it('exporta las celdas visibles con códigos literales y conteos numéricos', async () => {
  render(<ReportTable caption="Estudiantes" headers={['Código', 'Sesiones']} rows={[{ key: 's', cells: ['001', 3] }]} />)
  fireEvent.click(screen.getByRole('button', { name: 'Exportar tabla · Estudiantes' }))
  await waitFor(() => expect(writeFile).toHaveBeenCalledOnce())
  const [book] = vi.mocked(writeFile).mock.calls[0]
  expect(utils.sheet_to_json(book.Sheets[book.SheetNames[0]], { header: 1 })).toEqual([['Estudiantes'], ['Código', 'Sesiones'], ['001', 3]])
})
it('alterna la gráfica de distribución con una tabla accesible', () => {
  render(<Chart type="levels" label="Línea Base" axis="Nivel" data={[{ label: 'Letra', value: 3 }]} />)
  fireEvent.click(screen.getByRole('button', { name: /Ver tabla/ }))
  expect(screen.getByRole('table', { name: 'Línea Base' })).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: 'Ver gráfica' }))
  expect(screen.getByRole('img', { name: 'Línea Base' })).toBeTruthy()
})
it('incluye los detalles cerrados al imprimir y restaura la vista después', () => {
  const report = createRef<HTMLDivElement>()
  render(<><div ref={report}><details><summary>Horas de Sol</summary>Detalle semanal</details></div><Print report={report} /></>)
  const details = report.current!.querySelector('details')!
  fireEvent(window, new Event('beforeprint'))
  expect(details.open).toBe(true)
  fireEvent(window, new Event('afterprint'))
  expect(details.open).toBe(false)
})
