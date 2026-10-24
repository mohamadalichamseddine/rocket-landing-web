// Judging how a flight ends: a safe landing, an unsafe touchdown, or another ending.

import { RocketPart, type Touchdown } from '../rocket/rocket-simulator.ts'
import type { RocketState } from '../rocket/rocket-state.ts'
import type { FlightLimits, LandingCriteria } from './env-config.ts'
import { Outcome } from './outcome.ts'

/** One limit a safe landing must stay within, and the touchdown's value for it. */
export interface LandingCheck {
  readonly name: string
  readonly value: number
  readonly limit: number
  readonly unit: string
}

/** Decides after each step whether the flight ends, and how. */
export class LandingJudge {
  private readonly landingCriteria: LandingCriteria
  private readonly flightLimits: FlightLimits
  private readonly maxSteps: number

  constructor(landingCriteria: LandingCriteria, flightLimits: FlightLimits, maxSteps: number) {
    this.landingCriteria = landingCriteria
    this.flightLimits = flightLimits
    this.maxSteps = maxSteps
  }

  /** How the flight ends after `steps` steps, or null if it goes on. */
  outcome(state: RocketState, touchdown: Touchdown | null, steps: number): Outcome | null {
    if (touchdown !== null) {
      const safe =
        partsOtherThanLegs(touchdown).size === 0 && this.failedChecks(touchdown).length === 0
      return safe ? Outcome.LANDED : Outcome.UNSAFE_TOUCHDOWN
    }
    const limits = this.flightLimits
    if (Math.abs(state.tilt) > radians(limits.maxTiltDeg)) {
      return Outcome.LOST_CONTROL
    }
    if (Math.abs(state.x) > limits.maxX || state.y > limits.maxAltitude) {
      return Outcome.OUT_OF_BOUNDS
    }
    if (steps >= this.maxSteps) {
      return Outcome.TIME_LIMIT
    }
    return null
  }

  /** The landing checks the touchdown went past. */
  failedChecks(touchdown: Touchdown): LandingCheck[] {
    return this.landingChecks(touchdown).filter((check) => check.value > check.limit)
  }

  /** Each limit a safe landing must stay within, with the touchdown's value. */
  private landingChecks(touchdown: Touchdown): LandingCheck[] {
    const criteria = this.landingCriteria
    const contact = touchdown.state
    return [
      { name: 'off center', value: Math.abs(contact.x), limit: criteria.maxOffCenter, unit: 'm' },
      { name: 'horizontal speed', value: Math.abs(contact.vx), limit: criteria.maxVx, unit: 'm/s' },
      { name: 'vertical speed', value: Math.abs(contact.vy), limit: criteria.maxVy, unit: 'm/s' },
      {
        name: 'tilt',
        value: degrees(Math.abs(contact.tilt)),
        limit: criteria.maxTiltDeg,
        unit: 'deg',
      },
      {
        name: 'spin',
        value: degrees(Math.abs(contact.spin)),
        limit: criteria.maxSpinDegS,
        unit: 'deg/s',
      },
    ]
  }
}

/** The rocket parts besides the legs that touched the ground, e.g. {body}. */
export function partsOtherThanLegs(touchdown: Touchdown): ReadonlySet<RocketPart> {
  return new Set([...touchdown.parts].filter((part) => part !== RocketPart.LEG))
}

function radians(angleDeg: number): number {
  return (angleDeg * Math.PI) / 180
}

function degrees(angle: number): number {
  return (angle * 180) / Math.PI
}
