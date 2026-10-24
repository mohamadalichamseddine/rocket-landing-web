// What the environment shows a controller: the observation.

import type { RocketState } from '../rocket/rocket-state.ts'

/**
 * The observation `[x, y, vx, vy, sin(tilt), cos(tilt), spin, mass]`, in physical units.
 *
 * sin/cos avoids a jump when the tilt wraps around.
 */
export function stateToObservation(state: RocketState, mass: number): number[] {
  return [
    state.x,
    state.y,
    state.vx,
    state.vy,
    Math.sin(state.tilt),
    Math.cos(state.tilt),
    state.spin,
    mass,
  ]
}
