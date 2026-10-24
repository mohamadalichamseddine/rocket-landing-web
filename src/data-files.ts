// The data files that export/export_for_web.py writes, as the types of their contents.
// The types are read from the files themselves, so they always match what the export wrote.

import type networkWeightsJson from '../public/network/network_weights.json'
import type rocketSettingsJson from '../public/data/rocket_settings.json'

/** The trained network's layers and the observation scale. */
export type NetworkWeightsJson = typeof networkWeightsJson

/** The rocket spec and the environment settings, as Python built them from the YAML files. */
export type RocketSettingsJson = typeof rocketSettingsJson

/** Download the rocket settings file, which is served next to the page. */
export function fetchRocketSettings(): Promise<RocketSettingsJson> {
  return fetchJson('data/rocket_settings.json')
}

/** Download the network weights file, which is served next to the page. */
export function fetchNetworkWeights(): Promise<NetworkWeightsJson> {
  return fetchJson('network/network_weights.json')
}

/** Download a JSON file served next to the page, at this path. */
async function fetchJson(path: string) {
  const response = await fetch(`${import.meta.env.BASE_URL}${path}`)
  if (!response.ok) {
    throw new Error(`could not load ${path}: ${response.status} ${response.statusText}`)
  }
  return response.json()
}
