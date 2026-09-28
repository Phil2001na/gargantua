# Task queue (for looped build sessions)

`BUILD_PLAN.md` is the design. This file is the **work queue**: each task is sized for one
session, has a clear "done when", and is ticked off here when it's finished.

## How to run one iteration

1. Take the **first unticked task** below. Don't skip ahead unless it's marked blocked.
2. Read the files it names before editing. Match the existing style (plain TS, custom GLSL,
   original dialogue, no film assets).
3. Build it. `npm run build` must pass (it runs `tsc`).
4. Check it in the browser (`npm run dev -- --port 5177`). Chapters can be stepped by hand
   with `window.__story` / `window.__atlas` in dev builds. Measure ms per frame.
5. Tick the task here (`[x]` + date + one-line note), add an `UPDATES.md` entry, commit.
6. Deploy to Vercel (`vercel --prod`) only on tasks marked **🚀 deploy**.
7. If a task turns out too big, split it here into smaller tasks and do the first one.
   If it's blocked, mark it `[!]` with the reason and move to the next.

**Quality bar:** 60 fps mid-range, 30+ fps Intel UHD. No loading screens mid-play. Every new
scene gets a quality ladder. It should *feel* like the film: scale, silence, then noise.

---

## Where we are (2026-09-26)

| # | Chapter | State |
|---|---|---|
| 01–05 | Dust → Ghost → Coordinates → Don't Go → Liftoff | ✅ playable |
| **06** | **The Wormhole** | ❌ **not a chapter yet.** The crossing exists only in free-play (atlas). Story mode jumps from docking straight to free flight, and Miller is started from the menu. This is the "incomplete wormhole". |
| 07 | Miller | 🚧 built, rescue onward untested |
| 08–10 | Gargantua, Tesseract, Cooper Station | not started |
| 11 | Polish and release | not started |

## Where we're heading

One unbroken story: **pad → orbit → Saturn → through the wormhole → Miller → Gargantua →
tesseract → Cooper Station**, then free flight opens up again. The wormhole is the hinge of the
whole game, so it goes first, and it should be the best-looking scene in it.

---

## Phase A — Chapter 6: The Wormhole (start here)

The chapter drives the atlas (it already has the ray-traced wormhole, the ship, the crossing
maths and the cinematic look) while story mode supplies the script, subtitles, letterbox and
skip. No second wormhole renderer.

- [x] **A1. Story can host the atlas.** *(2026-09-26: `Atlas.host/unhost/hostState`, `Story.host`, stub Chapter 6 flies through on autopilot with phase lines; pause, skip and end-to-menu checked, ~49 s, 40–60 fps.)* Add a hosted mode to `Atlas` (`atlas.ts`): story opens
  it at a given placement, hides the atlas HUD (keeps a slim flight HUD), locks or unlocks
  player controls, and exposes read-only state (side, throat ℓ, phase, crossing count, "they"
  ripple). `main.ts` loop: when hosted, story's update runs and calls `atlas.update`; story UI
  sits on top. Add `Story.host` so a chapter can ask for it. Stub chapter 06 (`ready: true`)
  that opens near Saturn and flies the autopilot through, with a subtitle at each phase.
  *Done when:* menu → 06 → the Endurance crosses with story subtitles, Esc/pause and hold-Space
  skip work, and the chapter ends cleanly back to the menu.
- [x] **A2. Arrival at Saturn.** *(2026-09-27: cryo frost, time card, ring pull-back + skim with the planet's shadow on the rings, push-in on the sphere, Romilly's paper-fold hologram; ~3 min to "take us in", skip cuts to the approach; 18–35 ms/frame on Intel UHD; shaders precompiled on host to avoid stalls at cuts.)* Opening: cryo pods (simple interior or a hull shot) and a time
  card ("Two years later"), wake-up lines, then a long cinematic rail past the rings (shadow
  on the rings, the ship tiny against them), then the first sight of the sphere: a slow push-in
  where it reads as a hole in the sky. Original dialogue: the "why a sphere" explanation (a
  hologram fold of paper and pencil, drawn as a simple overlay or 3D sheet).
  *Done when:* 2–3 minutes from wake-up to "take us in", skippable, measured on Intel UHD.
- [x] **A3. The crossing, piloted.** *(2026-09-27: verified headless on Intel UHD in both looks: TARS-flown, hand-flown, T mid-way, K mid-way, hold-Space skip in the throat; handshake lines land on the wavefront, cockpit in the throat, chase after, no hull clipping; 37–60 fps. Fixed: T and K now work at any point, skip takes the stick back, no late "coming out" line.)* Cooper flies the approach by hand (or TARS on `T`),
  with a choice before entry: **Physical** or **Cinematic** look (K still toggles mid-way).
  Phase-driven lines (entering / inside / emerging), harder buffeting, the silence in the
  middle, and "their" handshake: the ripple passes through the cabin and Brand reaches toward
  it (a cockpit-view moment; an abstract distortion, not a figure).
  *Done when:* both looks play end to end with no desync, and the camera never clips the hull.
- [x] **A4. Make the passage look like the film.** *(2026-09-28: lanes built from both real skies (same stars as the sky, streaked, rippling, fringed), ring flash on entry, growing exit disc + short bloom surge, Saturn's lensed images read on approach; roar/organ in, hush, swell out. +0.85 ms vs the old cinematic in the throat on Intel UHD at 1280×720; physical path untouched.)* Upgrade `shaders/lens.frag` cinematic mode:
  - light lanes built from the *actual* lensed destination sky, stretched along the throat
    (motion-blurred galaxy, not procedural noise), with the exit growing ahead as a bright disc;
  - entry "splash": the sphere's surface engulfs the frame with a brief ring flash;
  - spectral fringing and a soft radial blur near the walls; a bloom surge at the exit;
  - Saturn and its rings visible *reflected* in the sphere on approach (the local capture
    already exists; check it reads);
  - sound: rising organ + roar on entry, near-silence in the middle, a swell on exit (`audio.ts`).
  *Done when:* side-by-side screenshots (entry, middle, exit) look clearly film-like, cost
  stays under +1.5 ms on Intel UHD, physical mode is unchanged.
- [x] **A5. Emerge at Gargantua, then Miller with no menu.** *(2026-09-28: Gargantua shot + crew lines, cruise with dilation readout, dissolve into 07 (`Story.continueTo`); Launch → 06 → 07 verified in one headless run on Intel UHD, no menu, no errors. Deploy NOT done: left for Philip.)* Exit beat: the giant fills the
  view behind the sphere, the crew's reaction, a short cruise toward Miller with the time
  dilation readout, then a crossfade into Chapter 7's descent. Launch's "Fly on toward
  Saturn" now continues into Chapter 6 (free flight stays available from the end cards).
  *Done when:* Chapter 5 → 6 → 7 plays through without returning to the menu. **🚀 deploy**

## Phase B — Finish Chapter 7: Miller

- [ ] **B1. Play-test the rescue onward** (free Brand → run back → wave lifts the Ranger →
  drain → liftoff → messages). Find and fix whatever broke the browser session last time
  (check for a thrown error or a GPU watchdog reset first).
- [ ] **B2. Seamless descent.** Replace Miller's opening cut with a continuous descent from
  orbit (the ocean fading in under Gargantua, as the Earth globe does in Chapter 5).
- [ ] **B3. The messages scene.** Make the 23-years beat land: pacing, the screen, the clock
  hitting 23 years 4 months, silence. **🚀 deploy**

## Phase C — Chapter 8: Gargantua and the plunge

- [ ] **C1. Story can host the black hole observatory** (same idea as A1, for
  `blackhole.frag`/`main.ts`), and a Mann text card.
- [ ] **C2. The slingshot.** The Endurance skims Gargantua at full ray-traced quality; the
  fuel/time trade explained in fresh dialogue; time-dilation readout.
- [ ] **C3. Detach and fall.** The Ranger and TARS separate; the approach gets more extreme
  (blue-shifted disk, sky shrinking to a point); the Ranger breaks up and ejects. **🚀 deploy**

## Phase D — Chapter 9: The Tesseract (the showpiece)

- [ ] **D1. The lattice.** Instanced copies of Murph's room (`earth/room.ts`) along three axes,
  seen from behind the bookshelf, with glowing time threads, fog to infinity.
- [ ] **D2. Time as a direction.** Moving along one axis scrubs the room through its moments
  (young Murph, the storm, the goodbye).
- [ ] **D3. The interactions that are the plot.** Push books (the ghost), "STAY" in morse,
  make the dust lines (`earth/dust.ts` driven from this side), tick the watch's second hand.
- [ ] **D4. Hyper-rotation and collapse.** 4D projection effects, kaleidoscopic copies,
  spectral fringes, ultra-slow sound; everything folds to a point. **🚀 deploy**

## Phase E — Chapter 10: Cooper Station

- [ ] **E1. Hospital wake-up and the walk out.**
- [ ] **E2. The O'Neill cylinder interior.** Ground curving up and overhead, a sun tube along
  the axis, fields, houses and roads (a new ground shader wrapped around the axis).
- [ ] **E3. The museum farmhouse and the baseball** (a thrown ball curves in the rotating frame).
- [ ] **E4. Murph's bedside** (fresh dialogue), then out of the end cap: the cylinder seen from
  outside near Saturn, and free flight opens again. **🚀 deploy**

## Phase F — Polish and release

- [ ] **F1. Continuous Earth ↔ atlas handoff** (the frame switch at ~2,000 km, no crossfade).
- [ ] **F2. People:** a proper walk cycle and simple faces for the cast.
- [ ] **F3. Score:** per-chapter organ themes on `audio.ts`.
- [ ] **F4. Settings and quality presets per chapter; mobile/touch walk and drive.**
- [ ] **F5. Accessibility:** captions always on option, reduced motion skips shake.
- [ ] **F6. Chapter select after first play, credits card, README/ATLAS updates.** **🚀 deploy**

---

## Loop prompt

```
/loop Continue the Gargantua story build in C:\Users\phili\OneDrive\Documents\projects\gargantua: follow "How to run one iteration" in TASKS.md, do the first unticked task, verify it in the browser, tick it, log UPDATES.md, commit. Stop the loop when Phase A is done (or when a task is blocked and needs Philip).
```
