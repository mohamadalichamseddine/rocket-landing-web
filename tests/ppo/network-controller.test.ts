import { describe, expect, it } from 'vitest'
import networkWeights from '../../public/network/network_weights.json'
import { buildNetworkController } from '../../src/ppo/network-controller.ts'
import pythonResults from '../data/python_results.json'

describe('NetworkController', () => {
  const networkController = buildNetworkController(networkWeights)
  const networkActions = pythonResults.network_flights.flatMap(
    (networkFlight) => networkFlight.network_actions,
  )

  it("gives SB3's action for the observations saved in Python", () => {
    for (const { observation, action } of networkActions) {
      const networkAction = networkController.act(observation)
      const differences = action.map((value, i) => Math.abs(networkAction[i] - value))
      expect(Math.max(...differences)).toBeLessThan(1e-5)
    }
  })
})
