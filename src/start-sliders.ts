// The sliders that choose where the next flight starts.

import { degrees, radians } from './angles.ts'
import type { Range, StartRanges } from './environment/env-config.ts'
import type { RocketState } from './rocket/rocket-state.ts'

/** One slider: what it sets, within which range, and where it starts. */
interface SliderSpec {
  readonly label: string
  readonly note: string // what its sign means
  readonly unit: string // with its leading space, if any
  readonly range: Range
  readonly step: number
  readonly decimals: number // shown
  readonly value: number
}

/** Chooses the start of the next flight with sliders, in an element of the page it fills. */
export class StartSliders {
  private readonly altitude: HTMLInputElement
  private readonly x: HTMLInputElement
  private readonly vx: HTMLInputElement
  private readonly vy: HTMLInputElement
  private readonly tiltDeg: HTMLInputElement
  private readonly spinDegS: HTMLInputElement

  /**
   * Sliders over `startRanges`, set to `defaultStart`; `onChange` is called when one moves.
   */
  constructor(
    startSlidersElement: HTMLElement,
    startRanges: StartRanges,
    defaultStart: RocketState,
    onChange: () => void,
  ) {
    this.altitude = appendSlider(startSlidersElement, {
      label: 'Altitude',
      note: 'above the ground',
      unit: ' m',
      range: startRanges.altitude,
      step: 1,
      decimals: 0,
      value: defaultStart.y,
    })
    this.x = appendSlider(startSlidersElement, {
      label: 'Distance from the pad (x)',
      note: 'minus = left of the pad',
      unit: ' m',
      range: startRanges.x,
      step: 0.5,
      decimals: 1,
      value: defaultStart.x,
    })
    this.vx = appendSlider(startSlidersElement, {
      label: 'Horizontal speed (vx)',
      note: 'minus = moving left',
      unit: ' m/s',
      range: startRanges.vx,
      step: 0.1,
      decimals: 1,
      value: defaultStart.vx,
    })
    this.vy = appendSlider(startSlidersElement, {
      label: 'Vertical speed (vy)',
      note: 'always falling',
      unit: ' m/s',
      range: startRanges.vy,
      step: 0.5,
      decimals: 1,
      value: defaultStart.vy,
    })
    this.tiltDeg = appendSlider(startSlidersElement, {
      label: 'Tilt',
      note: 'plus = nose to the left',
      unit: '°',
      range: startRanges.tiltDeg,
      step: 0.5,
      decimals: 1,
      value: degrees(defaultStart.tilt),
    })
    this.spinDegS = appendSlider(startSlidersElement, {
      label: 'Spin',
      note: 'plus = turning left',
      unit: '°/s',
      range: startRanges.spinDegS,
      step: 0.5,
      decimals: 1,
      value: degrees(defaultStart.spin),
    })
    startSlidersElement.addEventListener('input', onChange)
  }

  /** The start the sliders are set to. */
  start(): RocketState {
    return {
      x: this.x.valueAsNumber,
      y: this.altitude.valueAsNumber,
      vx: this.vx.valueAsNumber,
      vy: this.vy.valueAsNumber,
      tilt: radians(this.tiltDeg.valueAsNumber),
      spin: radians(this.spinDegS.valueAsNumber),
    }
  }
}

/** A labeled slider with its value and note; gives the slider. */
function appendSlider(parent: HTMLElement, sliderSpec: SliderSpec): HTMLInputElement {
  const label = document.createElement('label')
  label.className = 'start-slider'
  const name = document.createElement('span')
  name.className = 'slider-name'
  name.textContent = sliderSpec.label
  const value = document.createElement('output')
  value.className = 'value'
  const slider = document.createElement('input')
  slider.type = 'range'
  slider.min = String(sliderSpec.range[0])
  slider.max = String(sliderSpec.range[1])
  slider.step = String(sliderSpec.step)
  slider.value = String(sliderSpec.value)
  const note = document.createElement('span')
  note.className = 'note'
  note.textContent = sliderSpec.note
  label.append(name, value, slider, note)
  parent.append(label)

  const showValue = () => {
    value.textContent = `${slider.valueAsNumber.toFixed(sliderSpec.decimals)}${sliderSpec.unit}`
  }
  showValue()
  slider.addEventListener('input', showValue)
  return slider
}
