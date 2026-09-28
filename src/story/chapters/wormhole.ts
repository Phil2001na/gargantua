import * as THREE from "three";
import type { Chapter, Story } from "../story";
import type { Wait } from "../engine";
import type { Atlas } from "../../atlas";
import { Fold, Frost } from "./saturn";

/**
 * Chapter six: the wormhole. The atlas already has the ray-traced bridge, the Endurance and
 * the crossing; this chapter hosts it and supplies the script and the camera work.
 * Arrival (A2): wake from cryo two years out, a long rail past the rings, then the first
 * sight of the sphere and Romilly's paper-and-pencil explanation. Then TARS flies it through.
 * Dialogue is original, written for this project.
 */

const KEYS = `Fly: <kbd>W</kbd>/<kbd>S</kbd> thrust · <kbd>A</kbd><kbd>D</kbd> <kbd>R</kbd><kbd>F</kbd> <kbd>Q</kbd><kbd>E</kbd> steer, or drag<br><kbd>T</kbd> TARS flies · <kbd>K</kbd> physical / cinematic · <kbd>C</kbd> view · Hold <kbd>Space</kbd> to skip`;

type Shot = { pos: THREE.Vector3; quat: THREE.Quaternion; fov: number };
const UP = new THREE.Vector3(0, 1, 0);
/** Length of the cruise toward Miller before the dissolve into Chapter 7 (seconds). */
const CRUISE = 26;
/** Miller's surface: seven years of Earth time per hour. */
const MILLER_DILATION = (7 * 365.25 * 24) / 1;
/** "1 hour aboard = …" in Earth time, for the readout. */
function earthSpan(hours: number) {
  if (hours < 2) return `${Math.round(hours * 60)} min`;
  if (hours < 48) return `${hours.toFixed(1)} h`;
  const days = hours / 24;
  if (days < 365.25) return `${Math.round(days)} days`;
  const years = days / 365.25;
  return `${years.toFixed(years < 10 ? 1 : 0)} years`;
}
const smooth = (x: number) => THREE.MathUtils.smoothstep(x, 0, 1);

function aim(pos: THREE.Vector3, target: THREE.Vector3, up = UP, fov = 50): Shot {
  const quat = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().lookAt(pos, target, up));
  return { pos, quat, fov };
}

export class WormholeChapter implements Chapter {
  readonly title = "06 · The Wormhole";
  readonly keys = KEYS;
  checkpoint = "start";
  modal = false;
  private atlas!: Atlas;
  private stage: "arrival" | "approach" | "crossing" | "through" | "cruise" | "end" = "arrival";
  /** Seconds into the cruise toward Miller (drives the dilation readout). */
  private cruiseT = 0;
  /** Chapter time (stops while paused), for the script's safety timeouts and camera moves. */
  private clock = 0;
  /** The atlas counts crossings for its whole life; this chapter's start from here. */
  private base = 0;
  /** The current scripted camera move (time since it started → pose), or null for the flight camera. */
  private shot: ((t: number) => Shot) | null = null;
  private shotStart = 0;
  private frost: Frost | null = null;
  private fold: Fold | null = null;
  /** The player has the stick; `tars` once TARS has taken it back. */
  private flying = false;
  private tars = false;
  /** Cooper still had the stick when the ship crossed the middle. */
  private handFlown = false;
  private picked = -1;
  constructor(private s: Story) {}

  start(checkpoint = "start") {
    this.checkpoint = checkpoint;
    this.s.ui.fade(1, 0);
    this.atlas = this.s.host("saturn");
    this.base = this.atlas.hostState.crossings;
    this.clock = 0;
    this.flying = this.tars = this.handFlown = false;
    this.s.cinematicMode = true;
    this.s.input.capture(false);
    this.s.run(() => (checkpoint === "approach" ? this.fromApproach() : this.arrival()));
  }
  dispose() {
    this.s.ui.hideCard();
    this.s.ui.prompt(null);
    this.s.ui.choice(null);
    this.setShot(null);
    this.clearOverlays();
    // Story ends the hosting itself (endChapter); nothing else of ours is in a scene.
  }
  skip() {
    this.s.ui.hideCard();
    if (this.stage === "arrival") {
      this.stage = "approach";
      this.s.run(() => this.fromApproach(true));
    } else if (this.stage === "approach" || this.stage === "crossing") {
      this.stage = "through";
      this.s.run(() => this.skipped());
    } else if (this.stage === "through" || this.stage === "cruise") {
      // Past the crossing, a skip goes straight on to Miller.
      this.stage = "end";
      this.s.run(() => this.toMiller(true));
    }
  }
  update(dt: number) {
    this.clock += dt;
    if (this.flying && !this.handFlown && this.crossed) this.handFlown = true;
    if (this.stage === "cruise") {
      // The dilation readout: what an hour here costs back home, climbing toward Miller's
      // seven years as the Endurance drops in toward Gargantua.
      this.cruiseT += dt;
      const k = THREE.MathUtils.smoothstep(this.cruiseT / CRUISE, 0, 1);
      const f = Math.exp(Math.log(1.02) + (Math.log(MILLER_DILATION) - Math.log(1.02)) * k * k);
      this.s.ui.telemetry([
        ["Time dilation", `×${f < 10 ? f.toFixed(2) : Math.round(f).toLocaleString("en-GB")}`],
        ["1 hour here", `${earthSpan(f)} on Earth`],
        ["Miller", k < 0.98 ? "closing" : "descent"],
      ]);
    }
    // T hands the stick to TARS at any point while Cooper is flying (even deep in the throat).
    if (this.flying && !this.tars && this.s.input.hit("KeyT")) this.handOver("asked");
    if (this.shot) this.atlas.setHostShot(this.shot(this.clock - this.shotStart));
    if (this.stage !== "arrival" && this.stage !== "end") {
      // The crossing's sound: a roar and a rising organ in, near silence in the middle, and
      // the organ swelling as the new sky opens up.
      const p = this.state.passage;
      const quiet = 1 - 0.92 * p.hush;
      this.s.audio.rumble((0.06 + 0.7 * p.entry + 0.3 * p.swell) * quiet, 0.5);
      this.s.audio.padLevel(Math.min(1.1, 0.12 + 0.45 * p.entry + 1.1 * p.swell) * quiet, 1);
    }
  }

  private get state() {
    return this.atlas.hostState;
  }
  private get crossed() {
    return this.state.crossings > this.base;
  }
  /** Wait for a condition, but never longer than `max` seconds (the script can't hang). */
  private until(pred: () => boolean, max: number): () => boolean {
    const t0 = this.clock;
    return () => pred() || this.clock - t0 > max;
  }
  private setShot(fn: ((t: number) => Shot) | null) {
    this.shot = fn;
    this.shotStart = this.clock;
    if (fn) this.atlas.setHostShot(fn(0));
    else this.atlas.setHostShot(null);
  }
  private clearOverlays() {
    this.frost?.dispose();
    this.frost = null;
    this.fold?.dispose();
    this.fold = null;
  }

  /**
   * Saturn's frame: centre, ring normal `n`, `a` in the ring plane pointing away from the Sun
   * (where the planet's shadow falls on the rings) and `b` completing the basis.
   */
  private frame() {
    const f = this.atlas.saturnFrame;
    const n = f.ringNormal.clone().normalize();
    const away = f.centre.clone().normalize();
    const a = away.addScaledVector(n, -away.dot(n)).normalize();
    const b = new THREE.Vector3().crossVectors(n, a).normalize();
    return { ...f, n, a, b };
  }
  /** The approach: where TARS takes over, looking at the sphere from twenty-odd units out. */
  private approachPose() {
    const f = this.frame();
    const away = f.mouth.clone().sub(f.centre).normalize();
    const side = UP.clone().cross(away).normalize();
    const pos = f.mouth.clone().addScaledVector(away, 21).addScaledVector(side, 5).add(new THREE.Vector3(0, 2, 0));
    return { pos, dir: f.mouth.clone().addScaledVector(side, -2).sub(pos).normalize() };
  }

  // --- Arrival at Saturn -------------------------------------------------------------
  private *arrival(): Generator<Wait> {
    const { ui } = this.s;
    this.stage = "arrival";
    // Park the ship above the ring plane, off to the side of the planet's shadow, coasting
    // along the rings.
    const f = this.frame();
    const ang = 1.15;
    const radial = f.a.clone().multiplyScalar(Math.cos(ang)).addScaledVector(f.b, Math.sin(ang));
    const along = f.n.clone().cross(radial).normalize().negate();
    const start = f.centre.clone().addScaledVector(radial, 16.5).addScaledVector(f.n, 0.45);
    this.atlas.placeShip(start, along, 0.09);

    // Wake-up: a close hull shot drifting round the Endurance, through frost.
    const ringUp = f.n.clone();
    this.setShot((t) => {
      const s = this.atlas.saturnFrame.ship;
      const o = Math.PI * 0.35 + t * 0.018;
      const pos = s
        .clone()
        .addScaledVector(along, Math.cos(o) * -0.016)
        .addScaledVector(radial, Math.sin(o) * 0.016)
        .addScaledVector(ringUp, 0.005 - t * 0.00005);
      return aim(pos, s.clone().addScaledVector(ringUp, 0.001), ringUp, 46);
    });
    this.frost = new Frost();
    ui.card("Chapter six · Saturn orbit", "Two years later", "");
    yield 1.5;
    ui.fade(0, 4);
    yield 3.5;
    ui.hideCard();
    yield ui.say("TARS", "Wake-up cycle complete. Take your time. Your legs are two years out of practice.");
    this.frost.clear();
    yield ui.say("Cooper", "Two years. Feels like I shut my eyes a minute ago.");
    yield ui.say("Doyle", "Everything aches. Is that normal?");
    yield ui.say("TARS", "It's normal. So is the complaining.");
    yield ui.say("Romilly", "We slept through the whole approach. All that way and none of us saw it get bigger.");
    yield ui.say("Brand", "Then come and look now.");
    yield 1;
    yield ui.fade(1, 1.2);
    this.frost?.dispose();
    this.frost = null;

    // The rings: pull back from the ship until it's a speck against them, then a low pass
    // skimming the ring plane with the planet's shadow falling across it.
    this.setShot((t) => {
      const fr = this.atlas.saturnFrame;
      const s = fr.ship;
      const k = smooth(Math.min(1, t / 24));
      const d = 0.02 + 0.9 * k;
      const pos = s
        .clone()
        .addScaledVector(along, -d)
        .addScaledVector(radial, d * 0.35)
        .addScaledVector(ringUp, 0.004 + d * 0.28);
      const look = s.clone().lerp(fr.centre, 0.02 + 0.1 * k);
      return aim(pos, look, ringUp, 50 - 8 * k);
    });
    ui.fade(0, 1.6);
    yield 2;
    yield ui.say("Doyle", "The rings. They're so thin.");
    yield ui.say("Romilly", "Ice and gravel, wider than Earth and in most places only tens of metres deep.");
    yield ui.say("Cooper", "What's the dark band across them?");
    yield ui.say("Brand", "Saturn's own shadow. The sun is behind the planet from here.");
    yield this.until(() => this.clock - this.shotStart > 26, 30);
    yield ui.fade(1, 1.2);
    this.setShot((t) => {
      const fr = this.frame();
      const k = t / 26;
      // Skim just above the ring plane, sliding sunward past the shadowed arc, the ship ahead.
      const r = 15.2 - 1.2 * k;
      const a0 = 0.75 + 0.2 * k;
      const radial2 = fr.a.clone().multiplyScalar(Math.cos(a0)).addScaledVector(fr.b, Math.sin(a0));
      const pos = fr.centre.clone().addScaledVector(radial2, r).addScaledVector(fr.n, 0.05);
      const look = fr.centre.clone().addScaledVector(fr.a, 4).addScaledVector(fr.n, -0.3);
      return aim(pos, look, fr.n, 52);
    });
    ui.fade(0, 1.4);
    yield 2;
    yield ui.say("TARS", "Anomaly bearing zero-four-one. We'll have visual once we clear the rings.");
    yield ui.say("Doyle", "All those years of probes and numbers, for one look at it.");
    yield ui.say("Brand", "Some of those probes were sent by people who never got to see it. Let's make it count.");
    yield this.until(() => this.clock - this.shotStart > 22, 26);
    yield ui.fade(1, 1.2);

    // First sight: the ship at the approach point, a slow push-in on the sphere.
    const ap = this.approachPose();
    this.atlas.placeShip(ap.pos, ap.dir, 0);
    this.setShot((t) => {
      const fr = this.atlas.saturnFrame;
      const s = fr.ship;
      const toMouth = fr.mouth.clone().sub(s).normalize();
      const k = smooth(Math.min(1, t / 40));
      const back = 5 - 4.93 * k;
      const pos = s
        .clone()
        .addScaledVector(toMouth, -back)
        .addScaledVector(UP, 0.01 + 0.5 * (1 - k));
      return aim(pos, fr.mouth, UP, 34 - 6 * k);
    });
    ui.fade(0, 2.5);
    yield 3;
    yield ui.say("Cooper", "There.");
    yield ui.say("Romilly", "Look at that. It's round. It's a ball.");
    yield ui.say("Cooper", "Every picture I ever saw, it was a hole.");
    yield ui.say("Romilly", "It is a hole. Just not the kind you're picturing. Here.");
    this.fold = new Fold();
    yield 1.4;
    yield ui.say("Romilly", "Pretend this sheet is space. We're here, at Saturn. Where we're going is here.");
    this.fold.step("path");
    yield ui.say("Romilly", "The flat way round is the whole sheet. Longer than any of us will live.");
    this.fold.step("folded");
    yield ui.say("Romilly", "But bend the sheet, and the two places touch.");
    this.fold.step("pencil");
    yield ui.say("Romilly", "Push a pencil through, and you're there. That's the shortcut.");
    this.fold.step("hole");
    yield ui.say("Romilly", "On paper the way through is a circle. Give it the dimension the paper hasn't got…");
    this.fold.step("ball");
    yield ui.say("Romilly", "…and the circle becomes a sphere. That's what's out there.");
    yield ui.say("Brand", "And somebody set it down right next to us.");
    this.fold.dispose();
    this.fold = null;
    yield this.until(() => this.clock - this.shotStart > 42, 12);
    yield* this.takeUsIn();
  }
  /** A skipped arrival (or a replay from the approach): cut straight to the sphere. */
  private *fromApproach(skipped = false): Generator<Wait> {
    const { ui } = this.s;
    this.stage = "approach";
    ui.clearLines();
    this.clearOverlays();
    if (skipped) yield ui.fade(1, 0.6);
    this.setShot(null);
    const ap = this.approachPose();
    this.atlas.placeShip(ap.pos, ap.dir, 0);
    ui.fade(0, 1.6);
    yield 1.2;
    yield* this.takeUsIn();
  }

  // --- The crossing -------------------------------------------------------------------
  private *takeUsIn(): Generator<Wait> {
    const { ui } = this.s;
    this.stage = "approach";
    this.setShot(null);
    this.atlas.setHostView("chase");
    // How the display shows it: the metric's own optics, or the film's crystal ball.
    yield ui.say("TARS", "Before we go in: how do you want the displays to render it?");
    yield* this.choose([
      "Physical: exactly what the geometry does to light",
      "Cinematic: the passage the way the film showed it",
    ]);
    this.atlas.setLook(this.picked === 1);
    ui.say("TARS", this.picked === 1 ? "Cinematic it is. K switches it at any time." : "Physical it is. K switches it at any time.");
    yield 2.5;

    yield ui.say("Cooper", "I'll take her in myself.");
    yield ui.say("TARS", "Line us up on the centre and keep it slow. Say the word and I'll fly it.");
    this.flying = true;
    this.atlas.setHostControls(true);
    ui.prompt("T", "hand the controls to TARS");
    // Cooper flies until the ship is in the sphere's field. If he asks, drifts far off, or
    // hasn't gone in after a while, TARS lines it up.
    const t0 = this.clock;
    let nagged = false;
    yield () => {
      const f = this.atlas.saturnFrame;
      const far = this.state.side === "solar" && f.ship.distanceTo(f.mouth) > 60;
      if (!this.tars && (far || this.clock - t0 > 100)) this.handOver(far ? "far" : "asked");
      else if (!this.tars && !nagged && this.clock - t0 > 45) {
        nagged = true;
        ui.say("TARS", "The sphere is dead ahead of the reticle when you're lined up. Or I can take it.");
      }
      return this.state.phase !== "outside" || this.crossed;
    };

    this.stage = "crossing";
    ui.clearLines();
    ui.say("Doyle", "We're in its field. Instruments are going strange.");
    const inside = () => this.state.phase === "throat" || this.crossed;
    // Into the throat, or back out if the line-up was off; then TARS brings her round.
    yield this.until(() => inside() || this.state.phase === "outside", 45);
    if (!inside()) {
      if (!this.tars) this.handOver(this.state.phase === "outside" ? "missed" : "stalled");
      yield this.until(inside, 120);
    }
    if (!inside()) {
      // Never let the script run on without the ship: cut through as a skip would.
      yield* this.skipped();
      return;
    }

    // The middle: the shaking stops, the noise falls away, and the view goes aboard.
    ui.clearLines();
    this.atlas.setHostView("cockpit");
    ui.say("Brand", "Everyone hold on.");
    yield this.until(() => this.state.they > 0.2 || this.crossed, 12);
    ui.clearLines();
    ui.say("Brand", "Wait. There's something here with us.");
    yield this.until(() => this.state.they > 0.8 || this.crossed, 4);
    ui.say("Brand", "(She lifts her hand to it, and the air ripples round her fingers.)");
    yield this.until(() => this.state.they < 0.15 || this.crossed, 6);
    ui.say("Cooper", "Brand?");
    yield ui.say("Brand", "I think that was a handshake.");
    // Keep going if the pilot stopped to look; TARS brings her through the rest of the way.
    if (!this.crossed && !this.tars) {
      yield this.until(() => this.crossed, 25);
      if (!this.crossed) this.handOver("stalled");
    }
    yield this.until(() => this.crossed, 60);
    this.atlas.setHostView("chase");
    yield this.until(() => this.state.phase === "emerging" || this.state.phase === "outside", 30);
    this.stage = "through";
    // A fast pilot can be clear of the mouth before Brand has finished; don't call it late.
    if (this.state.phase !== "outside") ui.say("TARS", "Coming out the other side.");
    if (!this.tars) {
      // Out the far side at the pilot's pace, then TARS brings her about to face the new sky.
      yield this.until(() => this.state.phase === "outside", 12);
      this.handOver("through");
    }
    yield this.until(() => this.state.phase === "outside", 60);
    yield* this.emerged();
  }
  /** TARS takes the controls (asked, the pilot drifted off, or stalled in the throat). */
  private handOver(why: "asked" | "far" | "missed" | "stalled" | "through") {
    if (this.tars) return;
    this.tars = true;
    this.flying = false;
    this.s.ui.prompt(null);
    this.atlas.setHostControls(false);
    this.atlas.autopilotWormhole();
    if (why === "through") return;
    this.s.ui.say(
      "TARS",
      why === "asked"
        ? "I have it."
        : why === "far"
          ? "We're drifting off. I have the controls."
          : why === "missed"
            ? "We slid off the edge of it. I'll bring us round."
            : "I have it. Better not to linger in here.",
    );
  }
  private *choose(options: string[]): Generator<Wait> {
    const { ui, input } = this.s;
    this.picked = -1;
    ui.choice(options);
    yield () => {
      options.forEach((_, i) => {
        if (this.picked < 0 && input.hit(`Digit${i + 1}`, `Numpad${i + 1}`)) this.picked = i;
      });
      return this.picked >= 0;
    };
    ui.choice(null);
  }
  /** A skipped crossing: cut through black to just beyond Gargantua's mouth. */
  private *skipped(): Generator<Wait> {
    const { ui } = this.s;
    ui.clearLines();
    ui.prompt(null);
    ui.choice(null);
    this.flying = false;
    this.tars = true;
    this.atlas.setHostControls(false);
    this.clearOverlays();
    yield ui.fade(1, 0.6);
    this.setShot(null);
    this.atlas.host("beyond");
    ui.fade(0, 1.6);
    yield 1;
    yield* this.emerged();
  }
  // --- Out the other side (A5) ------------------------------------------------------
  private *emerged(): Generator<Wait> {
    const { ui } = this.s;
    this.stage = "through";
    yield ui.say("Romilly", "That's not our sky.");
    if (this.handFlown) yield ui.say("TARS", "Nice flying, Cooper. First ever, and not a scratch on her.");
    // TARS brings her about to face the new sky's landmark.
    yield this.until(() => this.state.autopilot === null, 25);
    // The giant: a slow drift out from behind the ship, the sphere at our backs and
    // Gargantua filling the view ahead.
    const g = new THREE.Vector3();
    const s0 = this.atlas.saturnFrame.ship;
    const toG = g.clone().sub(s0).normalize();
    const side = UP.clone().cross(toG).normalize();
    this.setShot((t) => {
      const s = this.atlas.saturnFrame.ship;
      const k = smooth(Math.min(1, t / 18));
      const pos = s
        .clone()
        .addScaledVector(toG, -0.03 - 0.25 * k)
        .addScaledVector(side, 0.012 + 0.06 * k)
        .addScaledVector(UP, 0.006 + 0.05 * k);
      return aim(pos, s.clone().lerp(g, 0.25 + 0.2 * k), UP, 48 - 6 * k);
    });
    yield ui.say("Cooper", "Gargantua. There it is.");
    yield ui.say("Doyle", "It's bending the light from everything behind it. The whole sky's pouring round it.");
    yield ui.say("Brand", "Miller's signal is coming from the first planet in. The one closest to it.");
    yield ui.say("Romilly", "That close to something that heavy, time runs slow. Much slower than here.");
    yield* this.cruise();
  }
  /** The short run in toward Miller, the dilation readout climbing, then straight into 07. */
  private *cruise(): Generator<Wait> {
    const { ui } = this.s;
    this.stage = "cruise";
    this.atlas.hostCruise("miller");
    // Keep the giant in frame behind the ship as she turns and runs in toward Miller.
    const g = new THREE.Vector3();
    this.setShot((t) => {
      const s = this.atlas.saturnFrame.ship;
      const toG = g.clone().sub(s).normalize();
      const side = UP.clone().cross(toG).normalize();
      const k = smooth(Math.min(1, t / CRUISE));
      const pos = s
        .clone()
        .addScaledVector(toG, -0.05 - 0.12 * k)
        .addScaledVector(side, 0.02 + 0.03 * k)
        .addScaledVector(UP, 0.012 + 0.02 * k);
      return aim(pos, s.clone().lerp(g, 0.45), UP, 42 + 6 * k);
    });
    this.cruiseT = 0;
    yield ui.say("TARS", "Course laid in for Miller. I'll put the dilation on the board.");
    yield ui.say("Cooper", "How slow is slow?");
    yield ui.say("Romilly", "On the surface: every hour we spend there, seven years go by back home.");
    yield ui.say("Doyle", "Seven years. Per hour.");
    yield ui.say("Brand", "Then we plan it to the minute. In, get Miller's data, out.");
    yield this.until(() => this.cruiseT > CRUISE, CRUISE);
    yield* this.toMiller(false);
  }
  /** Hand straight over to Chapter 7's descent: a dissolve, not a menu. */
  private *toMiller(skipped: boolean): Generator<Wait> {
    const { ui } = this.s;
    this.stage = "end";
    ui.clearLines();
    ui.telemetry(null);
    if (skipped) yield ui.fade(1, 0.6);
    // Outside this script's step: starting the next chapter replaces the running script.
    queueMicrotask(() => {
      if (skipped) this.s.play("miller");
      else this.s.continueTo("miller");
    });
  }
}
