/** Flutter's luminance, highlight clipping, and Laplacian variance checks. */
export function qualityWarning(rgba: Uint8ClampedArray, width: number, height: number) {
  const gray = new Uint8Array(width * height)
  let light = 0, clipped = 0
  for (let i = 0; i < gray.length; i++) {
    const at = i * 4
    const [r,g,b] = [rgba[at],rgba[at+1],rgba[at+2]]
    gray[i] = (77*r + 150*g + 29*b) >> 8
    light += gray[i]
    if (Math.min(r,g,b) >= 250) clipped++
  }
  const mean = light / gray.length
  if (mean < 65) return 'La foto está oscura.'
  if ((clipped / gray.length > .08 && mean < 200) || clipped / gray.length > .98) return 'La foto tiene reflejos.'
  let sum = 0, squares = 0
  for (let y = 1; y < height-1; y++) {
    for (let x = 1; x < width-1; x++) {
      const i = y * width + x
      const lap = gray[i-1] + gray[i+1] + gray[i-width] + gray[i+width] - 4*gray[i]
      sum += lap
      squares += lap*lap
    }
  }
  const area = Math.max(1,(width-2)*(height-2))
  return squares / area - (sum / area)**2 < 75 ? 'La foto parece borrosa.' : ''
}

export async function checkPhoto(url: string) {
  const img = new Image()
  img.src = url
  await img.decode()
  const scale = Math.min(1, 512 / Math.max(img.naturalWidth,img.naturalHeight))
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1,Math.round(img.naturalWidth * scale))
  canvas.height = Math.max(1,Math.round(img.naturalHeight * scale))
  const ctx = canvas.getContext('2d')
  if (!ctx) return 'Comprueba que los nombres se lean bien.'
  ctx.drawImage(img,0,0,canvas.width,canvas.height)
  return qualityWarning(ctx.getImageData(0,0,canvas.width,canvas.height).data,canvas.width,canvas.height)
}
