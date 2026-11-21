import { afterEach, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { BarChart, Donut, Histogram, LineChart, StackedBar } from './index'

afterEach(cleanup)

it.each([BarChart, LineChart, Histogram, StackedBar, Donut])('distingue datos vacíos de valores en cero', Chart => {
  const { container, rerender } = render(<Chart label="Evaluaciones" data={[]} />)
  expect(screen.getByText('Sin datos para esta gráfica.')).toBeTruthy()
  rerender(<Chart label="Evaluaciones" data={[{ label: 'Línea base', value: 0 }]} />)
  expect(screen.getByRole('img', { name: 'Evaluaciones' })).toBeTruthy()
  expect(screen.getAllByText('Línea base').length).toBeGreaterThan(0)
  expect(container.innerHTML).not.toMatch(/NaN|Infinity/)
})

it('conserva el color de un nivel cuando otros niveles se omiten', () => {
  const { container } = render(<StackedBar label="Distribución" data={[
    { label: 'Palabra', value: 1, color: '#F0BC40' }, { label: 'Cuento', value: 3, color: '#9BC184' },
  ]} />)
  const segments = container.querySelectorAll('svg rect')
  expect(segments[1].getAttribute('fill')).toBe('var(--level-3)')
  expect(segments[1].getAttribute('width')).toBe('25')
  expect(segments[2].getAttribute('x')).toBe('25')
  expect(segments[2].getAttribute('fill')).toBe('var(--level-5)')
})
