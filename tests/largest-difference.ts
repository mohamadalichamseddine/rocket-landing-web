import type { RocketState } from '../src/rocket/rocket-state.ts'

/** The largest difference between a state and Python's, over x, y, vx, vy, tilt and spin. */
export function largestDifference(state: RocketState, pythonState: RocketState): number {
  return Math.max(
    Math.abs(state.x - pythonState.x),
    Math.abs(state.y - pythonState.y),
    Math.abs(state.vx - pythonState.vx),
    Math.abs(state.vy - pythonState.vy),
    Math.abs(state.tilt - pythonState.tilt),
    Math.abs(state.spin - pythonState.spin),
  )
}
