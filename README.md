# Gargantua

An original, interactive black-hole experience inspired by Interstellar. Built with TypeScript, Three.js, GLSL, and Web Audio. All scene imagery is generated locally; there are no film assets or recordings.

## Run

Requires Node.js 22.12+ (tested with Node 24).

```sh
npm install
npm run dev -- --port 5177
```

Open http://127.0.0.1:5177. For a production build, run `npm run build`, followed by `npm run preview -- --port 5177`. The `dist` folder can be served on any static web host. No account, API key, or backend is needed. Fonts load from Google Fonts with local fallbacks.

## Story mode

**Play from Earth ▶** opens *Endurance*, a playable retelling built one chapter at a time (see [BUILD_PLAN.md](BUILD_PLAN.md)). Five chapters are playable. In *The Dust*, you chase a lost solar drone through true-scale corn to the reservoir and bring it down from the laptop. In *The Ghost*, books fall in Murph's room, you race a dust storm home, and the storm leaves bands of dust on her floor that you read as binary coordinates. In *Coordinates*, you drive at night to a fenced compound, get stopped at the gate, meet TARS, walk through the underground hall under a half-built station, and hear the mission brief. In *Don't Go*, you give Murph a watch the night before the launch, say goodbye in the morning, and drive away as the countdown begins. In *Liftoff*, you ride the rocket from the pad to orbit on the real-size Earth, dock with the Endurance, and can carry on into the atlas toward Saturn; near Earth in the atlas, **L** takes the Ranger back down to the farm. Controls: mouse to look (click to capture), **W A S D** to walk or drive, **Shift** to run, **Space** for the handbrake, **C** for the truck camera, **E** to interact, **N** for the notebook in chapter 2, **T** to skip ahead on chapter 3's long road, **1**/**2** to pick a reply, **[**/**]** for time warp in chapter 5, and hold **Space** to skip a cutscene. **Esc** pauses and gives access to checkpoints. Dialogue and characters are original, and no film assets are used.

## Explore

- **Begin approach / Voyage:** a 100-simulation-second guided journey from 21 to roughly 7.6 horizon radii. Scene time speed also changes the voyage speed.
- **Free flight:** drag or arrow keys to look (while flying); W/A/S/D to move; Q/E to descend/ascend; Shift to boost. Movement keys take over the voyage. Touch devices have equivalent buttons.
- **Orbit:** drag or arrow keys to circle; scroll or pinch to adjust distance.
- **Space:** pause disk time and voyage. Manual navigation remains available.
- **H:** hide the interface; **F:** fullscreen; **M:** ambient sound; **R:** restart; **?:** guide; **Escape:** close panels/show interface.
- **Scene settings:** exposure, disk glow, disk atmosphere, time speed, field of view, lensing, Doppler brightness, render quality, and four viewpoints.
- **Camera button:** download the current image without interface overlays.

## Rendering and physical scope

The expanded experience connects Gargantua and our solar system through a traversable wormhole, ray-traced from the film team's published metric. You fly an Endurance-inspired ship through it with no cut between systems. Press **K** (or the button in the bar) to switch the wormhole between the physical ray trace and a cinematic look closer to the film, with a glowing Einstein ring and a passage of light. Choose **Explore both systems** to begin. See [ATLAS.md](ATLAS.md) for destinations, controls, sources, and simulation limits.

The full-screen fragment shader numerically integrates curved light paths using a central inverse-fifth-power vector acceleration, `-1.5 h² p / |p|⁵`, in Schwarzschild-radius units. A midpoint integrator with adaptive spatial steps traces each pixel; crossing the equatorial plane samples a turbulent, differentially rotating accretion disk. Rays that approach the horizon are captured. Escaping rays sample a procedural celestial sphere: point stars are generated per pixel from the final ray direction (so they stay sharp and lens correctly) over a diffuse galactic band. Finite-height haze surrounds the disk. HDR bloom and ACES tone mapping produce the optical glow.

This is an **artistic real-time approximation**, not the film's Kerr ray-bundle renderer, a full GR solver, or a gas-dynamics simulation. Finite integration steps, a thin disk, heuristic Doppler brightness, and approximate opacity trade accuracy for interactivity. The cinematic resemblance does not imply film-level numerical fidelity.

The assumed mass is 100 million solar masses. One horizon radius is approximately 295.3 million km / 1.9741 AU. The displayed clock ratio is the stationary Schwarzschild estimate `1 / sqrt(1 - 1/r)`, relative to a distant observer. It excludes spin and velocity. Travel and animation are accelerated, and ambience is an optional artistic soundtrack, not sound propagating through a vacuum. Flight is bounded outside the horizon and within 120 radii; orbit spans 3.2–100 radii.

Reference: [James, von Tunzelmann, Franklin & Thorne, Gravitational Lensing by Spinning Black Holes in Astrophysics, and in the Movie Interstellar](https://arxiv.org/abs/1502.03808). Rendering API: [Three.js ShaderMaterial](https://threejs.org/docs/pages/ShaderMaterial.html).

## Performance and accessibility

WebGL 2 and browser graphics acceleration are required. Adaptive resolution adjusts to measured frame rate; Performance, High, and Ultra are available manually. The tab stops rendering and suspends sound when hidden. Sound requires a user gesture. Reduced-motion preferences pause the initial animation; pressing Begin explicitly starts the voyage. Controls have accessible names, keyboard focus states, touch alternatives, and a native modal guide. A WebGL failure provides a recovery message.

## Files

- `src/main.ts`: renderer, camera/navigation, UI, scene state
- `src/shaders/blackhole.frag`: gravitational lensing, disk emission, atmosphere
- `src/sky.ts`: deterministic sky texture
- `src/audio.ts`: original synthesized ambient drone
- `src/style.css`: responsive experience interface

Read-only browser diagnostics are available at `window.gargantua` (mode, camera position, time, voyage progress, rendering resolution, approximate FPS, shader error count).
