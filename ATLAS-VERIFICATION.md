# Atlas verification — 2026-09-06 23:44 (Africa/Windhoek)

Tested locally in Chromium at http://127.0.0.1:5178. Final `npm run build` passed TypeScript and Vite compilation (23 modules). Vite retains a non-fatal large-chunk warning: approximately 589 kB uncompressed / 153 kB gzip.

| Requirement | Observed evidence |
| --- | --- |
| Connected systems | Autopilot approached the sphere and crossed from Gargantua to the solar sector near Saturn. Repeated successfully on the production build. |
| Reversible wormhole | Manually piloted forward into the solar-side sphere; crossing state activated and returned to Gargantua. The reverse autopilot route also worked. |
| Gargantua destinations | Route-chart journeys completed to Miller, Mann, Edmunds and Gargantua. Existing light-bending shader renders the wider black-hole background. |
| Solar destinations | Visited Sun, Mercury, Venus, Earth, Mars, Jupiter, Saturn, Uranus and Neptune through the chart across development/production checks. Sun, Earth and mobile Saturn screenshots visually inspected after final rendering changes. |
| Sun and Earth detail | Inspected Sun's procedural granular surface and soft corona; Earth's continents, clouds, atmospheric limb and textured Moon. Saved artifacts/atlas-sun.png and artifacts/atlas-earth.png. |
| Pause | Simulation time before/after a 1.2-second pause was identical. Manual flight remained usable. |
| Mobile | At 390×844 no horizontal overflow; inspected Saturn/rings and readable controls. Real pointer-down/up on Forward succeeded. Earlier synthetic events with nonexistent pointer IDs caused a test-harness-only capture error; final real-pointer run had no error. |
| Interface | Route chart selection, hide/Show controls, cinematic-quality selection and return to original observatory exercised. Original Begin approach still activated the voyage after exit. |
| Export and sound | PNG download event received. Final sound test waited for Sound → Mute → Sound labels; underlying audio aria-pressed finished false. Listening quality was not independently audited. |
| Runtime | Final fresh production session reported zero console errors and zero shader errors. |

An initial production travel check timed out during a frame-rate drop. Exploration now adapts its render resolution and skips exterior drawing during bridge transit; subsequent crossing checks passed. Performance is hardware/load dependent; cinematic quality can be costly. No stable FPS guarantee is claimed.

Scope and approximations are documented in ATLAS.md and the interface. Worlds use compressed, nonuniform exploration scale and circular accelerated orbits; fictional planets and wormholes are artistic constructions. There is no surface-landing or precision GR/N-body claim.
