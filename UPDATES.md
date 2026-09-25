# Project updates

## 2026-09-25
### 16:41
- Story mode Section 7 (work in progress), Chapter 7 "Miller": descent to the knee-deep ocean under Gargantua, wading to the wreck, the wave, the drained engines, and the 23 years of messages aboard the Endurance, with a Miller/Earth clock. Reuses the atlas's Miller ocean. The first half is tested; the rescue onward still needs a play-through.
### 14:11
- Atlas: a switchable cinematic wormhole (button or K, remembered). The film's look: a brighter crystal ball with a thin glowing Einstein ring, a passage of rushing light lanes inside the throat, a ripple as you pass the middle, harder buffeting, letterbox and a wider lens. It blends smoothly and shares the physical crossing, so switching mid-crossing is safe.
### 13:25
- Story mode Section 5, Chapter 5 "Liftoff": a launch pad 10 km west of the compound, a two-stage booster with the Ranger on top, and one unbroken climb to a 206 km orbit on the true-size Earth (countdown, smoke, max Q, staging, the sky going black), then docking with the Endurance by hand or by TARS.
- A ray-traced Earth with a single-scattering atmosphere behind the local map (`earth/globe.ts`, `earth/geo.ts`): the sky turns from dust to blue to black as you climb, the limb glows, and the farm country shows as fields from high up.
- After docking, the story hands over to the atlas near Earth (crossfade, matched horizon); from the atlas, "Land at the farm" (L) crossfades back into a Ranger descent you fly (or let TARS fly) from 120 km down to the yard.

## 2026-09-24
### 23:58
- Story mode Section 4, Chapter 4 "Don't Go": at dusk Cooper sits with Murph on her bed (a reply choice), she reveals the ghost's "STAY" as another book falls, and he gives her a watch set to the same second as his; a close-up of the two watches ticking, then he leaves hers on the bookshelf. Next morning, goodbyes to Donald and Tom, the drive out, Murph running onto the porch too late, and a mission-control countdown over the drive that cuts to black at liftoff.
- New: a reusable watch model (`earth/watch.ts`, for the tesseract), numbered reply choices in the UI, a scripted autopilot for the truck, and tick, radio-beep and launch-rumble sounds. Chapter 3 now continues into Chapter 4.
### 20:35
- Story mode Section 3, Chapter 3 "Coordinates": a night drive (headlights, stars, crickets) from the farm to a fenced compound 5.4 km north, with Murph revealed as a stowaway and an optional "an hour later" skip; a security drone with a searchlight that kills the truck at the gate; an interrogation room with TARS (four hinged slabs that walk), Brand and the Professor; a walk through a 60 m underground hall with a half-built station ring and a Ranger; and a hologram mission brief. Dialogue is original.
- Chapter 2 flows into Chapter 3; README and BUILD_PLAN updated (Sections 2 and 3 marked first-pass done).
### 20:02
- Story mode Section 2, Chapter 2 "The Ghost": Murph's room upstairs in the farmhouse (bookshelf, bed, desk, lander model, curtains, a working sash window) with a scripted book-falling "ghost"; a drive home racing a kilometre-high dust storm wall across the plains; dust pouring through the open window as a per-grain simulation that settles in bands; and a notebook puzzle that reads the bands as binary coordinates.
- World: time-of-day and weather moods (morning, evening, storm, night with stars), truck headlights that light the terrain and corn shaders, and a house shell with real window openings so sunlight enters rooms.
### 15:01
- Story mode, Sections 0 and 1 of `BUILD_PLAN.md`: a "Play from Earth" entry opens a chapter menu; Chapter 1 "The Dust" is playable. It has an opening flyover, walking from the porch to the truck, the drive, and a drone chase through true-scale corn to the reservoir cliff. It ends with a laptop link mini-game and a landing cutscene. Dialogue is original.
- Engine (`src/story/`): generator-based scripts, camera rails, subtitles, objectives, markers, fades, pause menu with checkpoints, hold-Space skip, pointer-lock input, synthesised sound (engine, gravel, corn, drone, birds), adaptive resolution and quality tiers.
- Earth (`src/story/earth/`): terrain, roads, corn layout and canyon, each written once in JS and once in GLSL; about 40k instanced corn plants that the truck flattens and pushes aside; a distance canopy; dust haze; curvature; farmhouse, barn, bins and windmill (merged draw calls); an arcade pickup truck and a 16 m solar drone. Measured at 18–33 ms per frame on Intel UHD.

### 13:31
- Added `BUILD_PLAN.md`: a sectioned plan for a playable story mode (farm and drone chase → NASA → seamless true-scale launch → cinematic wormhole toggle → Miller → Gargantua → tesseract → Cooper Station), to be built one section at a time.

## 2026-09-23
### 21:24
- Fixed the dark, misty sky around the wormhole mouth on Gargantua's side: its sky was a low-res cube copied twice, then magnified by the lens. The lens now takes only the diffuse glow from the cache and draws Gargantua's stars itself at screen resolution (weak-field bend).
- Lensed stars stay pixel-sharp points: sized in screen space through the local lens map, so magnified stars brighten instead of smearing into arcs, and squeezed ones dim. Lens output is NaN-guarded so a bad pixel can't blank the frame through the bloom.

### 20:41
- Rolled back all code to the originally published version (d7cf345): original wormhole metric and transit, original ship scale, planets and stars. The 17:03 and 20:17 changes below are reverted.

### 20:17
- Wormhole transit back to pure ray-traced optics: removed letterbox bars, radial smear, FOV change and extra bloom; the HUD now fades out fully during the passage. Long throat kept.
- Stars no longer vanish in the throat: lensed stars scale to each pixel's sky footprint, and Gargantua's stars seen through the wormhole are drawn per pixel (weak-field bend) instead of from a blurry cube map.
- Ship at true scale (64 m Endurance vs ~6,400 km Earth); boost is now typeable up to ×10,000 with speed shown in c when fast. Planets get pixel-adaptive detail: craters and relief on rocky worlds, Mars caps, turbulent gas-giant bands, Neptune's storm and cirrus, Earth city lights, ice/ocean/desert detail, sunspots.

### 17:03
- Longer, more cinematic wormhole transit: the throat is twice as long (2a = 3ρ, flare unchanged so the outside view is the same), traced exactly with an analytic jump through the cylinder, and the passage takes ~20 s with ~9 s gliding through the tunnel of ring images.
- Cinematic layer on the real optics: letterbox bars and dimmed HUD, a slow barrel roll levelled on the far side, FOV breathing, subtle radial smear/fringe/vignette and extra bloom. Buffeting now follows the curvature (peaks where the flare meets the throat, eerie calm inside), with phase readouts: entering, inside the throat, emerging.

### 14:28
- Published the project to GitHub and deployed the production Vite build to Vercel at https://gargantua-lilac.vercel.app.
- Added `.vercelignore` to exclude local build output, dependencies, and generated media from uploads.

### 10:46
- Rendered a 90-second 1080p trailer for Twitter (`artifacts/gargantua-trailer.mp4`, git-ignored): scripted flight through the observatory, Saturn's wormhole, the Gargantua flyby, Miller's wave, Mann's clouds and an end card. Frames were captured headless with a virtual clock; the soundtrack is an original organ score plus the app's engine and rumble layers, rendered offline.

### 01:58
- Ship at a truer scale: the Endurance is about 9x smaller, so worlds and the wormhole dwarf it. Boost is now adjustable (x2 to x250, default x10) with [ / ] or HUD buttons.
- Landing on Miller and Mann: dive into the atmosphere, press L, or use "Land on ..." in the route chart. The Ranger flies true-scale areas: Miller's shallow ocean with 1+ km tidal waves that lift you, plus an Earth-time clock; Mann's ice ridges under frozen clouds. Gargantua is ray-traced into both skies. Climb above 16 km or press L to return to orbit.
- Accretion disk is now a 3D volume: a flared, billowing slab with dust lanes and hot debris clumps, traced for emission and absorption (about +4 ms per frame in the observatory on Intel UHD).

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
