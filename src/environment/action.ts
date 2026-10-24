// What a controller gives the environment: the action, and the throttles it means.

/** An action, one value in [-1, 1] per nozzle, as throttles in [0, 1]. */
export function actionToThrottles(action: readonly number[]): number[] {
  return action.map((value) => (Math.min(Math.max(value, -1), 1) + 1) / 2)
}
