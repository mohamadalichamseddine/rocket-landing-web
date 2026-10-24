// Degrees for people, radians for the physics.

/** An angle given in degrees, in radians. */
export function radians(angleDeg: number): number {
  return (angleDeg * Math.PI) / 180
}

/** An angle given in radians, in degrees. */
export function degrees(angle: number): number {
  return (angle * 180) / Math.PI
}
