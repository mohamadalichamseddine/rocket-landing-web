// Draws the landing scene on a canvas: sky, ground, pad, rocket, flames, trail, scale bar, and
// how the flight ended. A canvas version of the Python environment_renderer.py; the flight
// numbers and the failure reasons go in the status panel instead (see status-panel.ts).

import { Outcome } from '../environment/outcome.ts'
import { RocketPart, type RocketSimulator } from '../rocket/rocket-simulator.ts'
import type { Vector } from '../rocket/rocket-spec.ts'

// The scene is drawn in canvas units, as in Python's 960 × 720 px window, then scaled to the
// canvas's size on the page.
const WIDTH = 960
const HEIGHT = 720
const MIN_VIEW_HEIGHT = 14 // [m] of world shown at the closest zoom, near the ground
const MIN_ROCKET_SIZE = 48 // far away, the rocket is drawn at least this tall so it stays visible
const PAD_HALF_WIDTH = 2 // [m]
const MIN_TEXT_SIZE = 12 // [CSS px]: small text stays readable on a narrow screen

const SKY_TOP = 'rgb(20 36 72)'
const SKY_HORIZON = 'rgb(130 170 214)'
const GROUND = 'rgb(92 76 58)'
const PAD = 'rgb(140 140 146)'
const PAD_TARGET = 'rgb(240 196 40)'
const PART_COLORS: Record<RocketPart, string> = {
  [RocketPart.BODY]: 'rgb(236 238 242)',
  [RocketPart.ENGINE_BLOCK]: 'rgb(88 96 110)',
  [RocketPart.LEG]: 'rgb(36 36 40)',
}
const OUTLINE = 'rgb(20 20 24)'
const FLAME_OUTER = 'rgb(255 132 28)'
const FLAME_INNER = 'rgb(255 228 120)'
const TRAIL = 'rgb(255 255 255)'
const TEXT = 'rgb(245 245 245)'
const LANDED_COLOR = 'rgb(70 210 100)'
const FAILED_COLOR = 'rgb(235 70 60)'

const TITLE_FONT = 'bold 40px "Segoe UI", Helvetica, Arial, sans-serif'
const TEXT_FONT_FAMILY = 'Consolas, Menlo, "DejaVu Sans Mono", monospace'
const TEXT_FONT_SIZE = 16

/** The pad: gray, with the yellow target in the middle. */
const PAD_STRIPES: readonly { halfWidth: number; color: string }[] = [
  { halfWidth: PAD_HALF_WIDTH, color: PAD },
  { halfWidth: 0.5, color: PAD_TARGET },
]

interface FlameSize {
  readonly length: number // [m] at full throttle
  readonly width: number // [m]
}
const FLAME_SIZES = new Map<string, FlameSize>([['main', { length: 1.6, width: 0.24 }]])
const SIDE_FLAME_SIZE: FlameSize = { length: 0.5, width: 0.08 }
/** Each flame is an outer and a smaller inner triangle. */
const FLAME_LAYERS: readonly { fraction: number; color: string }[] = [
  { fraction: 1, color: FLAME_OUTER },
  { fraction: 0.55, color: FLAME_INNER },
]

/** Lengths the scale bar can show [m]. */
const SCALE_BAR_LENGTHS = [1, 2, 5, 10, 20, 50, 100, 200]

const OUTCOME_TITLES: Record<Outcome, string> = {
  [Outcome.LANDED]: 'LANDED',
  [Outcome.UNSAFE_TOUCHDOWN]: 'UNSAFE TOUCHDOWN',
  [Outcome.LOST_CONTROL]: 'LOST CONTROL',
  [Outcome.OUT_OF_BOUNDS]: 'OUT OF BOUNDS',
  [Outcome.TIME_LIMIT]: 'TIME LIMIT',
}

/**
 * Draws frames of the landing scene on a canvas.
 *
 * The camera frames the rocket and the pad together and zooms in as the rocket comes down.
 */
export class EnvironmentRenderer {
  private readonly canvas: HTMLCanvasElement
  private readonly context: CanvasRenderingContext2D
  private readonly sky: CanvasGradient
  private readonly trail: Vector[] = []
  // The camera, set for each frame.
  private pixelsPerMeter = 1 // [canvas units/m]
  private centerX = 0 // [m]
  private bottom = 0 // [m]

  constructor(canvas: HTMLCanvasElement) {
    const context = canvas.getContext('2d')
    if (context === null) {
      throw new Error('this browser cannot draw on a canvas')
    }
    this.canvas = canvas
    this.context = context
    this.sky = context.createLinearGradient(0, 0, 0, HEIGHT)
    this.sky.addColorStop(0, SKY_TOP)
    this.sky.addColorStop(1, SKY_HORIZON)
  }

  /** Match the canvas's pixels to its size on the page, so the drawing stays sharp. */
  resize(): void {
    this.canvas.width = Math.round(this.canvas.clientWidth * devicePixelRatio)
    this.canvas.height = Math.round(this.canvas.clientHeight * devicePixelRatio)
  }

  /** Clear the trail of the previous flight. */
  startFlight(): void {
    this.trail.length = 0
  }

  /**
   * Draw one frame of the scene.
   *
   * `throttles` sets the flames; `outcome` and `message`, when not null, are written over the
   * scene.
   */
  draw(
    rocketSimulator: RocketSimulator,
    throttles: readonly number[],
    outcome: Outcome | null,
    message: string | null,
  ): void {
    const state = rocketSimulator.state()
    // Frames can come more often than steps: the trail only grows when the rocket has moved.
    const lastPoint = this.trail.at(-1)
    if (lastPoint === undefined || lastPoint.x !== state.x || lastPoint.y !== state.y) {
      this.trail.push({ x: state.x, y: state.y })
    }
    this.setCamera(state.x, state.y)

    const context = this.context
    context.setTransform(this.canvas.width / WIDTH, 0, 0, this.canvas.height / HEIGHT, 0, 0)
    context.fillStyle = this.sky
    context.fillRect(0, 0, WIDTH, HEIGHT)
    this.drawGround()
    this.drawTrail()
    this.drawRocket(rocketSimulator, throttles)
    this.drawScaleBar()
    if (outcome !== null) {
      const color = outcome === Outcome.LANDED ? LANDED_COLOR : FAILED_COLOR
      this.drawTitle(OUTCOME_TITLES[outcome], 30, color)
    }
    if (message !== null) {
      this.drawTitle(message, HEIGHT / 2, TEXT)
    }
  }

  private setCamera(x: number, y: number): void {
    // Show the rocket and the pad together; the view shrinks as the rocket comes down.
    const viewHeight = Math.max(MIN_VIEW_HEIGHT, 1.3 * y + 6, ((Math.abs(x) + 12) * HEIGHT) / WIDTH)
    this.pixelsPerMeter = HEIGHT / viewHeight
    this.centerX = x / 2
    this.bottom = -0.1 * viewHeight
  }

  private toScreen(point: Vector): Vector {
    return {
      x: WIDTH / 2 + (point.x - this.centerX) * this.pixelsPerMeter,
      y: HEIGHT - (point.y - this.bottom) * this.pixelsPerMeter,
    }
  }

  /** Canvas units per CSS pixel: lines this wide stay one pixel wide on any screen. */
  private get cssPixel(): number {
    return WIDTH / this.canvas.clientWidth
  }

  private drawGround(): void {
    const context = this.context
    const groundY = this.toScreen({ x: 0, y: 0 }).y
    context.fillStyle = GROUND
    context.fillRect(0, groundY, WIDTH, HEIGHT - groundY + 1)
    for (const { halfWidth, color } of PAD_STRIPES) {
      const topLeft = this.toScreen({ x: -halfWidth, y: 0 })
      const bottomRight = this.toScreen({ x: halfWidth, y: -0.25 })
      context.fillStyle = color
      context.fillRect(
        topLeft.x,
        topLeft.y,
        bottomRight.x - topLeft.x,
        Math.max(bottomRight.y - topLeft.y, 3),
      )
    }
  }

  private drawTrail(): void {
    if (this.trail.length < 2) {
      return
    }
    const context = this.context
    context.beginPath()
    for (const point of this.trail) {
      const screenPoint = this.toScreen(point)
      context.lineTo(screenPoint.x, screenPoint.y)
    }
    context.strokeStyle = TRAIL
    context.lineWidth = this.cssPixel
    context.stroke()
  }

  private drawRocket(rocketSimulator: RocketSimulator, throttles: readonly number[]): void {
    const state = rocketSimulator.state()
    const rocketSpec = rocketSimulator.rocketSpec
    const lowestTip = Math.min(...rocketSpec.legs.map((leg) => leg.tip.y))
    const rocketHeight = rocketSpec.body.height - lowestTip
    const pixelsPerMeter = Math.max(this.pixelsPerMeter, MIN_ROCKET_SIZE / rocketHeight)
    const center = this.toScreen(state)
    // Around the center of mass, so a rocket enlarged for visibility stays in place.
    const toScreen = (point: Vector): Vector => ({
      x: center.x + (point.x - state.x) * pixelsPerMeter,
      y: center.y - (point.y - state.y) * pixelsPerMeter,
    })

    for (const [i, nozzle] of rocketSpec.nozzles.entries()) {
      const throttle = throttles[i]
      if (throttle <= 0.01) {
        continue
      }
      const flameSize = FLAME_SIZES.get(nozzle.name) ?? SIDE_FLAME_SIZE
      const origin = rocketSimulator.pointToWorld(nozzle.position)
      const push = rocketSimulator.directionToWorld(nozzle.direction)
      const exhaust = { x: -push.x, y: -push.y } // the exhaust leaves opposite to the push
      const flicker = 0.85 + 0.3 * Math.random()
      for (const { fraction, color } of FLAME_LAYERS) {
        const length = flameSize.length * throttle * flicker * fraction
        const flame = flameTriangle(origin, exhaust, length, flameSize.width * fraction)
        this.fillPolygon(flame.map(toScreen), color)
      }
    }

    const context = this.context
    for (const { rocketPart, corners } of rocketSimulator.shapes()) {
      this.fillPolygon(corners.map(toScreen), PART_COLORS[rocketPart])
      context.strokeStyle = OUTLINE
      context.lineWidth = this.cssPixel
      context.stroke()
    }
  }

  /** Fill a polygon; it stays the current path, so it can be outlined next. */
  private fillPolygon(points: readonly Vector[], color: string): void {
    const context = this.context
    context.beginPath()
    for (const point of points) {
      context.lineTo(point.x, point.y)
    }
    context.closePath()
    context.fillStyle = color
    context.fill()
  }

  private drawScaleBar(): void {
    // A bar of a round length, about 120 canvas units long, so the zoom level is readable.
    const targetLength = 120 / this.pixelsPerMeter
    const length = SCALE_BAR_LENGTHS.reduce((closest, candidate) =>
      Math.abs(candidate - targetLength) < Math.abs(closest - targetLength) ? candidate : closest,
    )
    const lengthPx = length * this.pixelsPerMeter
    const x0 = WIDTH - 20 - lengthPx
    const y0 = HEIGHT - 20
    const context = this.context
    context.beginPath()
    context.moveTo(x0, y0)
    context.lineTo(x0 + lengthPx, y0)
    for (const x of [x0, x0 + lengthPx]) {
      context.moveTo(x, y0 - 5)
      context.lineTo(x, y0 + 5)
    }
    context.strokeStyle = TEXT
    context.lineWidth = 2
    context.stroke()
    const fontSize = Math.max(TEXT_FONT_SIZE, MIN_TEXT_SIZE * this.cssPixel)
    context.font = `${fontSize}px ${TEXT_FONT_FAMILY}`
    context.fillStyle = TEXT
    context.textAlign = 'center'
    context.textBaseline = 'bottom'
    context.fillText(`${length} m`, x0 + lengthPx / 2, y0 - 8)
  }

  /** Large text centered across the canvas, its top at `top`. */
  private drawTitle(text: string, top: number, color: string): void {
    const context = this.context
    context.font = TITLE_FONT
    context.fillStyle = color
    context.textAlign = 'center'
    context.textBaseline = 'top'
    context.fillText(text, WIDTH / 2, top)
  }
}

/** A triangle starting at the nozzle (base `width` wide) pointing along `direction`. */
function flameTriangle(origin: Vector, direction: Vector, length: number, width: number): Vector[] {
  const across = { x: (-direction.y * width) / 2, y: (direction.x * width) / 2 } // half the base
  return [
    { x: origin.x + across.x, y: origin.y + across.y },
    { x: origin.x - across.x, y: origin.y - across.y },
    { x: origin.x + direction.x * length, y: origin.y + direction.y * length },
  ]
}
