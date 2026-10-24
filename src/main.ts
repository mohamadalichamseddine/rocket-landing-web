// The page: loads the settings, draws the rocket at its start, and flies it.

import './style.css'
import { fetchRocketSettings } from './data-files.ts'
import { buildEnvConfig, middleOf } from './environment/env-config.ts'
import { buildRocketLandingEnv } from './environment/rocket-landing-env.ts'
import { FlightLoop } from './flight-loop.ts'
import { KeyboardControls } from './keyboard-controls.ts'
import { buildRocketSpec } from './rocket/rocket-spec.ts'
import { EnvironmentRenderer } from './visualization/environment-renderer.ts'
import { StatusPanel } from './visualization/status-panel.ts'

const rocketSettingsJson = await fetchRocketSettings()
const rocketSpec = buildRocketSpec(rocketSettingsJson.rocket_spec)
const envConfig = buildEnvConfig(rocketSettingsJson.env_config)
const rocketLandingEnv = buildRocketLandingEnv(rocketSpec, envConfig)

const canvas = pageElement('scene', HTMLCanvasElement)
const flyYourselfButton = pageElement('fly-yourself', HTMLButtonElement)
const flyYourselfHint = pageElement('fly-yourself-hint', HTMLElement)
const environmentRenderer = new EnvironmentRenderer(canvas)
const statusPanel = new StatusPanel(
  pageElement('status-panel', HTMLElement),
  rocketSpec.nozzles.map((nozzle) => nozzle.name),
)
const flightLoop = new FlightLoop(rocketLandingEnv, environmentRenderer, statusPanel)
const keyboardControls = new KeyboardControls(window)

// Until there are sliders to choose it, the start is the middle of the easiest level.
const start = middleOf(envConfig.levels[0])
flightLoop.showStart(start, null)
new ResizeObserver(() => {
  environmentRenderer.resize()
  flightLoop.draw()
}).observe(canvas)

// A phone or tablet: its main pointer is a finger, and it has no arrow keys.
if (matchMedia('(pointer: coarse)').matches) {
  flyYourselfButton.disabled = true
  flyYourselfHint.textContent = 'Flying it yourself needs a keyboard.'
}

flyYourselfButton.addEventListener('click', () => {
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
