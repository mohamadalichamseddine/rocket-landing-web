// Flying the rocket by hand with the keyboard, as in the Python
// scripts/environment/fly_manually.py.

/** The keys a manual flight uses, by their `KeyboardEvent.code`. */
enum Key {
  SPACE = 'Space',
  UP = 'ArrowUp',
  DOWN = 'ArrowDown',
  LEFT = 'ArrowLeft',
  RIGHT = 'ArrowRight',
}

/**
 * The keyboard during a manual flight: Space starts, pauses and resumes it; Up fires the main
 * engine, Right the left nozzle (it pushes right), Left the right nozzle (it pushes left), and
 * the engines are off when nothing is held.
 *
 * While enabled, Space and the arrow keys only fly the rocket: they don't scroll the page,
 * press the focused button or move a slider.
 */
export class KeyboardControls {
  private readonly heldKeys = new Set<Key>()
  private onSpace: (() => void) | null = null // enabled while not null

  constructor(window: Window) {
    // Listening as the event comes down from the window, before the focused element sees it.
    window.addEventListener('keydown', (event) => this.keyDown(event), { capture: true })
    window.addEventListener('keyup', (event) => this.keyUp(event), { capture: true })
    // A key released while the page isn't focused sends no keyup.
    window.addEventListener('blur', () => this.heldKeys.clear())
  }

  /** Take Space and the arrow keys from the page; `onSpace` is called at each Space press. */
  enable(onSpace: () => void): void {
    this.onSpace = onSpace
  }

  /** Give Space and the arrow keys back to the page. */
  disable(): void {
    this.onSpace = null
    this.heldKeys.clear()
  }

  /** The action for the keys held: per nozzle, 1 (full throttle) if its key is held, else -1. */
  action(): number[] {
    // In the order of the nozzles: main, left, right.
    return [Key.UP, Key.RIGHT, Key.LEFT].map((key) => (this.heldKeys.has(key) ? 1 : -1))
  }

  private keyDown(event: KeyboardEvent): void {
    const key = keyOf(event)
    if (this.onSpace === null || key === undefined) {
      return
    }
    event.preventDefault()
    this.heldKeys.add(key)
    if (key === Key.SPACE && !event.repeat) {
      this.onSpace()
    }
  }

  private keyUp(event: KeyboardEvent): void {
    const key = keyOf(event)
    if (this.onSpace === null || key === undefined) {
      return
    }
    event.preventDefault()
    this.heldKeys.delete(key)
  }
}

/** The key pressed or released, if it is one the flight uses. */
function keyOf(event: KeyboardEvent): Key | undefined {
  return Object.values(Key).find((key) => key === event.code)
}
