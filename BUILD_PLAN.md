# Interstellar story mode: build plan

A playable retelling of the film's main path. You press **Play** and start on Earth, then play through to Cooper Station. The current atlas and the black hole observatory stay available as free-play modes. We build it one section at a time, and each section should be playable when it's finished.

**Story path:** farm and drone chase → Murph's "ghost" → coordinates → drive to NASA → mission brief → "don't go" → goodbye → launch from a pad, with no cut into orbit → wormhole (the physical version we have now, plus a new cinematic version, switchable) → Miller → *(Mann is skipped)* → Gargantua → dive into the tesseract → return to the solar system → Cooper Station (an **O'Neill cylinder**, the rotating cylinder habitat near Saturn).

---

## Ground rules (apply to every section)

- **Original work, inspired by the film.** Same approach as the rest of the project: no film footage, audio, score or likenesses. Dialogue is **written fresh**, so we paraphrase the famous beats instead of copying the script ("Don't go" rather than full scene transcripts). Characters are stylised rather than actor lookalikes. Music stays our own synthesised organ score (`audio.ts`).
- **No loading screens once play begins.** Assets for the next chapter stream in during the current one. Fades are allowed only where the film itself cuts in time (for example the drive to NASA or the 23 years on Miller), never to hide a load.
- **Performance target:** 60 fps on a mid-range laptop and at least 30 fps on Intel UHD. Keep adaptive resolution. Every chapter gets a quality ladder.
- **Log every change in `UPDATES.md`.** Each section finishes with a playable build that is deployed to Vercel.

---

## Section 0: Story engine (foundation) ✅ done 2026-09-24

Everything after this depends on it. It's about a day of work.

- **Chapter state machine** (`src/story/`): chapters with `enter / update / exit`, checkpoints, and a chapter select after the first playthrough (saved in `localStorage`, and optional).
- **Title screen:** a **Play** button, plus the existing *Explore both systems* and *Black hole observatory* entries.
- **Player controllers** that swap in and out without a cut: **on foot** (first-person walk with head bob, collisions, interact prompt `E`), **vehicle** (pickup truck), **ship** (the existing Endurance and Ranger flight).
- **Cinematic camera:** spline camera rails, letterbox, handoff back to the player camera, and a skip button (hold `Space`).
- **Dialogue and subtitles:** timed lines, speaker names, and an optional choice prompt. Voice can come later. We start with subtitles and ambient sound.
- **Objectives HUD:** a small line of text such as "Follow the drone".
- **World frame system:** camera-relative rendering (a floating origin) and a logarithmic depth buffer. This is needed so a 1 m corn stalk and a 6,371 km Earth can share one scene. Plan it now even though the full use comes in Section 5.

**Done when:** Play → an empty test chapter → a cinematic → a dialogue line → the next chapter, all without reloading.

---

## Section 1: The farm and the drone chase ✅ first pass done 2026-09-24

**Experience:** dawn in the dust belt. You walk out of the farmhouse, get in the truck with the kids, and the drone passes overhead. You tear through the corn after it, reach the edge, and bring it down with the laptop.

**World (true scale, in metres):**
- **Terrain:** a flat Great-Plains height field about 20 × 20 km in full detail, with Earth's curvature applied so the horizon falls where it should. It fades into haze beyond that.
- **Corn fields:** GPU-instanced stalks with 3 LODs (mesh → cross-billboards → a textured field shader at distance), wind sway, and **trampling** where the truck drives (a flattening render target).
- **Farmhouse:** exterior (white clapboard, porch, a dusty pickup, the barn, water tower, silos) and an interior shell for Section 2. The interior is built now but only furnished in Section 2.
- **Atmosphere:** a dust-bowl sky, low-sun scattering, drifting dust particles and heat shimmer.
- **Dirt roads** linking the farm and fields. The road network is laid out for later chapters (see the map below).

**Gameplay:**
- **Truck:** arcade raycast vehicle physics (suspension, slide on dirt, cabin camera and chase camera), plus bumps and dust trails.
- **Drone:** a solar surveillance glider on a scripted path with some randomness. It stays just ahead of you, and a "signal range" meter fills while you're close.
- **Near the cliff edge** (the reservoir), stop the truck → a laptop overlay → hold the signal to take control of the drone → land it.
- **Kids in the truck:** stylised Tom and Murph, with 3 or 4 dialogue lines.

**Done when:** you can play it from start to finish in 3–5 minutes, it holds 60 fps in the corn on the main machine, and it's deployed.

---

## Section 2: Murph's room and the ghost ✅ first pass done 2026-09-24

**Experience:** evening. The bookshelf, the fallen books, the lunar lander model. Murph says there's a ghost. Then the dust storm: dust pours through the open window and settles on the floor **in lines**.

- A detailed room interior, with window light and dust motes (volumetric shafts).
- A dust storm outside: the sky goes brown, and the storm wall is visible through the windows.
- **The dust lines are a puzzle:** you read the wide and narrow gaps as binary and write them in a notebook overlay. Solving it gives the coordinates, or you can skip the puzzle with a hint.
- Dust gathers in bands following a "gravity" field on the floor. This is a particle simulation, not a texture, because the tesseract reuses it in Section 9.

**Done when:** storm → lines form → coordinates decoded → objective "Drive to the coordinates".

---

## Section 3: Drive to NASA and the mission brief ✅ first pass done 2026-09-24

- Murph hides in the truck. A night drive on the same true-scale terrain, to a **fenced compound inside the 20 km map** so it's a real drive of a few minutes, not a teleport. One fade for "hours later" is allowed.
- Gate → the drone that stops you (callback to Section 1) → blackout → the interrogation room. TARS appears here: a monolith robot that walks by rotating its slabs.
- **The facility:** an underground centrifuge hall with the half-built station ring overhead (a setup for Section 10), and the Endurance mock-up.
- **The brief:** a cinematic in a briefing room with a hologram table showing the wormhole near Saturn, the 12 Lazarus missions, and Plan A / Plan B. Written as short, original, paraphrased dialogue.

---

## Section 4: "Don't go" and the goodbye ✅ first pass done 2026-09-24

- Back at the farmhouse. Murph's room: the watch (a model we reuse in the tesseract), the argument and "don't go", and Murph refusing to come down.
- The porch and the truck pulling away. Mission-control countdown audio fades in over the drive: the film's hard cut, done as a fade-free sound bridge into Section 5.
- Mostly cinematic, with light interaction (walk, hand over the watch, look back).

---

## Section 5: Earth, true scale, and the launch (the big technical section) ✅ first pass done 2026-09-25

Split into two parts because the planet engine is the riskiest work in the plan.

### 5a: Seamless Earth engine
- **Cube-sphere quadtree planet** at the real radius (6,371 km). Tiles refine near the camera. The Section 1–4 terrain area is the highest-detail patch set into it, so from orbit you can fly back down and **land at the farm**.
- The rest of the Earth: bundled Earth textures and the procedural detail from `world.frag` (clouds, city lights, oceans). Not the whole planet at ground detail, but it reads correctly from any altitude.
- **Atmospheric scattering** (Rayleigh + Mie, precomputed LUTs), so the sky goes blue → dark blue → black on the way up, and the limb glows from orbit.
- **Handoff to the atlas:** today's atlas uses a compressed Earth. Above about 2,000 km altitude we rescale smoothly from the true-scale Earth frame into the atlas frame, matching Earth's apparent size at the moment of the switch so it's invisible. This uses the same frame-switch idea as the wormhole crossing. Going back down reverses it.
- Replaces the fade-swap that Miller/Mann landings use today (`atlas.ts` `beginLanding`) for Earth. Miller/Mann can adopt it later.

### 5b: Launch
- A **launch pad** about 10 km from the NASA site: tower, flame trench, a multi-stage rocket with the Ranger on top.
- Countdown → ignition (exhaust plume, smoke, camera shake, a rumble built from `audio.ts` layers) → max Q → staging → the sky darkens.
- Orbit → rendezvous and docking with the Endurance (docking is a short manual mini-game, or autopilot).
- Then the existing atlas: you have the Endurance and can fly anywhere, including **back down to the farm**.

**Done when:** one unbroken flight goes pad → orbit → Saturn, and back down to the corn, with no load or cut.

---

## Section 6: Cinematic wormhole (switchable) ✅ first pass done 2026-09-25

- Keep the current physical wormhole as **"Physical"**. Add **"Cinematic"**, toggled from the HUD and settings, and switchable at any time, even mid-crossing.
- Cinematic mode is based on the film's look: the crystal-ball sphere with a sharper Einstein ring, and a long inner passage of streaking, rippling light lanes. Plus buffeting, a letterbox, and the "they" encounter as an abstract distortion ripple.
- It shares the crossing coordinates with the physical version. Only the shader and camera treatment change, so switching modes never desyncs the ship.

---

## Section 7: Miller's planet (story version) 🚧 built, partly tested 2026-09-25

- Build on the Miller surface we already have (`surface.ts`), but arrive by a **seamless descent** using the Section 5a engine instead of the fade.
- Beacon search → the wreck → the first "mountains" turn out to be a wave → run back to the Ranger → the wave lifts the ship → the engines are waterlogged and you wait for them to drain → liftoff.
- Back on the Endurance: the "23 years" beat, delivered as video messages (stylised, written fresh). The Earth-time clock in the HUD ties it together.

---

## Section 8: Gargantua and the plunge

- Mann is skipped: a short text card, or skip it completely.
- The slingshot around Gargantua uses the observatory's ray tracer at full quality. Detach the Ranger and TARS, then fall toward the horizon.
- The approach gets **more** extreme: time-dilation readout, a blue-shifted disk, the sky shrinking to a point. It ends with the Ranger breaking apart and ejecting.

---

## Section 9: The tesseract

**Experience:** a mind-bending 4D/5D space. An endless lattice of Murph's bedroom, seen from behind the bookshelf, from every moment in time at once.

- Repeated room slices along three axes (instanced, with raymarched "time threads" stretching out of every object), receding into infinity with fog and glow.
- **Time is a direction you can move in.** Pushing forward or back scrubs the room through its moments: young Murph, the storm, the goodbye.
- Interactions that *are* the plot: push books (the "ghost"), write "STAY" in morse, make the dust lines (the Section 2 particle simulation, now seen from the other side), and tick the **watch's** second hand for the quantum data.
- Visual effects: hyper-rotation (4D projections rotating into 3D), mirrored and kaleidoscopic room copies, geometry that folds as you move, spectral colour fringes, and ultra-slow sound. This is the most artistically open section.
- It ends with the tesseract collapsing: everything folds back to a single point → cut to the next chapter (the film cuts here too).

---

## Section 10: Cooper Station (O'Neill cylinder)

- You wake up in a hospital room → walk out → **inside the O'Neill cylinder**: farmland, houses and roads curving up and overhead, and a sun tube along the axis. The farmhouse from Section 1 is rebuilt inside as a museum.
- True rotating-habitat feel: the ground curves up on both sides, and a thrown ball curves (a nice physics detail). The baseball window scene.
- Old Murph's bedside scene (stylised, written fresh) → she sends you to Brand.
- The final shot: take a ship out of the end cap and see the cylinder from outside, near Saturn. **The free-flight atlas opens again**, so you can fly back to the wormhole or to Earth.

---

## Section 11: Polish and release

- An original score pass (organ, per-chapter themes built on `audio.ts`), a settings menu, quality presets per chapter.
- Mobile/touch controls for walk and drive, plus accessibility (captions are always available, reduced motion skips camera shake).
- Chapter select, a credits card with sources, README/ATLAS updates, and deploy.

---

## Map layout (Sections 1–5 share one true-scale area)

```
        N
   [Launch pad] ── 10 km ── [NASA compound]
                                   │  ~8 km night road
   [Reservoir cliff] ─ corn ─ [Cooper farm]
        (drone ends)          (house, barn, Murph's room)
```

Everything is on one continuous terrain, so from orbit you can come back and see all of it.

---

## Decisions to make before each section starts

| When | Decision | My recommendation |
|---|---|---|
| Section 0 | People: stylised visible characters, or keep them mostly off-screen and heard? | Stylised low-poly humans with simple rigs (CC0/Mixamo-style), faces kept simple |
| Section 1 | Truck handling: arcade or simulation? | Arcade. It's a chase, and it's fun |
| Section 5a | Build the planet engine ourselves, or use a library? | Build it ourselves on Three.js. The code base is already custom shader work, and we need the atlas handoff |
| Section 6 | How far from physics can cinematic mode go? | As far as the film does. The physical mode is there for accuracy |
| Section 9 | How abstract should the tesseract be? | Very. It's the showpiece |

## Rough order and size

| # | Section | Size |
|---|---|---|
| 0 | Story engine | S–M |
| 1 | Farm and drone chase | L |
| 2 | Murph's room and ghost | M |
| 3 | NASA drive and brief | M |
| 4 | Don't go / goodbye | S–M |
| 5a | Seamless Earth engine | XL |
| 5b | Launch | M–L |
| 6 | Cinematic wormhole | M |
| 7 | Miller story | M |
| 8 | Gargantua plunge | M |
| 9 | Tesseract | L |
| 10 | Cooper Station | L |
| 11 | Polish and release | M |

The next step is **finishing Section 7** (test the rescue, the wave ride, the drain and the messages), then Section 8. Section 5 still wants a truly continuous atlas handoff (see the notes below). Polish still worth doing on 1–3: softer corn-field edges from a distance, lit farmhouse windows at night, a proper walk cycle and faces for the cast, and voice-over.

### Notes from building Sections 0–1
- The world is in true-scale metres, centred on the farm. Float precision is fine out to ~20 km, but the floating origin for orbit is still Section 5a work.
- The corn is the main cost. Adaptive quality picks a plant radius (26/34/42 m) and turns MSAA and bloom on or off. Intel UHD settles at low–mid.
- `window.__story` (dev builds only) lets tests step frames by hand while the tab is hidden.

### Notes from building Sections 2–3
- **Moods** (`earth/world.ts`): morning, evening, storm and night presets blend the sky, haze, sun and ambient light. `indoor` and `underground` shut out sky light; `shadowSpan` tightens the sun's shadow box indoors so window light is crisp.
- **The house** now has an inner plaster shell with real window openings (the siding no longer casts shadows), so sunlight falls into Murph's room through the glass. Her room is `earth/room.ts`; the rest of the interior is still empty.
- **The dust** (`earth/dust.ts`) is a reusable grain simulation that settles into a floor map. Stripes are passed in, so the tesseract can drive it from the other side (Section 9).
- **The message**: four rows of seven bands encode 40, 3, 99 and 33, i.e. 40°03′N 99°33′W, which is the compound 5.4 km north of the farm on the x = 380 section road.
- **The compound** (`earth/compound.ts`): the fenced surface is on the shared terrain (flattened, no corn). The facility is 60 m below it in the same world, lit by its own lights (switched off when you're not down there). The headlight uniforms also carry a second, separately aimed lamp (the security drone's searchlight).
- Measured on Intel UHD at 1024×576, low tier: 14–19 ms outdoors and in the storm room, about 6 ms underground.

### Notes from building Section 4
- **The watch** (`earth/watch.ts`) is a real model with ticking hands; Murph's copy lies on her bookshelf at eye height (`WATCH_SPOT` in `earth/room.ts`), ready for the tesseract.
- **Choices**: `ui.choice([...])` shows numbered replies; chapters read keys 1–3. Used once here (why he's going vs. what happens to time).
- **The countdown** is a sound bridge: mission-control subtitles with radio beeps and a rising rumble play while you drive, and the chapter cuts to black on zero, ready to hand over to the launch pad in Section 5b.

### Notes from building Section 5
- **The planet is ray traced, not tiled.** Instead of a cube-sphere quadtree, `earth/globe.ts` intersects every view ray with the exact sphere and marches a single-scattering atmosphere (Rayleigh + Mie; the sun's path uses Schüler's Chapman approximation, because a nested loop made the Direct3D shader compiler take most of a minute). It is the sky and the planet at once, so there is nothing to tessellate. The local map (`ground.ts`) stays the detailed patch under the camera, takes its colours from the same Earth map as you climb, and dissolves into the globe between about 22 and 45 km.
- **Frames.** The globe is centred straight below the camera, matching the ground's d²/2R curve, and the camera's offset from the farm is treated as distance travelled over the surface (`earth/geo.ts`). That keeps everything near the camera exact and lets a rocket fly 2,000 km downrange. The sun and the Earth map rotate by the arc travelled; far buildings (farm, compound, pad) sink by the curve (`world.anchors`).
- **Launch** (`earth/launch.ts`, `chapters/launch.ts`): pad 10 km west of the compound; a two-stage booster with the Ranger on top; a real-shaped ascent (max Q ≈ 1:08, staging 2:30, cut-off 8:40, 206 km at 7.8 km/s, ~1,900 km downrange), with time warp in the quiet stretches; docking by hand with range/closing/offset readouts, or let TARS do it.
- **Atlas handoff (deviation):** rather than a continuous rescale at 2,000 km, the handoff happens after docking: the atlas opens with the ship placed so Earth's horizon sits where it did from 200 km up, moving with Earth, and the last story frame crossfades into it. From the atlas, near Earth, **L** (or the route chart) crossfades back into a Ranger descent: 120 km up, 900 km west, flown by hand or by TARS down to the yard, where you can step out. A continuous frame switch is still to do.
- Measured at 1024×576 on Intel UHD (high tier): pad 6 ms, the view from orbit 8–10 ms, docking 8 ms.

### Notes from building Section 6
- **Switch:** "Wormhole: Physical / Cinematic" in the atlas bar, or **K**; remembered between visits. The two looks blend over about a second, so switching mid-crossing never jumps, and both use the same ray trace and crossing coordinates, so the ship never desyncs.
- **Cinematic look** (`shaders/lens.frag`, `uCine`): the far galaxy brighter through the crystal ball, a thin glowing Einstein ring at the rays whose impact parameter equals the throat radius, and inside the throat a tunnel of rushing, rippling light lanes. Passing the middle sets off "their" ripple through the whole view. The atlas adds harder buffeting, letterbox bars and a wider lens during the crossing.
- Costs about 0.3 ms a frame over the physical mode.

### Notes from building Section 7 (in progress)
- `chapters/miller.ts` reuses the atlas's Miller ocean (`surface.ts` gained `stage()`, `waveEta()`, `waveIn()`), drawn by the story's own camera and composer via `Story.setScene()`, with Gargantua's sky handed over from the atlas in `main.ts`.
- Scenes: descent over the water → wade to the wreck (the wave is timed to reach the Ranger 170 s after touchdown) → "those aren't mountains" → free Brand → run back → the wave lifts the Ranger → engines drain, "an hour and twelve minutes later" → liftoff over the next wave → the Endurance, Romilly, and 23 years of messages. A Miller/Earth clock (1 hour = 7 years) runs throughout.
- Checked in the browser: descent, wading, the wave appearing on the horizon. **Not yet checked:** the rescue onward. Browser automation became unreliable at that point (the tab kept being replaced), so the cause (a crash in the chapter or the extension) is still unknown.
- The first frame takes several seconds (shader compiles); the Gargantua sky is now built a strip per frame in story mode so a full cube trace can't trip the GPU watchdog.
