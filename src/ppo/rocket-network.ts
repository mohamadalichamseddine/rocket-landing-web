// The trained network's forward pass, from its weights. No ML library: it is small enough to
// compute by hand.
//
//     8 scaled observations ─► Linear → Tanh ─► Linear → Tanh ─► Linear ─► 3 actions
//                              hidden 1 (64)     hidden 2 (64)     output
//
// The two hidden layers are the actor of the Python RocketNetwork; the output layer is the
// one SB3 (Stable-Baselines3) adds. The critic is only used in training, so it isn't here.

/** One fully connected layer. `weight` is [outputs][inputs], as PyTorch stores it. */
export interface DenseLayer {
  readonly weight: readonly (readonly number[])[]
  readonly bias: readonly number[]
}

export class RocketNetwork {
  private readonly hidden1: DenseLayer
  private readonly hidden2: DenseLayer
  private readonly output: DenseLayer

  constructor(hidden1: DenseLayer, hidden2: DenseLayer, output: DenseLayer) {
    this.hidden1 = hidden1
    this.hidden2 = hidden2
    this.output = output
  }

  /** The network's output for scaled observations: one action per nozzle, not yet clipped. */
  forward(scaledObservation: readonly number[]): number[] {
    const hidden1 = linear(this.hidden1, scaledObservation).map(Math.tanh)
    const hidden2 = linear(this.hidden2, hidden1).map(Math.tanh)
    return linear(this.output, hidden2)
  }
}

/** W·x + b */
function linear(denseLayer: DenseLayer, input: readonly number[]): number[] {
  return denseLayer.weight.map((row, output) =>
    row.reduce((sum, weight, i) => sum + weight * input[i], denseLayer.bias[output]),
  )
}
