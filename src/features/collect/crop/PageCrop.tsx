import { useEffect, useRef, useState } from 'react'
import { Button } from '../../../ui/components'
import { bounds, rectify, validCorners, type Corners, type Point } from './perspective'
import './crop.css'

const labels = ['superior izquierda', 'superior derecha', 'inferior derecha', 'inferior izquierda']
export function PageCrop({ url, warning, onRead, onCancel, busy }: { url: string; warning: string; onRead: (file: File) => Promise<void>; onCancel: () => void; busy: boolean }) {
  const [points, setPoints] = useState<Corners>(bounds)
  const [turns, setTurns] = useState(0)
  const [ready, setReady] = useState(false)
  const [working, setWorking] = useState(false)
  const [error, setError] = useState('')
  const canvas = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    let active = true
    const image = new Image()
    image.src = url
    void image.decode().then(() => {
      if (!active || !canvas.current) return
      const scale = Math.min(1, 2200 / Math.max(image.naturalWidth, image.naturalHeight))
      const w = Math.max(1, Math.round(image.naturalWidth * scale)), h = Math.max(1, Math.round(image.naturalHeight * scale))
      const el = canvas.current
      el.width = turns % 2 ? h : w
      el.height = turns % 2 ? w : h
      const ctx = el.getContext('2d')!
      ctx.translate(el.width / 2, el.height / 2)
      ctx.rotate(turns * Math.PI / 2)
      ctx.drawImage(image, -w / 2, -h / 2, w, h)
      setReady(true)
    }).catch(() => { if (active) setError('No pudimos abrir la foto. Elige otra imagen.') })
    return () => { active = false }
  }, [url, turns])
  function move(i: number, point: Point) {
    const clamp = (v: number) => Math.max(0, Math.min(1, v))
    setPoints(prev => {
      const updated: Corners = [...prev]
      updated[i] = { x: clamp(point.x), y: clamp(point.y) }
      return validCorners(updated) ? updated : prev
    })
  }
  async function read() {
    if (!canvas.current || !ready || working) return
    setWorking(true)
    setError('')
    try { await onRead(await rectify(canvas.current, points)) }
    catch (e) { setError(e instanceof Error ? e.message : 'Intenta con otra foto.') }
    finally { setWorking(false) }
  }
  return <fieldset className="page-crop" disabled={busy || working}>
    <legend>Recortar página</legend>
    <p>Mueve las esquinas hasta los bordes de la hoja. Con teclado, usa las flechas.</p>
    <div className="page-crop-image"><canvas ref={canvas} aria-label="Foto de la lista" />
      {ready && <><svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
        <polygon points={points.map(p => p.x * 100 + ',' + p.y * 100).join(' ')} /></svg>
        {points.map((p, i) => <button type="button" key={i} className="crop-corner" aria-label={'Esquina ' + labels[i]}
          style={{ left: p.x * 100 + '%', top: p.y * 100 + '%' }}
          onPointerDown={e => e.currentTarget.setPointerCapture(e.pointerId)}
          onPointerMove={e => {
            if (!e.currentTarget.hasPointerCapture(e.pointerId)) return
            const rect = canvas.current!.getBoundingClientRect()
            move(i, { x: (e.clientX - rect.left) / rect.width, y: (e.clientY - rect.top) / rect.height })
          }} onKeyDown={e => {
            const delta: Record<string, Point> = { ArrowUp: { x: 0, y: -1 }, ArrowDown: { x: 0, y: 1 }, ArrowLeft: { x: -1, y: 0 }, ArrowRight: { x: 1, y: 0 } }
            const step = delta[e.key]
            if (!step) return
            e.preventDefault()
            move(i, { x: p.x + step.x * (e.shiftKey ? .05 : .005), y: p.y + step.y * (e.shiftKey ? .05 : .005) })
          }} />)}</>}
    </div>
    {warning && <p role="status">{warning}</p>}{error && <p role="alert">{error}</p>}
    <Button disabled={!ready} onClick={() => { setReady(false); setPoints(bounds); setTurns((turns + 1) % 4) }}>Girar foto</Button>
    <Button onClick={onCancel}>Elegir otra foto</Button>
    <Button variant="primary" disabled={!ready} loading={working || busy} onClick={read}>Leer nombres</Button>
  </fieldset>
}
