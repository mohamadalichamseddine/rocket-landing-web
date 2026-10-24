# Rocket landing

A web page where a neural network lands a 2D rocket on a pad, in your browser. You can also
fly the rocket yourself with the keyboard.

**Live: https://deep-rl-rocket-landing.web.app**

The network was trained in my project
[deep-rl-flight-control](https://github.com/mohamadalichamseddine/deep-rl-flight-control) with
PPO (Proximal Policy Optimization), a deep reinforcement learning algorithm, from
Stable-Baselines3 (SB3). That project holds the training, the evaluation and the results. This
repo is only the web page. Nothing runs on a server: the network and the physics both run in
the page.

## How the page flies

Every 0.02 s of flight (50 steps per second, in real time):

1. **The page reads the rocket's state** the way the network saw it in training:
   `[x, y, vx, vy, sin(tilt), cos(tilt), spin, mass]`. Each value is divided by a typical size,
   so it lies around -1 to 1.
2. **The network chooses the throttles.** This is a small forward pass in TypeScript, with no
   ML library: 8 inputs → 64 → 64 → 3 outputs, with tanh after each hidden layer. The weights
   come from a JSON file. There is one output per nozzle (the main engine and the left and
   right side nozzles). Each output is clipped to [-1, 1] and turned into a throttle from 0 to 1.
3. **The physics moves the rocket.** planck.js, a JavaScript rewrite of the Box2D physics
   engine, applies each nozzle's thrust where the nozzle is mounted, and gravity, in 5 smaller
   steps.
4. **The landing judge checks whether the flight is over:** landed, unsafe touchdown, lost
   control, out of bounds, or time limit.

With "Fly it yourself", your keys take the network's place in step 2: Up fires the main
engine, and Left and Right push the rocket sideways. Space starts the flight, then pauses and
resumes it.

The rocket, the environment and the network are copies of the Python ones. They keep the same
class names (`RocketSimulator`, `RocketLandingEnv`, `LandingJudge`, `NetworkController`, …), so
the two versions can be compared side by side. Python's Box2D computes with 32-bit numbers and
JavaScript with 64-bit ones, so the flights match closely, but not digit for digit. The checks
in `tests/` compare the copy with results saved from Python:

1. planck computes the same mass, center of mass and moment of inertia as Python's Box2D, and
   flies a flight with fixed throttles the same way.
2. The TypeScript forward pass gives the same actions as SB3.
3. From Python's starts, the network flying the TypeScript copy gets the same outcomes, with
   touchdowns close to Python's.

## Where things are

- `src/rocket/`, `src/environment/`, `src/ppo/`: the copies of the Python rocket, environment
  and network.
- `src/visualization/`: the drawing on the canvas, and the panel with the flight numbers.
- `src/main.ts`, `src/flight-loop.ts`, `src/start-sliders.ts`, `src/keyboard-controls.ts`: the
  page.
- `tests/`: the checks.
- `export/`: the export script (see below).

## Run it locally

You need Node.js 24 or newer.

```sh
npm ci          # install the exact versions listed in package-lock.json
npm run dev     # serve the page at http://localhost:5173, reloaded on every change
npm test        # run the checks
npm run build   # build the finished site into dist/
```

## Re-export the data

The page and the checks read three files, which `export/export_for_web.py` writes from
deep-rl-flight-control:

| File | What it holds |
|---|---|
| `public/network/network_weights.json` | the trained network's weights, and the observation scale |
| `public/data/rocket_settings.json` | the rocket and environment settings, as Python built them from its YAML files |
| `tests/data/python_results.json` | the results Python computed, for the checks |

Re-export them when the network is retrained or the rocket or environment settings change.
Clone deep-rl-flight-control next to this repo, then run this from this repo's folder:

```sh
uv run --frozen --project ../deep-rl-flight-control python export/export_for_web.py
```

The script runs in the main project's Python environment and doesn't change it. (`--frozen`
keeps uv from rewriting that project's `uv.lock`.) Then run `npm test`, and commit the three
files. Don't edit them by hand.

## Deploying

The site is a set of static files on Firebase Hosting, Google's hosting for web pages, on the
free Spark plan. `npm run build` builds the site into `dist/`, and Firebase uploads that folder.

Two GitHub Actions workflows deploy the site:

- **Each pull request gets its own preview link.** A bot posts the link as a comment on the
  pull request, and the link expires after 7 days.
  (`.github/workflows/firebase-hosting-pull-request.yml`)
- **Each merge to `main` updates the live site.** (`.github/workflows/firebase-hosting-merge.yml`)

Both workflows run `npm ci && npm test && npm run build` first, on Node.js 24, so a failing
check stops the deploy. They sign in to Firebase with a service account: a Google Cloud
account for programs, which is allowed to deploy. Its key is stored in this repo's GitHub
secret `FIREBASE_SERVICE_ACCOUNT_DEEP_RL_ROCKET_LANDING`.

Two files hold the Firebase settings:

- `firebase.json`: what to upload (`dist/`) and how to serve it.
- `.firebaserc`: which Firebase project to deploy to (`deep-rl-rocket-landing`).

You can also deploy from your own computer with the Firebase CLI
(`npm install -g firebase-tools`):

```sh
firebase login
npm run build
firebase deploy --only hosting
```
