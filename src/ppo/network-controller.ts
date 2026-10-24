// The network trained with PPO (Proximal Policy Optimization) as a controller.

import type { NetworkWeightsJson } from '../data-files.ts'
import { RocketNetwork } from './rocket-network.ts'

/**
 * The trained network flying the rocket: physical observation in, action out.
 *
 * Gives the network's best action (SB3's `predict(..., deterministic=True)`), without the
 * random exploration noise of training, so the same start always gives the same flight.
 */
export class NetworkController {
  private readonly rocketNetwork: RocketNetwork
  private readonly observationScale: readonly number[]

  constructor(rocketNetwork: RocketNetwork, observationScale: readonly number[]) {
    this.rocketNetwork = rocketNetwork
    this.observationScale = observationScale
  }

  /** The action for an observation in physical units: one value in [-1, 1] per nozzle. */
  act(observation: readonly number[]): number[] {
    // The network was trained on inputs of about -1 to 1: each is divided by a typical size.
    const scaledObservation = observation.map((value, i) => value / this.observationScale[i])
    // SB3 clips the network's output to the action range.
    return this.rocketNetwork
      .forward(scaledObservation)
      .map((value) => Math.min(Math.max(value, -1), 1))
  }
}

/** Build the controller from the contents of public/network/network_weights.json. */
export function buildNetworkController(networkWeightsJson: NetworkWeightsJson): NetworkController {
  const rocketNetwork = new RocketNetwork(
    networkWeightsJson.hidden_1,
    networkWeightsJson.hidden_2,
    networkWeightsJson.output,
  )
  return new NetworkController(rocketNetwork, networkWeightsJson.observation_scale)
}
