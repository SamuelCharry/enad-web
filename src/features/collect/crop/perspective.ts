export interface Point { x: number; y: number }
export type Corners = [Point, Point, Point, Point]
export const bounds: Corners = [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }]

export function validCorners(points: Corners) {
  return points.every((a, i) => {
    const b = points[(i + 1) % 4], c = points[(i + 2) % 4]
    return a.x >= 0 && a.x <= 1 && a.y >= 0 && a.y <= 1 &&
      (b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x) > .002
  })
}

/** Homography from the output unit square into the photographed quadrilateral. */
export function projection([a, b, c, d]: Corners) {
  const dx = a.x - b.x + c.x - d.x, dy = a.y - b.y + c.y - d.y
  const det = (b.x - c.x) * (d.y - c.y) - (d.x - c.x) * (b.y - c.y)
  const g = (dx * (d.y - c.y) - (d.x - c.x) * dy) / det
  const h = ((b.x - c.x) * dy - dx * (b.y - c.y)) / det
  return (u: number, v: number): Point => {
    const z = g * u + h * v + 1
    return {
      x: ((b.x - a.x + g * b.x) * u + (d.x - a.x + h * d.x) * v + a.x) / z,
      y: ((b.y - a.y + g * b.y) * u + (d.y - a.y + h * d.y) * v + a.y) / z
    }
  }
}

export async function rectify(canvas: HTMLCanvasElement, corners: Corners) {
  if (!validCorners(corners)) throw new Error('Separa las esquinas del recorte.')
  const w = canvas.width, h = canvas.height
  const ctx = canvas.getContext('2d')!
  const src = ctx.getImageData(0, 0, w, h).data
  const dist = (a: Point, b: Point) => Math.hypot((a.x - b.x) * w, (a.y - b.y) * h)
  const [a, b, c, d] = corners
  const output = document.createElement('canvas')
  output.width = Math.max(2, Math.round(Math.max(dist(a, b), dist(d, c))))
  output.height = Math.max(2, Math.round(Math.max(dist(a, d), dist(b, c))))
  const dest = output.getContext('2d')!
  const pixels = dest.createImageData(output.width, output.height)
  const map = projection(corners)
  for (let y = 0; y < output.height; y++) {
    for (let x = 0; x < output.width; x++) {
      const pt = map(x / (output.width - 1), y / (output.height - 1))
      const sx = Math.max(0, Math.min(w - 1, pt.x * (w - 1))), sy = Math.max(0, Math.min(h - 1, pt.y * (h - 1)))
      const left = Math.floor(sx), top = Math.floor(sy)
      const right = Math.min(w - 1, left + 1), bottom = Math.min(h - 1, top + 1)
      const fx = sx - left, fy = sy - top, out = 4 * (y * output.width + x)
      for (let k = 0; k < 3; k++) {
        const upper = src[4 * (top * w + left) + k] * (1 - fx) + src[4 * (top * w + right) + k] * fx
        const lower = src[4 * (bottom * w + left) + k] * (1 - fx) + src[4 * (bottom * w + right) + k] * fx
        pixels.data[out + k] = upper * (1 - fy) + lower * fy
      }
      pixels.data[out + 3] = 255
    }
  }
  dest.putImageData(pixels, 0, 0)
  const blob = await new Promise<Blob>((resolve, reject) => output.toBlob(b => b ? resolve(b) : reject(new Error('No pudimos recortar la foto.')), 'image/jpeg', .85))
  return new File([blob], 'lista.jpg', { type: 'image/jpeg' })
}
