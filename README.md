# Rocket Landing Controller with Deep Reinforcement Learning

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

Every 0.02 s, the page reads the rocket's state, the network (a small forward pass in
TypeScript, 8 → 64 → 64 → 3) sets the three nozzle throttles, and planck.js (a JavaScript
Box2D) moves the rocket. In "Fly it yourself", your arrow keys replace the network. The code
is a copy of the Python project, with the same class names, and `tests/` checks it against
results saved from Python.

## Project layout

- `src/rocket/`, `src/environment/`, `src/ppo/`: the copies of the Python rocket, environment
  and network.
- `src/visualization/`: the drawing on the canvas, and the panel with the flight numbers.
- `src/main.ts`, `src/flight-loop.ts`, `src/start-sliders.ts`, `src/keyboard-controls.ts`: the
  page.
- `tests/`: the checks.
- `export/`: the export script (see below).

## Development

Needs Node.js 24 or newer.

```sh
npm ci          # install the exact versions listed in package-lock.json
npm run dev     # serve the page at http://localhost:5173, reloaded on every change
npm test        # run the checks
npm run build   # build the finished site into dist/
```

The site is deployed to Firebase Hosting by GitHub Actions: each pull request gets a preview
link, and each merge to `main` updates the live site. To deploy by hand:

```sh
npm install -g firebase-tools   # the Firebase CLI
firebase login
npm run build
firebase deploy --only hosting  # uploads dist/ to the project in .firebaserc
```

## Re-export the data

When the network is retrained or the rocket or environment settings change, clone
deep-rl-flight-control next to this repo, then run this from this repo's folder:

```sh
uv run --frozen --project ../deep-rl-flight-control python export/export_for_web.py
npm test
```
