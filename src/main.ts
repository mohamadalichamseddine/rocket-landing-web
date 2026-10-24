// The page: loads the settings and the network, shows the rocket at the chosen start, and flies
// it, by the network or by hand.

import './style.css'
import { fetchNetworkWeights, fetchRocketSettings } from './data-files.ts'
import { buildEnvConfig, middleOf } from './environment/env-config.ts'
import { buildRocketLandingEnv } from './environment/rocket-landing-env.ts'
import { FlightLoop } from './flight-loop.ts'
import { KeyboardControls } from './keyboard-controls.ts'
import { buildNetworkController } from './ppo/network-controller.ts'
import { buildRocketSpec } from './rocket/rocket-spec.ts'
import { StartSliders } from './start-sliders.ts'
import { EnvironmentRenderer } from './visualization/environment-renderer.ts'
import { StatusPanel } from './visualization/status-panel.ts'

const [rocketSettingsJson, networkWeightsJson] = await Promise.all([
  fetchRocketSettings(),
  fetchNetworkWeights(),
])
const rocketSpec = buildRocketSpec(rocketSettingsJson.rocket_spec)
const envConfig = buildEnvConfig(rocketSettingsJson.env_config)
const rocketLandingEnv = buildRocketLandingEnv(rocketSpec, envConfig)
const networkController = buildNetworkController(networkWeightsJson)

const canvas = pageElement('scene', HTMLCanvasElement)
const letNetworkFlyButton = pageElement('let-network-fly', HTMLButtonElement)
const flyYourselfButton = pageElement('fly-yourself', HTMLButtonElement)
const flyYourselfHint = pageElement('fly-yourself-hint', HTMLElement)
const environmentRenderer = new EnvironmentRenderer(canvas)
const statusPanel = new StatusPanel(
  pageElement('status-panel', HTMLElement),
  rocketSpec.nozzles.map((nozzle) => nozzle.name),
)
const flightLoop = new FlightLoop(rocketLandingEnv, environmentRenderer, statusPanel)
const keyboardControls = new KeyboardControls(window)
// The sliders cover level 1, which contains level 0: every start they allow is one the network
// trained on. They start in the middle of level 0, the easiest.
const startSliders = new StartSliders(
  pageElement('start-sliders', HTMLElement),
  envConfig.levels[1],
  middleOf(envConfig.levels[0]),
  () => {
    // A new start stops the flight on screen and shows the rocket there.
    keyboardControls.disable()
    flightLoop.showStart(startSliders.start(), null)
  },
)

flightLoop.showStart(startSliders.start(), null)
new ResizeObserver(() => {
  environmentRenderer.resize()
  flightLoop.draw()
}).observe(canvas)

// A phone or tablet: its main pointer is a finger, and it has no arrow keys.
if (matchMedia('(pointer: coarse)').matches) {
  flyYourselfButton.disabled = true
  flyYourselfHint.textContent = 'Flying it yourself needs a keyboard.'
}

letNetworkFlyButton.addEventListener('click', () => {
  keyboardControls.disable()
  flightLoop.fly(
    startSliders.start(),
    (observation) => networkController.act(observation),
    () => {},
  )
})

flyYourselfButton.addEventListener('click', () => {
  const start = startSliders.start()
  // As in the Python window, the rocket waits at the start until Space is pressed.
  flightLoop.showStart(start, 'Press Space to start')
  keyboardControls.enable(() =>
    flightLoop.fly(
      start,
      () => keyboardControls.action(),
      () => keyboardControls.disable(),
    ),
  )
})

/** The element of the page with this id, which must be of this type. */
function pageElement<T extends HTMLElement>(id: string, type: new () => T): T {
  const element = document.getElementById(id)
  if (!(element instanceof type)) {
    throw new Error(`the page has no ${type.name} with id "${id}"`)
  }
  return element
}
