import { describe, expect, it } from 'vitest'
import rocketSettings from '../../public/data/rocket_settings.json'
import { buildEnvConfig } from '../../src/environment/env-config.ts'
import { buildRocketLandingEnv } from '../../src/environment/rocket-landing-env.ts'
import { buildRocketSpec } from '../../src/rocket/rocket-spec.ts'
import type { RocketState } from '../../src/rocket/rocket-state.ts'
import pythonResults from '../data/python_results.json'
import { largestDifference } from '../largest-difference.ts'

describe('RocketSimulator', () => {
  const rocketSimulator = buildRocketLandingEnv(
    buildRocketSpec(rocketSettings.rocket_spec),
    buildEnvConfig(rocketSettings.env_config),
  ).rocketSimulator

  it("computes the same mass, center of mass and moment of inertia as Python's Box2D", () => {
    // Box2D stores 32-bit floats, which keep about 7 digits: compare 6.
    const box2dRocket = pythonResults.box2d_rocket
    expect(rocketSimulator.mass / box2dRocket.mass).toBeCloseTo(1, 6)
    expect(rocketSimulator.centerOfMassHeight / box2dRocket.center_of_mass_height).toBeCloseTo(1, 6)
    expect(rocketSimulator.momentOfInertia / box2dRocket.moment_of_inertia).toBeCloseTo(1, 6)
  })

  it("flies the fixed-throttle flight as Python's Box2D does", () => {
    const fixedThrottleFlight = pythonResults.fixed_throttle_flight
    rocketSimulator.reset(fixedThrottleFlight.start)
    const states: RocketState[] = []
    for (const segment of fixedThrottleFlight.segments) {
      for (let step = 0; step < segment.steps; step++) {
        states.push(rocketSimulator.step(segment.throttles))
      }
    }

    expect(states).toHaveLength(fixedThrottleFlight.states.length)
    const differences = states.map((state, i) =>
      largestDifference(state, fixedThrottleFlight.states[i]),
    )
    // Python's Box2D computes in 32-bit floats, so the flights drift apart slowly over the
    // 11 s: seen, under 1e-3 (m, m/s, rad).
    expect(Math.max(...differences)).toBeLessThan(5e-3)
  })
})
