import { describe, expect, it } from 'vitest'
import networkWeights from '../../public/network/network_weights.json'
import rocketSettings from '../../public/data/rocket_settings.json'
import { buildEnvConfig } from '../../src/environment/env-config.ts'
import {
  buildRocketLandingEnv,
  type StepResult,
} from '../../src/environment/rocket-landing-env.ts'
import { buildNetworkController } from '../../src/ppo/network-controller.ts'
import { buildRocketSpec } from '../../src/rocket/rocket-spec.ts'
import pythonResults from '../data/python_results.json'
import { largestDifference } from '../largest-difference.ts'

describe('RocketLandingEnv', () => {
  const rocketLandingEnv = buildRocketLandingEnv(
    buildRocketSpec(rocketSettings.rocket_spec),
    buildEnvConfig(rocketSettings.env_config),
  )
  const networkController = buildNetworkController(networkWeights)

  it.each(pythonResults.network_flights)('flies "$name" as Python does', (networkFlight) => {
    let observation = rocketLandingEnv.reset(networkFlight.start)
    let stepResult: StepResult
    let steps = 0
    do {
      stepResult = rocketLandingEnv.step(networkController.act(observation))
      observation = stepResult.observation
      steps += 1
    } while (stepResult.outcome === null)

    const touchdown = stepResult.touchdown
    expect(stepResult.outcome).toBe(networkFlight.outcome)
    expect(steps).toBe(networkFlight.steps)
    expect(touchdown === null ? null : [...touchdown.parts].sort()).toEqual(
      networkFlight.touchdown_parts,
    )
    // After a touchdown: the state just before contact; otherwise the final state.
    const endState = touchdown === null ? rocketLandingEnv.rocketSimulator.state() : touchdown.state
    // Python's Box2D computes in 32-bit floats. Seen: about 1e-6 for the landings, which the
    // network steers back on course, and 3e-4 for the fast crash.
    expect(largestDifference(endState, networkFlight.end_state)).toBeLessThan(1e-3)
  })
})
