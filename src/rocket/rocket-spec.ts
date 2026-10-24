// The rocket's physical description, read from public/data/rocket_settings.json.
//
// Positions are in the rocket's own (body) frame, in meters: origin at the center of the base,
// +y up the rocket axis toward the nose, +x to the rocket's right when it stands upright.
// planck calculates the center of mass and moment of inertia from the shapes
// (see rocket-simulator.ts).

import type { RocketSettingsJson } from '../data-files.ts'

/** A point or a direction in the rocket's frame. */
export interface Vector {
  readonly x: number
  readonly y: number
}

/** The rocket body: a rectangle standing on the base, with its mass spread evenly. */
export interface Body {
  readonly height: number
  readonly width: number
  readonly mass: number
}

/** Engine and legs: extra mass filling the bottom `height` meters of the body. */
export interface EngineBlock {
  readonly height: number
  readonly mass: number
}

export interface Nozzle {
  readonly name: string
  readonly position: Vector
  readonly direction: Vector // unit vector: the way the force pushes the rocket
  readonly maxThrust: number // [N]
}

/** A massless strut from the side of the body (top) down to the tip that touches ground. */
export interface Leg {
  readonly top: Vector
  readonly tip: Vector
}

export interface RocketSpec {
  readonly body: Body
  readonly engineBlock: EngineBlock
  readonly nozzles: readonly Nozzle[] // order = order of the throttle commands
  readonly legs: readonly Leg[]
}

/** Build the rocket's description from the settings file's `rocket_spec`. */
export function buildRocketSpec(rocketSpecJson: RocketSettingsJson['rocket_spec']): RocketSpec {
  const body = rocketSpecJson.body
  const engineBlock = rocketSpecJson.engine_block
  return {
    body: { height: body.height, width: body.width, mass: body.mass },
    engineBlock: { height: engineBlock.height, mass: engineBlock.mass },
    nozzles: rocketSpecJson.nozzles.map((nozzle) => ({
      name: nozzle.name,
      position: toVector(nozzle.position),
      direction: toVector(nozzle.direction),
      maxThrust: nozzle.max_thrust,
    })),
    legs: rocketSpecJson.legs.map((leg) => ({ top: toVector(leg.top), tip: toVector(leg.tip) })),
  }
}

/** The file writes points and directions as [x, y]. */
function toVector(xy: readonly number[]): Vector {
  return { x: xy[0], y: xy[1] }
}
