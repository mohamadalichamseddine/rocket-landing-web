// Settings of the landing environment, read from public/data/rocket_settings.json.

import { radians } from '../angles.ts'
import type { RocketSettingsJson } from '../data-files.ts'
import type { RocketState } from '../rocket/rocket-state.ts'

export type Range = readonly [number, number] // [min, max]

/** Limits a touchdown must stay within to count as a safe landing. */
export interface LandingCriteria {
  readonly maxOffCenter: number // distance from the pad center [m]
  readonly maxVx: number // [m/s]
  readonly maxVy: number // [m/s]
  readonly maxTiltDeg: number
  readonly maxSpinDegS: number
}

export interface FlightLimits {
  readonly maxX: number // [m]
  readonly maxAltitude: number // [m]
  readonly maxTiltDeg: number
  readonly timeLimit: number // [s]
}

/** Starting conditions for one difficulty level. */
export interface StartRanges {
  readonly altitude: Range // center of mass [m]
  readonly x: Range // [m]
  readonly vx: Range // [m/s]
  readonly vy: Range // [m/s]
  readonly tiltDeg: Range
  readonly spinDegS: Range
}

export interface EnvConfig {
  readonly gravity: number // [m/s²]
  readonly dt: number // control step [s]
  readonly substeps: number // planck steps per control step
  readonly landing: LandingCriteria
  readonly limits: FlightLimits
  readonly levels: readonly StartRanges[] // by difficulty, 0 = easiest
}

/** Build the environment settings from the settings file's `env_config`. */
export function buildEnvConfig(envConfigJson: RocketSettingsJson['env_config']): EnvConfig {
  const landing = envConfigJson.landing
  const limits = envConfigJson.limits
  return {
    gravity: envConfigJson.gravity,
    dt: envConfigJson.dt,
    substeps: envConfigJson.substeps,
    landing: {
      maxOffCenter: landing.max_off_center,
      maxVx: landing.max_vx,
      maxVy: landing.max_vy,
      maxTiltDeg: landing.max_tilt_deg,
      maxSpinDegS: landing.max_spin_deg_s,
    },
    limits: {
      maxX: limits.max_x,
      maxAltitude: limits.max_altitude,
      maxTiltDeg: limits.max_tilt_deg,
      timeLimit: limits.time_limit,
    },
    levels: envConfigJson.levels.map((level) => ({
      altitude: toRange(level.altitude),
      x: toRange(level.x),
      vx: toRange(level.vx),
      vy: toRange(level.vy),
      tiltDeg: toRange(level.tilt_deg),
      spinDegS: toRange(level.spin_deg_s),
    })),
  }
}

/** The start in the middle of each of a level's ranges. */
export function middleOf(startRanges: StartRanges): RocketState {
  const middle = (range: Range) => (range[0] + range[1]) / 2
  return {
    x: middle(startRanges.x),
    y: middle(startRanges.altitude),
    vx: middle(startRanges.vx),
    vy: middle(startRanges.vy),
    tilt: radians(middle(startRanges.tiltDeg)),
    spin: radians(middle(startRanges.spinDegS)),
  }
}

/** The file writes ranges as [min, max]. */
function toRange(minMax: readonly number[]): Range {
  return [minMax[0], minMax[1]]
}
