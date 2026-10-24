// Settings of the landing environment, read from public/data/rocket_settings.json.

import type { RocketSettingsJson } from '../data-files.ts'

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

export interface EnvConfig {
  readonly gravity: number // [m/s²]
  readonly dt: number // control step [s]
  readonly substeps: number // planck steps per control step
  readonly landing: LandingCriteria
  readonly limits: FlightLimits
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
  }
}
