// The flight's numbers, in a panel beside the canvas (under it on narrow screens) so they stay
// readable on a phone: what the Python window's status panel shows, and why a touchdown was unsafe.

import { degrees } from '../angles.ts'
import type { RocketState } from '../rocket/rocket-state.ts'

/** One nozzle's row: its throttle as a bar and a percentage. */
interface ThrottleRow {
  readonly fill: HTMLElement
  readonly percent: HTMLElement
}

/** Shows the flight's numbers in an element of the page, which it fills. */
export class StatusPanel {
  private readonly timeValue: HTMLElement
  private readonly altitudeValue: HTMLElement
  private readonly xValue: HTMLElement
  private readonly vxValue: HTMLElement
  private readonly vyValue: HTMLElement
  private readonly tiltValue: HTMLElement
  private readonly spinValue: HTMLElement
  private readonly throttleRows: readonly ThrottleRow[]
  private readonly failureReasons: HTMLElement

  constructor(statusPanelElement: HTMLElement, nozzleNames: readonly string[]) {
    const flightNumbers = appendElement(statusPanelElement, 'dl', 'flight-numbers')
    this.timeValue = appendNumber(flightNumbers, 'time')
    this.altitudeValue = appendNumber(flightNumbers, 'altitude')
    this.xValue = appendNumber(flightNumbers, 'x')
    this.vxValue = appendNumber(flightNumbers, 'vx')
    this.vyValue = appendNumber(flightNumbers, 'vy')
    this.tiltValue = appendNumber(flightNumbers, 'tilt')
    this.spinValue = appendNumber(flightNumbers, 'spin')
    const throttles = appendElement(statusPanelElement, 'div', 'throttles')
    this.throttleRows = nozzleNames.map((nozzleName) => appendThrottleRow(throttles, nozzleName))
    this.failureReasons = appendElement(statusPanelElement, 'ul', 'failure-reasons')
  }

  /**
   * Show the flight at `time` seconds: the rocket's state, the throttles, and why the
   * touchdown was unsafe (one reason per line; none while flying or after a safe landing).
   */
  show(
    time: number,
    state: RocketState,
    throttles: readonly number[],
    failureReasons: readonly string[],
  ): void {
    this.timeValue.textContent = `${time.toFixed(2)} s`
    this.altitudeValue.textContent = `${state.y.toFixed(1)} m`
    this.xValue.textContent = `${state.x.toFixed(2)} m`
    this.vxValue.textContent = `${state.vx.toFixed(2)} m/s`
    this.vyValue.textContent = `${state.vy.toFixed(2)} m/s`
    this.tiltValue.textContent = `${degrees(state.tilt).toFixed(1)}°`
    this.spinValue.textContent = `${degrees(state.spin).toFixed(1)}°/s`
    for (const [i, throttleRow] of this.throttleRows.entries()) {
      const percent = `${(throttles[i] * 100).toFixed(0)}%`
      throttleRow.fill.style.width = percent
      throttleRow.percent.textContent = percent
    }
    this.failureReasons.replaceChildren(
      ...failureReasons.map((failureReason) => {
        const item = document.createElement('li')
        item.textContent = failureReason
        return item
      }),
    )
  }
}

function appendElement(parent: HTMLElement, tagName: string, className: string): HTMLElement {
  const element = document.createElement(tagName)
  element.className = className
  parent.append(element)
  return element
}

/** A labeled number in the list; gives the element that shows its value. */
function appendNumber(flightNumbers: HTMLElement, label: string): HTMLElement {
  const entry = appendElement(flightNumbers, 'div', 'flight-number')
  appendElement(entry, 'dt', 'label').textContent = label
  return appendElement(entry, 'dd', 'value')
}

function appendThrottleRow(throttles: HTMLElement, nozzleName: string): ThrottleRow {
  const row = appendElement(throttles, 'div', 'throttle')
  appendElement(row, 'span', 'label').textContent = nozzleName
  const bar = appendElement(row, 'div', 'throttle-bar')
  const fill = appendElement(bar, 'div', 'throttle-fill')
  return { fill, percent: appendElement(row, 'span', 'value') }
}
