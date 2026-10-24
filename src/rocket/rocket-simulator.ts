// Rocket motion, computed by the planck.js physics engine (a JavaScript rewrite of Box2D).
//
// The rocket is given to planck as shapes with masses. planck then calculates the center of mass
// and moment of inertia, turns each nozzle's force (applied where the nozzle is mounted) into
// pushing and turning, adds gravity, moves the rocket, and detects when it touches the ground.

import { Box, Polygon, World, type Body, type Contact, type Fixture } from 'planck'
import type { Leg, RocketSpec, Vector } from './rocket-spec.ts'
import type { RocketState } from './rocket-state.ts'

// Constraint-solver iterations, used when parts touch the ground.
const VELOCITY_ITERATIONS = 8
const POSITION_ITERATIONS = 3

const GROUND_HALF_WIDTH = 1000 // [m]
const LEG_THICKNESS = 0.04 // [m]

/** A part of the rocket; the value is its planck fixture's name. */
export enum RocketPart {
  BODY = 'body',
  ENGINE_BLOCK = 'engine block',
  LEG = 'leg',
}

/** The rocket's first contact with the ground. */
export interface Touchdown {
  readonly state: RocketState // just before the contact, before planck's contact forces act
  readonly parts: ReadonlySet<RocketPart> // what touched the ground
}

/** One of planck's shapes on the rocket. */
export interface RocketShape {
  readonly rocketPart: RocketPart
  readonly corners: readonly Vector[] // in world coordinates [m]
}

/**
 * Moves the rocket under gravity and nozzle thrust above flat ground at y = 0, using planck.
 *
 * Each `step` holds the throttle commands for one control step of `dt` seconds, split into
 * `substeps` smaller planck steps for accuracy.
 *
 * Safety cut-off: once the rocket has touched the ground, the engines are off, whatever
 * throttles are commanded.
 */
export class RocketSimulator {
  readonly rocketSpec: RocketSpec
  readonly gravity: number
  readonly dt: number
  private readonly substeps: number
  private world: World
  private planckRocket: Body
  private readonly groundContacts = new Set<RocketPart>() // the parts that have touched the ground
  private firstTouchdown: Touchdown | null = null

  constructor(rocketSpec: RocketSpec, gravity: number, dt: number, substeps: number) {
    if (substeps < 1) {
      throw new Error(`substeps must be >= 1, got ${substeps}`)
    }
    this.rocketSpec = rocketSpec
    this.gravity = gravity
    this.dt = dt
    this.substeps = substeps
    this.world = this.createWorld()
    this.planckRocket = createPlanckRocket(this.world, rocketSpec)
  }

  /** Total mass [kg], as calculated by planck. */
  get mass(): number {
    return this.planckRocket.getMass()
  }

  /** Height of the center of mass above the base [m], as calculated by planck. */
  get centerOfMassHeight(): number {
    return this.planckRocket.getLocalCenter().y
  }

  /** Moment of inertia about the center of mass [kg·m²], as calculated by planck. */
  get momentOfInertia(): number {
    // planck, like Box2D, gives it about the rocket's origin (the base); move it to the center
    // of mass.
    const planckRocket = this.planckRocket
    const centerOfMassDistanceSquared = planckRocket.getLocalCenter().lengthSquared()
    return planckRocket.getInertia() - planckRocket.getMass() * centerOfMassDistanceSquared
  }

  /** The first ground contact of this flight, or null if the rocket hasn't touched the ground. */
  get touchdown(): Touchdown | null {
    return this.firstTouchdown
  }

  /**
   * Place the rocket in the given state, in a fresh world.
   *
   * Rebuilding the world clears contacts left over from the previous flight, so the same
   * starting state always produces the same flight.
   */
  reset(state: RocketState): void {
    this.world = this.createWorld()
    this.planckRocket = createPlanckRocket(this.world, this.rocketSpec)
    this.groundContacts.clear()
    this.firstTouchdown = null
    const planckRocket = this.planckRocket
    planckRocket.setAngle(state.tilt)
    // The state gives the center of mass, but planck places the rocket by its origin.
    const centerOfMassOffset = planckRocket.getWorldVector(planckRocket.getLocalCenter())
    planckRocket.setPosition({
      x: state.x - centerOfMassOffset.x,
      y: state.y - centerOfMassOffset.y,
    })
    // planck's velocity is the center of mass's.
    planckRocket.setLinearVelocity({ x: state.vx, y: state.vy })
    planckRocket.setAngularVelocity(state.spin)
  }

  /**
   * Fire the nozzles at `throttles` (one per nozzle, in [0, 1]) for `dt` seconds.
   *
   * Throttles outside [0, 1] are clipped, as a real actuator saturates.
   */
  step(throttles: readonly number[]): RocketState {
    const nozzles = this.rocketSpec.nozzles
    if (throttles.length !== nozzles.length) {
      throw new Error(`expected ${nozzles.length} throttles, got ${throttles.length}`)
    }
    const nozzleForces = nozzles.map((nozzle, i) => {
      const thrust = Math.min(Math.max(throttles[i], 0), 1) * nozzle.maxThrust
      const force: Vector = { x: nozzle.direction.x * thrust, y: nozzle.direction.y * thrust }
      return { force, position: nozzle.position }
    })

    const planckRocket = this.planckRocket
    const substepDt = this.dt / this.substeps
    for (let substep = 0; substep < this.substeps; substep++) {
      const stateBefore = this.state()
      if (this.firstTouchdown === null) {
        // planck clears applied forces after every step, so they are applied again each
        // substep, where the nozzle is now and in the direction it now points.
        for (const { force, position } of nozzleForces) {
          planckRocket.applyForce(
            planckRocket.getWorldVector(force),
            planckRocket.getWorldPoint(position),
            true,
          )
        }
      }
      this.world.step(substepDt, VELOCITY_ITERATIONS, POSITION_ITERATIONS)
      if (this.firstTouchdown === null && this.groundContacts.size > 0) {
        this.firstTouchdown = { state: stateBefore, parts: new Set(this.groundContacts) }
      }
    }
    return this.state()
  }

  /** The rocket's current state. */
  state(): RocketState {
    const planckRocket = this.planckRocket
    const center = planckRocket.getWorldCenter()
    const velocity = planckRocket.getLinearVelocity()
    const angle = planckRocket.getAngle() // planck angles are not wrapped
    return {
      x: center.x,
      y: center.y,
      vx: velocity.x,
      vy: velocity.y,
      tilt: angle - 2 * Math.PI * Math.round(angle / (2 * Math.PI)),
      spin: planckRocket.getAngularVelocity(),
    }
  }

  /** Each of planck's shapes on the rocket, in the order they were added. */
  shapes(): RocketShape[] {
    const planckRocket = this.planckRocket
    const rocketShapes: RocketShape[] = []
    // planck lists the newest fixture first: adding each one to the front restores the order
    // they were added in, so the engine block is drawn over the body.
    let fixture = planckRocket.getFixtureList()
    while (fixture !== null) {
      const polygon = fixture.getShape()
      const rocketPart = rocketPartOf(fixture)
      // Every fixture on the rocket is a named polygon; the check tells TypeScript so.
      if (polygon instanceof Polygon && rocketPart !== undefined) {
        const corners = polygon.m_vertices.map((vertex) => planckRocket.getWorldPoint(vertex))
        rocketShapes.unshift({ rocketPart, corners })
      }
      fixture = fixture.getNext()
    }
    return rocketShapes
  }

  /** A point in rocket coordinates (e.g. a nozzle position), in world coordinates [m]. */
  pointToWorld(point: Vector): Vector {
    return this.planckRocket.getWorldPoint(point)
  }

  /** A direction in rocket coordinates (e.g. a nozzle's), in world coordinates. */
  directionToWorld(direction: Vector): Vector {
    return this.planckRocket.getWorldVector(direction)
  }

  /** A fresh world with gravity and the ground, which tells which rocket parts touch the ground. */
  private createWorld(): World {
    const world = new World({ gravity: { x: 0, y: -this.gravity }, allowSleep: false })
    world.on('begin-contact', (contact) => this.recordGroundContact(contact))
    const ground = world.createBody()
    ground.createFixture({ shape: new Box(GROUND_HALF_WIDTH, 1, { x: 0, y: -1 }, 0) })
    return world
  }

  /** planck calls this when two fixtures start touching. */
  private recordGroundContact(contact: Contact): void {
    // The ground and the rocket are the only bodies, so every contact is between the ground
    // and a rocket part. The ground's fixture has no name.
    for (const fixture of [contact.getFixtureA(), contact.getFixtureB()]) {
      const rocketPart = rocketPartOf(fixture)
      if (rocketPart !== undefined) {
        this.groundContacts.add(rocketPart)
      }
    }
  }
}

/** The rocket part a fixture is, from its name; undefined for the ground. */
function rocketPartOf(fixture: Fixture): RocketPart | undefined {
  return Object.values(RocketPart).find((rocketPart) => rocketPart === fixture.getUserData())
}

/** The rocket as a planck body, with its origin at the center of the base. */
function createPlanckRocket(world: World, rocketSpec: RocketSpec): Body {
  // The planck rocket's origin is the center of the rocket's base, the same origin the
  // RocketSpec uses, so its positions can be given to planck as they are.
  const planckRocket = world.createDynamicBody({ position: { x: 0, y: 0 } })
  const { body, engineBlock } = rocketSpec
  addBlock(planckRocket, RocketPart.BODY, body.width, body.height, body.mass)
  addBlock(planckRocket, RocketPart.ENGINE_BLOCK, body.width, engineBlock.height, engineBlock.mass)
  for (const leg of rocketSpec.legs) {
    addLeg(planckRocket, leg)
  }
  return planckRocket
}

/** Give planck a rectangle standing on the base, centered on the axis, with this mass. */
function addBlock(
  planckRocket: Body,
  rocketPart: RocketPart,
  width: number,
  height: number,
  mass: number,
): void {
  planckRocket.createFixture({
    shape: new Box(width / 2, height / 2, { x: 0, y: height / 2 }, 0),
    density: mass / (width * height), // in 2D, planck's density is mass per area
    userData: rocketPart,
  })
}

/** Give planck a thin, massless strut from the leg's top to its tip. */
function addLeg(planckRocket: Body, leg: Leg): void {
  const { top, tip } = leg
  const halfThickness = LEG_THICKNESS / 2
  planckRocket.createFixture({
    shape: new Polygon([
      { x: top.x - halfThickness, y: top.y },
      { x: top.x + halfThickness, y: top.y },
      { x: tip.x + halfThickness, y: tip.y },
      { x: tip.x - halfThickness, y: tip.y },
    ]),
    density: 0, // the legs' mass is part of the engine block
    userData: RocketPart.LEG,
  })
}
