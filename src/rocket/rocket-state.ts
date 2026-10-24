/**
 * Where the rocket is and how it moves, in the world frame.
 *
 * World frame: x to the right, y up, ground at y = 0, landing pad centered at x = 0.
 * Angles are counterclockwise-positive (the same convention as planck and Box2D): tilt > 0
 * means the nose is tilted to the left (toward -x).
 */
export interface RocketState {
  readonly x: number // center of mass [m]
  readonly y: number // center of mass [m]
  readonly vx: number // [m/s]
  readonly vy: number // [m/s]
  readonly tilt: number // angle from vertical [rad], in [-π, π]
  readonly spin: number // how fast the tilt changes (angular velocity) [rad/s]
}
