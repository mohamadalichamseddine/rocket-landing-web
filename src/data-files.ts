// The data files that export/export_for_web.py writes, as the types of their contents.
// The types are read from the files themselves, so they always match what the export wrote.

import type networkWeightsJson from '../public/network/network_weights.json'
import type rocketSettingsJson from '../public/data/rocket_settings.json'

/** The trained network's layers and the observation scale. */
export type NetworkWeightsJson = typeof networkWeightsJson

/** The rocket spec and the environment settings, as Python built them from the YAML files. */
export type RocketSettingsJson = typeof rocketSettingsJson
