import type { Frame } from '../../kit/canvas'
import { mulberry32 } from '../../kit/random'
import { HOP, keyTimes, PRINCIPLES, pose, type Options, type Pose } from './principles'

/** Clutter for the "no staging" background: same seed every time so it doesn't flicker. */
const CLUTTER = (() => {
  const r = mulberry32(12)
  return Array.from({ length: 34 }, () => ({ x: r(), y: r() * 0.8, s: 0.02 + r() * 0.05, round: r() > 0.4, tone: r() }))
})()

interface Layout {
  ground: number
  radius: number
  toX: (x: number) => number
  toY: (p: Pose) => number
}

function layoutFor(width: number, height: number): Layout {
  const ground = height * 0.84
  const radius = Math.max(10, Math.min(height * 0.085, width * 0.045))
  return {
    ground,
    radius,
    toX: (x) => width * 0.1 + x * width * 0.8,
    // Centre height: sitting on the ground at y = 0, squash keeps the bottom on the floor.
    toY: (p) => ground - p.y * height * 0.78,
  }
}

/** One ball, drawn in its pose. `ghost` draws just an outline (key poses, onion skin). */
function drawBall(frame: Frame, on: Options, p: Pose, L: Layout, ghost = false) {
  const { ctx, color } = frame
  const r = L.radius
  const x = L.toX(p.x)
  const baseY = L.toY(p)
  const accent = on.staging || ghost ? color('--cat') : color('--muted')
  ctx.save()
  // On the ground, scale about the contact point; in the air, about the centre along the motion.
  if (p.y < 0.001) {
    ctx.translate(x, baseY)
    ctx.scale(p.sx, p.sy)
    ctx.translate(0, -r)
  } else {
    ctx.translate(x, baseY - r)
    ctx.rotate(p.angle)
    ctx.scale(p.sx, p.sy)
    ctx.rotate(-p.angle)
  }

  // Antenna: lags behind (follow-through), with a bulb when the design has appeal.
  const tipX = Math.sin(p.antenna) * r * 1.15
  const tipY = -r - Math.cos(p.antenna) * r * 1.15
  ctx.strokeStyle = ghost ? accent : color('--text')
  ctx.lineWidth = Math.max(2, r * 0.12)
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.moveTo(0, -r * 0.9)
  ctx.quadraticCurveTo(tipX * 0.2, -r * 1.5, tipX, tipY)
  ctx.stroke()
  if (on.appeal && !ghost) {
    ctx.fillStyle = color('--cat-tools')
    ctx.beginPath()
    ctx.arc(tipX, tipY, r * 0.2, 0, Math.PI * 2)
    ctx.fill()
  }

  ctx.beginPath()
  ctx.arc(0, 0, r, 0, Math.PI * 2)
  if (ghost) {
    ctx.globalAlpha = 0.55
    ctx.setLineDash([4, 4])
    ctx.lineWidth = 1.5
    ctx.strokeStyle = accent
    ctx.stroke()
    ctx.restore()
    return
  }
  ctx.fillStyle = accent
  ctx.fill()
  if (on.solidDrawing) {
    // Core shadow toward the bottom right, then a highlight top left.
    const shade = ctx.createRadialGradient(-r * 0.3, -r * 0.35, r * 0.2, 0, 0, r * 1.05)
    shade.addColorStop(0, 'rgb(0 0 0 / 0)')
    shade.addColorStop(1, 'rgb(0 0 0 / 0.38)')
    ctx.fillStyle = shade
    ctx.fill()
    const light = ctx.createRadialGradient(-r * 0.38, -r * 0.42, 0, -r * 0.38, -r * 0.42, r * 0.55)
    light.addColorStop(0, 'rgb(255 255 255 / 0.85)')
    light.addColorStop(1, 'rgb(255 255 255 / 0)')
    ctx.fillStyle = light
    ctx.fill()
  }

  if (on.appeal) {
    // Eyes look where it's going; blinking squashes them shut.
    const open = 1 - p.blink
    for (const side of [-1, 1]) {
      const ex = side * r * 0.32 + p.facing * r * 0.12
      const ey = -r * 0.12
      ctx.fillStyle = '#fff'
      ctx.beginPath()
      ctx.ellipse(ex, ey, r * 0.2, Math.max(0.02, r * 0.26 * open), 0, 0, Math.PI * 2)
      ctx.fill()
      if (open > 0.2) {
        ctx.fillStyle = '#1d2026'
        ctx.beginPath()
        ctx.arc(ex + p.facing * r * 0.07, ey + r * 0.03, r * 0.1, 0, Math.PI * 2)
        ctx.fill()
      }
    }
    ctx.fillStyle = 'rgb(255 120 150 / 0.55)'
    for (const side of [-1, 1]) {
      ctx.beginPath()
      ctx.ellipse(side * r * 0.55 + p.facing * r * 0.1, r * 0.22, r * 0.14, r * 0.08, 0, 0, Math.PI * 2)
      ctx.fill()
    }
  }
  ctx.restore()
}

export interface SceneOptions {
  /** Draw the centre's path over the current hop. */
  trail?: boolean
  label?: string
}

export function drawScene(frame: Frame, t: number, on: Options, scene: SceneOptions = {}) {
  const { ctx, width, height, color } = frame
  const L = layoutFor(width, height)
  const p = pose(t, on)
  const hop = Math.floor(t / HOP)

  // Staging: a spotlight on the action, or visual noise that competes with it.
  if (on.staging) {
    const g = ctx.createRadialGradient(L.toX(p.x), L.ground - L.radius * 2, 0, L.toX(p.x), L.ground - L.radius * 2, width * 0.45)
    g.addColorStop(0, color('--cat'))
    g.addColorStop(1, 'rgb(0 0 0 / 0)')
    ctx.globalAlpha = 0.16
    ctx.fillStyle = g
    ctx.fillRect(0, 0, width, height)
    ctx.globalAlpha = 1
  } else {
    for (const c of CLUTTER) {
      ctx.fillStyle = c.tone > 0.5 ? color('--muted') : color('--border')
      ctx.globalAlpha = 0.55
      const s = c.s * Math.min(width, height) * 2
      ctx.beginPath()
      if (c.round) ctx.arc(c.x * width, c.y * L.ground, s / 2, 0, Math.PI * 2)
      else ctx.rect(c.x * width - s / 2, c.y * L.ground - s / 2, s, s)
      ctx.fill()
    }
    ctx.globalAlpha = 1
  }

  // Ground line.
  ctx.strokeStyle = color('--border')
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(0, L.ground)
  ctx.lineTo(width, L.ground)
  ctx.stroke()

  // Contact shadow: smaller and fainter the higher the ball is (solid drawing).
  if (on.solidDrawing) {
    const k = Math.max(0.25, 1 - p.y * 1.4)
    ctx.fillStyle = color('--text')
    ctx.globalAlpha = 0.18 * k
    ctx.beginPath()
    ctx.ellipse(L.toX(p.x), L.ground + 2, L.radius * 1.1 * k * p.sx, L.radius * 0.22 * k, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.globalAlpha = 1
  }

  if (scene.trail) {
    ctx.fillStyle = color('--cat')
    for (let i = 0; i <= 60; i++) {
      const q = pose(hop * HOP + (i / 60) * HOP, on)
      ctx.globalAlpha = 0.45
      ctx.beginPath()
      ctx.arc(L.toX(q.x), L.toY(q) - L.radius, 1.8, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.globalAlpha = 1
  }

  if (on.poseToPose) for (const k of keyTimes(on, hop)) drawBall(frame, on, pose(k, on), L, true)

  // Dust puffs on landing (secondary action).
  if (on.secondary && p.sinceLanding < 0.45) {
    const k = p.sinceLanding / 0.45
    ctx.fillStyle = color('--muted')
    for (const side of [-1, 1]) {
      for (let i = 0; i < 3; i++) {
        ctx.globalAlpha = (1 - k) * 0.6
        ctx.beginPath()
        ctx.arc(L.toX(p.x) + side * (L.radius * (0.9 + k * 1.6) + i * 6), L.ground - 4 - i * 3 * k, L.radius * 0.18 * (1 - k * 0.5), 0, Math.PI * 2)
        ctx.fill()
      }
    }
    ctx.globalAlpha = 1
  }

  drawBall(frame, on, p, L)

  if (scene.label) {
    ctx.fillStyle = color('--muted')
    ctx.font = '600 12px ui-sans-serif, system-ui, sans-serif'
    ctx.textAlign = 'left'
    ctx.fillText(scene.label, 12, 20)
  }
}

export const countOn = (on: Options) => PRINCIPLES.filter((p) => on[p.key]).length
