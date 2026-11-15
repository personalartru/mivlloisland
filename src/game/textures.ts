import * as THREE from 'three'
import type { ItemKind } from './quests'

/** Soft radial gradient drawn once to a canvas; shared by every glow sprite. */
let haloCache: THREE.Texture | undefined
export function haloTexture(): THREE.Texture {
  if (haloCache) return haloCache
  const size = 128
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = size
  const ctx = canvas.getContext('2d')!
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
  g.addColorStop(0, 'rgba(255,255,255,1)')
  g.addColorStop(0.25, 'rgba(255,255,255,0.45)')
  g.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, size, size)
  haloCache = new THREE.CanvasTexture(canvas)
  haloCache.colorSpace = THREE.SRGBColorSpace
  return haloCache
}

export function drawItemIcon(ctx: CanvasRenderingContext2D, kind: ItemKind, cx: number, cy: number, r: number): void {
  ctx.save()
  ctx.translate(cx, cy)
  ctx.lineJoin = 'round'
  ctx.lineCap = 'round'
  if (kind === 'berry') {
    ctx.fillStyle = '#ff4d68'
    ctx.beginPath()
    ctx.moveTo(0, r * 0.95)
    ctx.bezierCurveTo(-r * 1.2, -r * 0.15, -r * 0.7, -r * 0.95, 0, -r * 0.45)
    ctx.bezierCurveTo(r * 0.7, -r * 0.95, r * 1.2, -r * 0.15, 0, r * 0.95)
    ctx.fill()
    ctx.fillStyle = '#fff1c9'
    for (const [x, y] of [[-0.35, 0.1], [0.3, -0.05], [0, 0.45]] as const) {
      ctx.beginPath()
      ctx.arc(x * r, y * r, r * 0.07, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.fillStyle = '#5fc45f'
    for (const a of [-0.55, 0, 0.55]) {
      ctx.beginPath()
      ctx.ellipse(Math.sin(a) * r * 0.42, -r * 0.72, r * 0.38, r * 0.16, a, 0, Math.PI * 2)
      ctx.fill()
    }
  } else if (kind === 'crystal') {
    ctx.fillStyle = '#79dcff'
    ctx.beginPath()
    ctx.moveTo(0, -r)
    ctx.lineTo(r * 0.7, -r * 0.15)
    ctx.lineTo(r * 0.35, r * 0.9)
    ctx.lineTo(-r * 0.35, r * 0.9)
    ctx.lineTo(-r * 0.7, -r * 0.15)
    ctx.closePath()
    ctx.fill()
    ctx.fillStyle = 'rgba(255,255,255,0.55)'
    ctx.beginPath()
    ctx.moveTo(0, -r)
    ctx.lineTo(r * 0.7, -r * 0.15)
    ctx.lineTo(0, r * 0.15)
    ctx.closePath()
    ctx.fill()
  } else if (kind === 'mushroom') {
    ctx.fillStyle = '#fff0d4'
    ctx.beginPath()
    ctx.roundRect(-r * 0.3, -r * 0.05, r * 0.6, r * 0.95, r * 0.2)
    ctx.fill()
    ctx.fillStyle = '#ff7a55'
    ctx.beginPath()
    ctx.arc(0, -r * 0.1, r * 0.95, Math.PI, 0)
    ctx.closePath()
    ctx.fill()
    ctx.fillStyle = '#fff6e5'
    for (const [x, y, s] of [[-0.45, -0.45, 0.18], [0.25, -0.55, 0.15], [0.5, -0.3, 0.12]] as const) {
      ctx.beginPath()
      ctx.arc(x * r, y * r, s * r, 0, Math.PI * 2)
      ctx.fill()
    }
  } else {
    ctx.fillStyle = '#ffd24a'
    ctx.beginPath()
    for (let i = 0; i < 10; i += 1) {
      const a = -Math.PI / 2 + (i * Math.PI) / 5
      const rad = i % 2 === 0 ? r : r * 0.46
      ctx.lineTo(Math.cos(a) * rad, Math.sin(a) * rad)
    }
    ctx.closePath()
    ctx.fill()
    ctx.strokeStyle = 'rgba(255,255,255,0.65)'
    ctx.lineWidth = r * 0.12
    ctx.stroke()
  }
  ctx.restore()
}

const iconCache = new Map<string, THREE.Texture>()

/** Floating task bubble above a resident: available, progress, or done. */
export function questBubbleTexture(state: 'available' | 'active' | 'done', kind: ItemKind, have: number, need: number): THREE.Texture {
  const key = `${state}:${kind}:${have}:${need}`
  const cached = iconCache.get(key)
  if (cached) return cached
  const size = 192
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = size
  const ctx = canvas.getContext('2d')!
  const bg = state === 'done' ? '#8fe08a' : state === 'active' ? '#fff8e7' : '#ffd35c'
  ctx.fillStyle = 'rgba(58,46,79,0.35)'
  ctx.beginPath()
  ctx.ellipse(size / 2, size - 18, 54, 16, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = bg
  ctx.strokeStyle = '#3a2e4f'
  ctx.lineWidth = 12
  ctx.beginPath()
  ctx.arc(size / 2, size / 2 - 10, 66, 0, Math.PI * 2)
  ctx.fill()
  ctx.stroke()
  if (state === 'available') {
    ctx.fillStyle = '#3a2e4f'
    ctx.font = '900 104px Nunito, system-ui, sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('!', size / 2, size / 2 - 2)
  } else if (state === 'done') {
    ctx.strokeStyle = '#2f7a43'
    ctx.lineWidth = 18
    ctx.lineCap = 'round'
    ctx.beginPath()
    ctx.moveTo(size / 2 - 34, size / 2 - 8)
    ctx.lineTo(size / 2 - 8, size / 2 + 20)
    ctx.lineTo(size / 2 + 40, size / 2 - 34)
    ctx.stroke()
  } else {
    drawItemIcon(ctx, kind, size / 2, size / 2 - 26, 38)
    ctx.fillStyle = '#3a2e4f'
    ctx.font = '800 34px Nunito, system-ui, sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(`${have}/${need}`, size / 2, size / 2 + 48)
  }
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  iconCache.set(key, texture)
  return texture
}
