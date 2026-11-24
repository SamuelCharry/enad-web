import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { PageCrop } from './PageCrop'
import { bounds, projection, validCorners, type Corners } from './perspective'

afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals() })
it('rectifica un trapecio y rechaza esquinas cruzadas o colapsadas', () => {
  const corners: Corners = [{ x: .1, y: .2 }, { x: .9, y: .1 }, { x: .8, y: .95 }, { x: .2, y: .85 }]
  expect(validCorners(corners)).toBe(true)
  for (const [i, p] of bounds.entries()) {
    const mapped = projection(corners)(p.x, p.y)
    expect(mapped.x).toBeCloseTo(corners[i].x)
    expect(mapped.y).toBeCloseTo(corners[i].y)
  }
  expect(projection(bounds)(.2, .6)).toEqual({ x: .2, y: .6 })
  expect(validCorners([bounds[1], bounds[0], bounds[2], bounds[3]])).toBe(false)
  expect(validCorners([bounds[1], bounds[1], bounds[2], bounds[3]])).toBe(false)
})
it('inicia en los bordes, acepta flechas y gira una foto horizontal antes de leer', async () => {
  vi.stubGlobal('Image', class { naturalWidth = 800; naturalHeight = 400; decode = async () => { } })
  const ctx = { translate: vi.fn(), rotate: vi.fn(), drawImage: vi.fn() }
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(ctx as unknown as CanvasRenderingContext2D)
  render(<PageCrop url="blob:foto" warning="La foto está oscura." busy={false} onRead={vi.fn()} onCancel={vi.fn()} />)
  const corner = await screen.findByRole('button', { name: 'Esquina superior izquierda' })
  const canvas = screen.getByLabelText('Foto de la lista') as HTMLCanvasElement
  expect([canvas.width, canvas.height]).toEqual([800, 400])
  expect(corner.style.left).toBe('0%')
  fireEvent.keyDown(corner, { key: 'ArrowRight', shiftKey: true })
  expect(corner.style.left).toBe('5%')
  Object.defineProperty(corner, 'hasPointerCapture', { value: () => true })
  vi.spyOn(canvas, 'getBoundingClientRect').mockReturnValue({ left: 0, top: 0, width: 800, height: 400 } as DOMRect)
  fireEvent.pointerMove(corner, { pointerId: 1, clientX: 80, clientY: 80, pointerType: 'touch' })
  expect(corner.style.left).toBe('10%')
  fireEvent.click(screen.getByRole('button', { name: 'Girar foto' }))
  await waitFor(() => expect([canvas.width, canvas.height]).toEqual([400, 800]))
  expect(ctx.rotate).toHaveBeenLastCalledWith(Math.PI / 2)
})
