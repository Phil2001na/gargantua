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

const KEYS = `The autopilot has the controls for now.<br>Hold <kbd>Space</kbd> to skip ahead`;

type Shot = { pos: THREE.Vector3; quat: THREE.Quaternion; fov: number };
const UP = new THREE.Vector3(0, 1, 0);
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
  private stage: "arrival" | "approach" | "crossing" | "through" | "end" = "arrival";
  /** Chapter time (stops while paused), for the script's safety timeouts and camera moves. */
  private clock = 0;
  /** The atlas counts crossings for its whole life; this chapter's start from here. */
  private base = 0;
  /** The current scripted camera move (time since it started → pose), or null for the flight camera. */
  private shot: ((t: number) => Shot) | null = null;
  private shotStart = 0;
  private frost: Frost | null = null;
  private fold: Fold | null = null;
  constructor(private s: Story) {}

  start(checkpoint = "start") {
    this.checkpoint = checkpoint;
    this.s.ui.fade(1, 0);
    this.atlas = this.s.host("saturn");
    this.base = this.atlas.hostState.crossings;
    this.clock = 0;
    this.s.cinematicMode = true;
    this.s.input.capture(false);
    this.s.run(() => (checkpoint === "approach" ? this.fromApproach() : this.arrival()));
  }
  dispose() {
    this.s.ui.hideCard();
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
    }
  }
  update(dt: number) {
    this.clock += dt;
    if (this.shot) this.atlas.setHostShot(this.shot(this.clock - this.shotStart));
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
    yield ui.say("Cooper", "TARS, take us in. Nice and slow.");
    this.setShot(null);
    this.atlas.autopilotWormhole();
    yield ui.say("TARS", "Nice and slow is the only speed it allows.");
    yield this.until(() => this.state.phase !== "outside", 120);
    this.stage = "crossing";
    ui.clearLines();
    ui.say("Doyle", "We're in its field. Instruments are going strange.");
    yield this.until(() => this.state.phase === "throat" || this.crossed, 60);
    ui.clearLines();
    ui.say("Brand", "Everyone hold on.");
    yield this.until(() => this.state.they > 0.3 || this.crossed, 20);
    ui.say("Brand", "Did you feel that? Something passed through us.");
    yield this.until(() => this.crossed, 60);
    yield this.until(() => this.state.phase === "emerging" || this.state.phase === "outside", 30);
    this.stage = "through";
    ui.say("TARS", "Coming out the other side.");
    yield this.until(() => this.state.phase === "outside", 60);
    yield* this.emerged();
  }
  /** A skipped crossing: cut through black to just beyond Gargantua's mouth. */
  private *skipped(): Generator<Wait> {
    const { ui } = this.s;
    ui.clearLines();
    this.clearOverlays();
    yield ui.fade(1, 0.6);
    this.setShot(null);
    this.atlas.host("beyond");
    ui.fade(0, 1.6);
    yield 1;
    yield* this.emerged();
  }
  private *emerged(): Generator<Wait> {
    const { ui } = this.s;
    this.stage = "through";
    yield ui.say("Romilly", "That's not our sky.");
    yield this.until(() => this.state.autopilot === null, 25);
    yield ui.say("Cooper", "Gargantua. There it is.");
    yield ui.say("Brand", "Miller's signal is coming from the first planet. Closest to it.");
    yield 1.5;
    this.stage = "end";
    this.s.cinematicMode = false;
    ui.end(
      "Chapter six complete",
      "The Wormhole",
      "Two years to Saturn, then through the sphere and out under another galaxy's sky. (The piloted crossing is in production.)",
      [
        ["On to Miller ▶", () => this.s.play("miller")],
        ["Replay chapter", () => this.s.restart(false)],
        ["Chapters", () => this.s.toMenu()],
      ],
    );
  }
}
