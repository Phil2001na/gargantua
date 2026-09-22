# Project updates

## 2026-09-22
### 23:08
- Black hole observatory: arrow keys now look around in free flight and voyage (and circle the hole in orbit) while W/A/S/D fly, matching explore mode. Hints, guide and README updated.

### 22:58
- Explore mode: arrow keys now control the camera independently of the ship (chase camera orbits the Endurance, hull/cockpit views turn your head), so you can fly and look at once, even on autopilot; V recentres, switching views resets.
- Ship pitch moved from the arrows to R/F; atlas fullscreen moved from F to Enter.

### 22:43
- Fixed sound: the old mix sat below 150 Hz, which laptop speakers cannot play. New pad, wind, engine and wormhole layers sit around 100 Hz-2 kHz behind a limiter; M now toggles sound in explore mode too.
- Faster rendering on integrated GPUs (measured on Intel UHD, 1280x720 at 0.75 scale: start 12 ms, throat 17 ms, Gargantua side 8 ms per frame; Gargantua side was ~1 fps). Replaced 4x MSAA with FXAA except on Cinematic quality, cached Gargantua's ray-traced sky for wormhole captures (one cube face per frame), analytic light bending for rays that miss the disk, merged the ship into one draw call per material, and tuned the lens step and capture rates.
- Adaptive quality now targets 50+ fps: drops resolution quickly, climbs back only after a calm spell.

### 21:34
- Replaced the wormhole's refractive sphere and 2D tunnel cut with a per-pixel ray tracer through the Double Negative wormhole metric (James et al. 2015). The crossing is now continuous: ship and camera move in wormhole coordinates, and each side's worlds are captured into environment maps every frame.
- Added a flyable Endurance-inspired ship (12-module spinning ring, Ranger, landers) with inertial flight, flight assist, speed limits near bodies, chase/hull/cockpit cameras, and an autopilot that uses the same physics. Starts near Saturn with the lensed wormhole ahead; arrives facing Gargantua.
- Procedural per-pixel stars with a different sky on each side, smoother gas-giant shading (storm only on Jupiter), a Cassini division, MSAA, engine and wormhole-buffeting audio, and removed Gargantua's debris belt.

## 2026-09-06
### 23:44
- Final production build and regression checks passed, including asynchronous sound labels, image export, real pointer controls, and return to the original voyage. Recorded requirement-level evidence and performance limitations in ATLAS-VERIFICATION.md.

### 23:40
- Verified final cinematic Earth/Sun views, mobile Saturn framing, real pointer flight, image download, and zero shader errors. Corrected the atlas sound label to follow asynchronous audio activation.

### 23:29
- Production testing confirmed reversible wormhole passage, including manual entry, and pause behavior. Fixed exploration's missing adaptive-quality path after a low-frame-rate timeout.
- Added selectable cinematic/performance quality, improved mobile framing and Sun corona, and verified reachable solar/Lazarus destinations. Synthetic pointer-test errors were isolated to the test harness, not ordinary pointer input.

### 22:55
- Reused gravitational light bending in the wider Gargantua scene and added an animated wormhole passage; verified arrival near Saturn and destination travel.
- Added accelerated orbital motion and tracking, softer atmospheres/corona, textured moons, label occlusion, and mobile framing; documented scale, fictional assumptions, and source assets in ATLAS.md.

### 22:32
- Added a two-system exploration layer, destination chart, ship/orbit controls, and a reversible wormhole route near Saturn.
- Added the Sun, eight solar planets, Moon, major Jovian moons, debris belts, and speculative Miller, Mann, and Edmunds worlds; retained the original black hole observatory.
- Added local Earth surface/cloud textures and procedural planetary materials; exploration distances and fictional-world assumptions are labeled in the interface.

### 20:21
- Built and exercised the production app on port 5178. Verified image export, sound controls, fullscreen, reduced-motion behavior, adjustable rendering, lensing/disk image changes, and viewpoint transitions.
- Recorded browser evidence and limitations in VERIFICATION.md; saved a desktop screenshot under artifacts.

### 20:17
- Verified the complete approach, pause behavior, free-flight movement, orbit radius preservation, and overhead viewpoint in the browser.
- Added continuous camera handoff, clearer stellar dust, seamless turbulent disk detail, mobile-specific framing, and interface shading for readability against the bright disk.
- Added setup instructions and explicit physical-model limitations in README.md.

### 20:11
- Added voyage, orbit, and free-flight navigation, touch controls, scene settings, image export, original synthesized ambience, and a science/controls guide.
- Browser validation identified excessive bloom and a short-screen layout collision; reduced bloom and resized the opening typography. Corrected the horizon diameter to match the 100-million-solar-mass model.

### 17:04
- Created Gargantua as a standalone Three.js simulation with a custom gravitational-lensing renderer, cinematic voyage, and explorer controls.
- Established an unobtrusive observatory interface in ivory, muted amber, and deep blue-black; the black hole itself is the central visual.
