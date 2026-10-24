// The landing environment: fly the rocket one control step at a time, toward the pad at x = 0.

import type { RocketSettingsJson } from '../data-files.ts'
import { RocketSimulator, type Touchdown } from '../rocket/rocket-simulator.ts'
import { buildRocketSpec } from '../rocket/rocket-spec.ts'
import type { RocketState } from '../rocket/rocket-state.ts'
import { actionToThrottles } from './action.ts'
import { buildEnvConfig } from './env-config.ts'
import { LandingJudge, type LandingCheck } from './landing-judge.ts'
import { stateToObservation } from './observation.ts'
import type { Outcome } from './outcome.ts'

/** What one step of a flight gives back. */
export interface StepResult {
  readonly observation: number[] // see stateToObservation
  readonly outcome: Outcome | null // null while the flight goes on
  readonly touchdown: Touchdown | null // null if the rocket hasn't touched the ground
  readonly failedChecks: readonly LandingCheck[] // the landing limits a touchdown went past
}

/**
 * Land the rocket on the pad at x = 0, as the Python environment does, without the reward.
 *
 * Observation, in physical units: `[x, y, vx, vy, sin(tilt), cos(tilt), spin, mass]`, where
 * (x, y) is the center of mass.
 *
 * Action: one value in [-1, 1] per nozzle (main, left, right), mapped to throttles in [0, 1].
 *
 * The flight ends at the first ground contact, judged as a safe landing or an unsafe
 * touchdown; when the rocket tilts past the limit; when it leaves the flight region; or at the
 * time limit, which stands in for running out of fuel (see `Outcome`).
 */
export class RocketLandingEnv {
  readonly rocketSimulator: RocketSimulator
  private readonly landingJudge: LandingJudge
  private steps = 0

  constructor(rocketSimulator: RocketSimulator, landingJudge: LandingJudge) {
    this.rocketSimulator = rocketSimulator
    this.landingJudge = landingJudge
  }

  /** Start a flight from `start`; gives the first observation. */
  reset(start: RocketState): number[] {
    this.rocketSimulator.reset(start)
    this.steps = 0
    return stateToObservation(start, this.rocketSimulator.mass)
  }

  /** Fly one control step with `action`. */
  step(action: readonly number[]): StepResult {
    const stateAfterStep = this.rocketSimulator.step(actionToThrottles(action))
    this.steps += 1

    const touchdown = this.rocketSimulator.touchdown
    // The flight ends at the moment of contact.
    const state = touchdown === null ? stateAfterStep : touchdown.state
    return {
      observation: stateToObservation(state, this.rocketSimulator.mass),
      outcome: this.landingJudge.outcome(state, touchdown, this.steps),
      touchdown,
      failedChecks: touchdown === null ? [] : this.landingJudge.failedChecks(touchdown),
    }
  }
}

/** Build the landing environment from the contents of public/data/rocket_settings.json. */
export function buildRocketLandingEnv(rocketSettingsJson: RocketSettingsJson): RocketLandingEnv {
  const rocketSpec = buildRocketSpec(rocketSettingsJson.rocket_spec)
  const envConfig = buildEnvConfig(rocketSettingsJson.env_config)
  const rocketSimulator = new RocketSimulator(
    rocketSpec,
    envConfig.gravity,
    envConfig.dt,
    envConfig.substeps,
  )
  const landingJudge = new LandingJudge(
    envConfig.landing,
    envConfig.limits,
    Math.round(envConfig.limits.timeLimit / envConfig.dt),
  )
  return new RocketLandingEnv(rocketSimulator, landingJudge)
}
