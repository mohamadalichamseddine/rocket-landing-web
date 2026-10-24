"""Export what the web page needs from deep-rl-flight-control, and Python's results for its checks.

It runs in the source project's environment, without changing that project:

    uv run --frozen --project C:\\Users\\moham\\Documents\\deep-rl-flight-control python export/export_for_web.py

It writes:
- public/network/network_weights.json: the trained network the page flies with
- public/data/rocket_settings.json: the rocket spec and the environment settings
- tests/data/python_results.json: what Python computed, for the checks
"""

import json
import math
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Any

from rocketlander.config_files import CONFIGS, ENV_CONFIG_FILE, ROCKET_SPEC_FILE
from rocketlander.environment.env_config import EnvConfig, StartRanges, build_env_config
from rocketlander.environment.observation import observation_to_state
from rocketlander.environment.outcome import Outcome
from rocketlander.environment.rocket_landing_env import RocketLandingEnv
from rocketlander.evaluation.evaluation import seed_for_test_episode
from rocketlander.ppo.network_controller import OBSERVATION_SCALE, NetworkController
from rocketlander.rocket.rocket_simulator import RocketSimulator
from rocketlander.rocket.rocket_spec import RocketSpec, build_rocket_spec
from rocketlander.rocket.rocket_state import RocketState

NETWORK_FILE = CONFIGS.parent / "networks" / "landing_network.zip"
WEB_REPO = Path(__file__).resolve().parents[1]

TEST_EPISODES_PER_LEVEL = 2  # test episodes 0 and 1 of each level are flown
TEST_SET_SIZE = 500  # test episodes per level, as in the source project's results
NETWORK_ACTION_EVERY = 250  # [steps]: one observation and its action every 5 s of flight


@dataclass(frozen=True)
class NetworkAction:
    """An observation seen in flight, in physical units, and the action the network chose."""

    observation: list[float]
    action: list[float]


@dataclass(frozen=True)
class NetworkFlight:
    """A flight flown by the network in Python."""

    name: str
    start: RocketState
    outcome: Outcome
    steps: int
    end_state: RocketState  # after a touchdown: the state just before contact
    touchdown_parts: list[str] | None  # what touched the ground; None if nothing did
    network_actions: list[NetworkAction]


@dataclass(frozen=True)
class ThrottleSegment:
    steps: int
    throttles: tuple[float, ...]  # one per nozzle: main, left, right


@dataclass(frozen=True)
class FixedThrottleFlight:
    """A flight with fixed throttles and no network: it checks the physics alone."""

    start: RocketState
    segments: list[ThrottleSegment]
    states: list[RocketState]  # after each step


def main() -> None:
    rocket_spec = build_rocket_spec(ROCKET_SPEC_FILE)
    env_config = build_env_config(ENV_CONFIG_FILE)
    network_controller = NetworkController(NETWORK_FILE)
    rocket_simulator = RocketSimulator(
        rocket_spec, gravity=env_config.gravity, dt=env_config.dt, substeps=env_config.substeps
    )
    envs = [
        RocketLandingEnv(rocket_spec, env_config, level=level, render_mode=None)
        for level in range(len(env_config.levels))
    ]

    default_start = middle_of(env_config.levels[0])
    network_flights = [fly_network(envs[0], network_controller, "default start", default_start)]
    for env in envs:
        for episode in range(TEST_EPISODES_PER_LEVEL):
            network_flights.append(fly_test_episode(env, network_controller, episode))
    # The network lands nearly every start, so a failure has to be looked for.
    network_flights.append(first_failure(envs[-1], network_controller))
    for network_flight in network_flights:
        print(f"{network_flight.name}: {network_flight.outcome} after {network_flight.steps} steps")

    write_json(
        WEB_REPO / "public" / "network" / "network_weights.json",
        network_weights(network_controller),
    )
    write_json(
        WEB_REPO / "public" / "data" / "rocket_settings.json",
        rocket_settings(rocket_spec, env_config),
    )
    write_json(
        WEB_REPO / "tests" / "data" / "python_results.json",
        {
            "box2d_rocket": {
                "mass": rocket_simulator.mass,
                "center_of_mass_height": rocket_simulator.center_of_mass_height,
                "moment_of_inertia": rocket_simulator.moment_of_inertia,
            },
            "network_flights": [asdict(network_flight) for network_flight in network_flights],
            "fixed_throttle_flight": asdict(fly_fixed_throttles(rocket_simulator)),
        },
    )


def network_weights(network_controller: NetworkController) -> dict[str, Any]:
    """The actor's two hidden layers, SB3's output layer, and the observation scale.

    PyTorch stores each weight matrix as [outputs, inputs].
    """
    state_dict = network_controller.ppo.policy.state_dict()

    def layer(name: str) -> dict[str, Any]:
        return {
            "weight": state_dict[f"{name}.weight"].tolist(),
            "bias": state_dict[f"{name}.bias"].tolist(),
        }

    return {
        "observation_scale": OBSERVATION_SCALE.tolist(),
        "hidden_1": layer("mlp_extractor.actor.0"),
        "hidden_2": layer("mlp_extractor.actor.2"),
        "output": layer("action_net"),
    }


def rocket_settings(rocket_spec: RocketSpec, env_config: EnvConfig) -> dict[str, Any]:
    """The rocket spec and the environment settings, as Python built them from the YAML files.

    The reward settings are left out: the page doesn't use them.
    """
    env_settings = {key: value for key, value in asdict(env_config).items() if key != "reward"}
    return {"rocket_spec": asdict(rocket_spec), "env_config": env_settings}


def middle_of(start_ranges: StartRanges) -> RocketState:
    """The start in the middle of each of a level's ranges."""

    def middle(bounds: tuple[float, float]) -> float:
        return (bounds[0] + bounds[1]) / 2

    return RocketState(
        x=middle(start_ranges.x),
        y=middle(start_ranges.altitude),
        vx=middle(start_ranges.vx),
        vy=middle(start_ranges.vy),
        tilt=math.radians(middle(start_ranges.tilt_deg)),
        spin=math.radians(middle(start_ranges.spin_deg_s)),
    )


def fly_test_episode(
    env: RocketLandingEnv, network_controller: NetworkController, episode: int
) -> NetworkFlight:
    """Fly one of the level's test episodes, from the start the evaluation draws for it.

    The start is read back from the first observation (32-bit floats), so the saved start is
    exactly the one flown.
    """
    observation, _ = env.reset(seed=seed_for_test_episode(episode))
    start = observation_to_state(observation)
    name = f"level {env.level}, test episode {episode}"
    return fly_network(env, network_controller, name, start)


def first_failure(env: RocketLandingEnv, network_controller: NetworkController) -> NetworkFlight:
    """The first of the level's test episodes, after the ones already flown, that doesn't land."""
    for episode in range(TEST_EPISODES_PER_LEVEL, TEST_SET_SIZE):
        network_flight = fly_test_episode(env, network_controller, episode)
        if network_flight.outcome != Outcome.LANDED:
            return network_flight
    raise RuntimeError(f"the network landed every level-{env.level} test episode")


def fly_network(
    env: RocketLandingEnv, network_controller: NetworkController, name: str, start: RocketState
) -> NetworkFlight:
    """Fly the network from ``start`` until the flight ends."""
    observation, _ = env.reset(options={"state": start})
    network_actions = []
    steps, done = 0, False
    while not done:
        action = network_controller.act(observation)
        if steps % NETWORK_ACTION_EVERY == 0:
            network_actions.append(NetworkAction(observation.tolist(), action.tolist()))
        observation, _, terminated, truncated, info = env.step(action)
        steps += 1
        done = terminated or truncated
    touchdown = info["touchdown"]
    return NetworkFlight(
        name=name,
        start=start,
        outcome=info["outcome"],
        steps=steps,
        end_state=touchdown.state if touchdown else env.rocket_simulator.state(),
        touchdown_parts=sorted(touchdown.parts) if touchdown else None,
        network_actions=network_actions,
    )


def fly_fixed_throttles(rocket_simulator: RocketSimulator) -> FixedThrottleFlight:
    """Free fall, braking, hovering, and drifting sideways by tilting, well above the ground.

    The same sequence as the source project's scripts/rocket/scripted_flight.py.
    """
    main_nozzle = rocket_simulator.rocket_spec.get_nozzle("main")
    hover = rocket_simulator.mass * rocket_simulator.gravity / main_nozzle.max_thrust
    # (duration [s], throttles [main, left, right])
    timed_throttles = [
        (1.0, (0.0, 0.0, 0.0)),  # free fall
        (1.0, (1.0, 0.0, 0.0)),  # full thrust: brake
        (2.0, (hover, 0.0, 0.0)),  # hover
        (0.5, (hover, 1.0, 0.0)),  # left nozzle: start tilting right
        (0.5, (hover, 0.0, 1.0)),  # right nozzle: stop the rotation
        (3.0, (hover, 0.0, 0.0)),  # tilted: drift right
        (0.5, (hover, 0.0, 1.0)),  # right nozzle: start tilting back
        (0.5, (hover, 1.0, 0.0)),  # left nozzle: stop upright
        (2.0, (hover, 0.0, 0.0)),  # hover, coasting right
    ]
    segments = [
        ThrottleSegment(steps=round(duration / rocket_simulator.dt), throttles=throttles)
        for duration, throttles in timed_throttles
    ]
    start = RocketState(x=0.0, y=50.0, vx=0.0, vy=0.0, tilt=0.0, spin=0.0)
    rocket_simulator.reset(start)
    states = []
    for segment in segments:
        for _ in range(segment.steps):
            states.append(rocket_simulator.step(segment.throttles))
    return FixedThrottleFlight(start=start, segments=segments, states=states)


def write_json(path: Path, data: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")
    print(f"wrote {path.relative_to(WEB_REPO).as_posix()}")


if __name__ == "__main__":
    main()
