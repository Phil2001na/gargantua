# Two skies, one journey

Choose **Explore both systems** to take command of the Endurance, parked beyond the wormhole near Saturn. Fly into the sphere yourself, or press **Autopilot: wormhole** (G). There is no cut or loading screen: the ship flies through the throat, and the other system is what the light already shows. The **Route chart** (Tab) sends the autopilot to any world in your current system. **Black hole observatory** returns to the original experience.

## Worlds and controls

The atlas includes Gargantua, Miller, Mann, Edmunds, the Sun, all eight solar planets, Earth's Moon, four illustrative Jovian moons, Saturn/Uranus rings, and asteroid/Kuiper-style debris belts. Earth uses locally bundled surface/cloud maps; other worlds use original procedural materials. Sun granulation, planetary rotation, orbiting moons, atmospheres, and a procedural bridge passage are animated.

Flight: **W/S** main drive, **A/D** yaw, **R/F** pitch, **Q/E** roll, drag to steer, **Shift** boost, **X** brake. The ship keeps its momentum; a flight-assist trims sideways drift, and speed is automatically limited near worlds and inside the bridge. **Arrow keys** move the camera independently of the ship (the chase camera swings around it; aboard you turn your head), even during autopilot; **V** recentres. **C** cycles chase, hull and cockpit cameras; scroll zooms the chase camera. **Orbit** circles the selected body. On mobile use Thrust/Reverse/Brake and drag to steer. **Space / Pause** stops animation and programmed travel; manual flight remains available. **H** hides the interface; Escape or Show controls restores it. **Enter** toggles fullscreen. **M** toggles sound. Sound and image export are in the atlas toolbar. Tab opens the route chart from the flight canvas; native modal keyboard navigation works within the chart.

## Scale and physical limits

Solar orbital periods have approximate real relative ratios, accelerated so an Earth orbit takes 40 minutes. Orbits are circular/coplanar and the initial arrangement is artistic, not today's ephemeris. Planet sizes, spacings, moons and black-hole scale are independently compressed for exploration. The atlas radius readout refers to each displayed body's radius, not a uniform kilometer scale. Flight is bounded outside the planets; landings and ground-level terrain are not modeled.

Miller/Mann/Edmunds positions, dimensions, environments and orbital periods are speculative. Miller's seven-years-per-hour figure is labeled as a film reference, not derived from this model. Gargantua's background uses the existing light-bending shader; foreground planet meshes are not themselves relativistically lensed. This is an explorable cinematic reconstruction, not an N-body, climate, or GR research simulator.

## The wormhole

The wormhole is ray-traced through the metric the film's visual-effects team published (James, von Tunzelmann, Franklin & Thorne, *Visualizing Interstellar's Wormhole*, Am. J. Phys. 83, 486, 2015): a cylindrical throat of radius ρ and length 2a whose walls flare out with lensing length M. Each pixel's light ray is integrated along its null geodesic. Rays that pass through the throat show the other system; rays that turn back show our own sky, bent into an Einstein ring around the sphere. Here ρ = 2.5 units (about 36 Endurance diameters), a = 0.7ρ and M = 0.22ρ. Beyond 2.6ρ the flare is blended smoothly into flat space by 5.5ρ, so the ray-traced region joins the ordinary scene without a seam (a departure from the paper, whose lensing extends indefinitely).

The Endurance and its cameras move in the same wormhole coordinates, so the crossing is continuous rather than a cut. Each side's worlds are captured into environment maps every frame: one at the camera and one at the matching point beyond the throat. The ray tracer samples these, and stars are generated per pixel from each ray's final direction. Ship motion near the throat uses the metric's radial coordinate but is flown with thrusters; it is not a free-fall geodesic. Tidal forces, time dilation in the bridge and the paper's exact camera speeds are not modelled.

## Sources and implementation

- Solar facts: [NASA planet overview](https://science.nasa.gov/solar-system/planets/).
- Fictional destination context: [Interstellar synopsis](https://en.wikipedia.org/wiki/Interstellar_(film)).
- Locally bundled Earth textures from Three.js examples: [surface](https://threejs.org/examples/textures/planets/earth_atmos_2048.jpg), [clouds](https://threejs.org/examples/textures/planets/earth_clouds_1024.png). No film imagery or soundtrack is bundled.
- Code: `src/atlas.ts` (flight, cameras, capture), `src/wormhole.ts` (metric and crossing), `src/shaders/lens.frag` (wormhole ray tracer), `src/shaders/stars.glsl` (procedural sky), `src/endurance.ts` (ship model), `src/atlas.css`, `src/shaders/world.frag`.
- Read-only `window.interstellar` reports camera and ship side, autopilot, wormhole coordinate, crossings, speed, view, positions, frame rate and capture size.
