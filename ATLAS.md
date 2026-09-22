# Two skies, one journey

Choose **Explore both systems** to leave the close-range observatory. The **Route chart** selects destinations within the current system. Choose **Set course: wormhole**, wait for arrival, then **Enter wormhole**. The sphere connects Gargantua to the neighborhood of Saturn, and can be crossed in either direction. You can also pilot directly into it. **Black hole observatory** returns to the original experience.

## Worlds and controls

The atlas includes Gargantua, Miller, Mann, Edmunds, the Sun, all eight solar planets, Earth's Moon, four illustrative Jovian moons, Saturn/Uranus rings, and asteroid/Kuiper-style debris belts. Earth uses locally bundled surface/cloud maps; other worlds use original procedural materials. Sun granulation, planetary rotation, orbiting moons, atmospheres, and a procedural bridge passage are animated.

**Orbit** circles the selected body; **Pilot ship** uses WASD/QE and Shift boost. Scroll/pinch works in orbit. On mobile use Forward/Reverse and drag to steer. **Space / Pause** stops animation and programmed travel; manual flight remains available. **H** hides the interface; Escape or Show controls restores it. **F** toggles fullscreen. Sound and image export are in the atlas toolbar. Tab opens the route chart from the flight canvas; native modal keyboard navigation works within the chart.

## Scale and physical limits

Solar orbital periods have approximate real relative ratios, accelerated so an Earth orbit takes 40 minutes. Orbits are circular/coplanar and the initial arrangement is artistic, not today's ephemeris. Planet sizes, spacings, moons and black-hole scale are independently compressed for exploration. The atlas radius readout refers to each displayed body's radius, not a uniform kilometer scale. Flight is bounded outside the planets; landings and ground-level terrain are not modeled.

Miller/Mann/Edmunds positions, dimensions, environments and orbital periods are speculative. Miller's seven-years-per-hour figure is labeled as a film reference, not derived from this model. The wormhole uses an artistic refractive sphere and animated passage, not a general-relativistic wormhole solution or a live rendered view of the destination. Gargantua's background uses the existing light-bending shader; foreground planet meshes are not themselves relativistically lensed. This is an explorable cinematic reconstruction, not an N-body, climate, or GR research simulator.

## Sources and implementation

- Solar facts: [NASA planet overview](https://science.nasa.gov/solar-system/planets/).
- Fictional destination context: [Interstellar synopsis](https://en.wikipedia.org/wiki/Interstellar_(film)).
- Locally bundled Earth textures from Three.js examples: [surface](https://threejs.org/examples/textures/planets/earth_atmos_2048.jpg), [clouds](https://threejs.org/examples/textures/planets/earth_clouds_1024.png). No film imagery or soundtrack is bundled.
- Code: `src/atlas.ts`, `src/atlas.css`, `src/shaders/world.frag`.
- Read-only `window.interstellar` reports sector, destination, flight/travel/crossing state, simulation time, camera position, available worlds, and portal distance.
