// A flight on the page, in real time: 50 control steps per second, drawn at the screen's
// refresh rate.

import { describeFailures } from './environment/landing-judge.ts'
import type { Outcome } from './environment/outcome.ts'
import type { RocketLandingEnv, StepResult } from './environment/rocket-landing-env.ts'
import type { RocketState } from './rocket/rocket-state.ts'
import type { EnvironmentRenderer } from './visualization/environment-renderer.ts'
import type { StatusPanel } from './visualization/status-panel.ts'

// [s]: the longest time one frame may fly, so that after a pause (e.g. the browser tab was
// hidden) the flight goes on from where it was instead of jumping ahead.
const MAX_FRAME_TIME = 0.1

/** Flies the rocket and shows it: the scene on the canvas and the numbers in the panel. */
export class FlightLoop {
  private readonly rocketLandingEnv: RocketLandingEnv
  private readonly environmentRenderer: EnvironmentRenderer
  private readonly statusPanel: StatusPanel
  private observation: number[] = []
  private lastStep: StepResult | null = null // null before the first step
  private message: string | null = null
  private animationFrame: number | null = null // the next frame of the flight being flown

  constructor(
    rocketLandingEnv: RocketLandingEnv,
    environmentRenderer: EnvironmentRenderer,
    statusPanel: StatusPanel,
  ) {
    this.rocketLandingEnv = rocketLandingEnv
    this.environmentRenderer = environmentRenderer
    this.statusPanel = statusPanel
  }

  /** Stop any flight, and show the rocket at `start`, with `message` (if not null) over it. */
  showStart(start: RocketState, message: string | null): void {
    this.begin(start)
    this.message = message
    this.draw()
  }

  /**
   * Stop any flight, and fly from `start` in real time until the flight ends.
   *
   * `chooseAction` gives the action for each step's observation; `onFlightOver` is called
   * when the flight ends (not when it is stopped by another one).
   */
  fly(
    start: RocketState,
    chooseAction: (observation: readonly number[]) => number[],
    onFlightOver: (outcome: Outcome) => void,
  ): void {
    this.begin(start)
    this.message = null
    this.draw()
    const dt = this.rocketLandingEnv.rocketSimulator.dt
    let previousFrameTime: number | null = null // [ms]
    let timeToFly = 0 // [s] of real time not flown yet

    const flyFrame = (frameTime: number): void => {
      if (previousFrameTime !== null) {
        timeToFly += Math.min((frameTime - previousFrameTime) / 1000, MAX_FRAME_TIME)
      }
      previousFrameTime = frameTime
      let outcome: Outcome | null = null
      while (timeToFly >= dt && outcome === null) {
        this.lastStep = this.rocketLandingEnv.step(chooseAction(this.observation))
        this.observation = this.lastStep.observation
        outcome = this.lastStep.outcome
        timeToFly -= dt
      }
      this.draw()
      if (outcome === null) {
        this.animationFrame = requestAnimationFrame(flyFrame)
      } else {
        this.animationFrame = null
        onFlightOver(outcome)
      }
    }
    this.animationFrame = requestAnimationFrame(flyFrame)
  }

  /** Draw the current frame: the scene and the numbers (again, e.g. after a resize). */
  draw(): void {
    const rocketSimulator = this.rocketLandingEnv.rocketSimulator
    const touchdown = rocketSimulator.touchdown
    const lastStep = this.lastStep
    // After touchdown the engines are cut, and the numbers shown are those the landing was
    // judged on: the state just before contact, not after planck's contact forces.
    const throttles =
      lastStep === null || touchdown !== null
        ? rocketSimulator.rocketSpec.nozzles.map(() => 0)
        : lastStep.throttles
    const shownState = touchdown === null ? rocketSimulator.state() : touchdown.state
    const outcome = lastStep === null ? null : lastStep.outcome
    const failureReasons =
      lastStep === null ? [] : describeFailures(lastStep.touchdown, lastStep.failedChecks)

    this.environmentRenderer.draw(rocketSimulator, throttles, outcome, this.message)
    this.statusPanel.show(this.rocketLandingEnv.time, shownState, throttles, failureReasons)
  }

  private begin(start: RocketState): void {
    if (this.animationFrame !== null) {
      cancelAnimationFrame(this.animationFrame)
      this.animationFrame = null
    }
    this.observation = this.rocketLandingEnv.reset(start)
    this.lastStep = null
    this.environmentRenderer.startFlight()
  }
}
