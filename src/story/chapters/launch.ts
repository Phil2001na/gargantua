import * as THREE from "three";
import type { Chapter, Story } from "../story";
import type { Wait } from "../engine";
import { MOODS } from "../earth/world";
import { LaunchSite, Rocket, Smoke, MOUNT_TOP, STACK } from "../earth/launch";
import { PAD, height } from "../earth/land";
import { dropFrom, EARTH_R } from "../earth/geo";
import { Endurance, buildRanger } from "../../endurance";
import { Walker } from "../controls";

/**
 * Chapter five: the launch. One unbroken climb from the pad to a 200 km orbit on the
 * real-size Earth (the flight profile is a real one: max Q about a minute in, staging at
 * two and a half, orbit at under nine), then a hand-flown docking with the Endurance.
 * Dialogue is original, written for this project.
 */

type Cam = "ground" | "chase" | "nose";
const KEYS = `<kbd>C</kbd> camera · <kbd>[</kbd> <kbd>]</kbd> time warp · mouse to look<br>Docking: <kbd>W</kbd>/<kbd>S</kbd> forward/back · <kbd>A</kbd>/<kbd>D</kbd> left/right · <kbd>R</kbd>/<kbd>F</kbd> up/down · <kbd>T</kbd> let TARS dock<br>Hold <kbd>Space</kbd> in a cutscene to skip it`;
const WARPS = [1, 2, 4, 10, 25];
const SENS = 0.0022;
/** Engine cut-off and orbit. */
const SECO = 520;
const STAGING = 150;
/** Speed (m/s) and flight-path angle from vertical (degrees) against mission time. */
const SPEED: [number, number][] = [
  [0, 0], [10, 45], [20, 110], [40, 270], [60, 450], [90, 850], [120, 1450], [150, 2300],
  [156, 2300], [200, 2900], [260, 3700], [330, 4800], [420, 6200], [520, 7800],
];
const PITCH: [number, number][] = [
  [0, 0], [10, 0], [25, 7], [40, 18], [60, 31], [80, 42], [100, 51], [120, 58], [150, 66],
  [200, 76], [260, 82], [330, 86.5], [420, 89], [520, 90],
];
const lerpTable = (T: [number, number][], t: number) => {
  if (t <= T[0][0]) return T[0][1];
  for (let i = 0; i < T.length - 1; i++) {
    const [a, va] = T[i],
      [b, vb] = T[i + 1];
    if (t <= b) return va + ((vb - va) * (t - a)) / (b - a);
  }
  return T[T.length - 1][1];
};
/** Integrated once: altitude and downrange distance every tenth of a second. */
const TRAJ = (() => {
  const dt = 0.1,
    alt = [0],
    down = [0];
  for (let t = 0; t < SECO; t += dt) {
    const v = lerpTable(SPEED, t),
      g = THREE.MathUtils.degToRad(lerpTable(PITCH, t));
    alt.push(alt[alt.length - 1] + v * Math.cos(g) * dt);
    down.push(down[down.length - 1] + v * Math.sin(g) * dt);
  }
  return { dt, alt, down };
})();
const ORBIT_ALT = TRAJ.alt[TRAJ.alt.length - 1];
const ORBIT_V = 7800;

type Flight = { alt: number; down: number; speed: number; pitch: number };
function flight(t: number): Flight {
  if (t <= 0) return { alt: 0, down: 0, speed: 0, pitch: 0 };
  if (t >= SECO) {
    // Coasting in a circular orbit: along the surface at orbital speed, scaled to the ground.
    const past = t - SECO;
    return { alt: ORBIT_ALT, down: TRAJ.down[TRAJ.down.length - 1] + past * ORBIT_V * (EARTH_R / (EARTH_R + ORBIT_ALT)), speed: ORBIT_V, pitch: Math.PI / 2 };
  }
  const f = t / TRAJ.dt,
    i = Math.floor(f),
    u = f - i;
  return {
    alt: TRAJ.alt[i] + (TRAJ.alt[i + 1] - TRAJ.alt[i]) * u,
    down: TRAJ.down[i] + (TRAJ.down[i + 1] - TRAJ.down[i]) * u,
    speed: lerpTable(SPEED, t),
    pitch: THREE.MathUtils.degToRad(lerpTable(PITCH, t)),
  };
}

export class LaunchChapter implements Chapter {
  readonly title = "05 · Liftoff";
  readonly keys = KEYS;
  checkpoint = "start";
  modal = false;
  private site = new LaunchSite();
  private rocket = new Rocket();
  private smoke: Smoke;
  private endurance = new Endurance();
  private cam: Cam = "ground";
  private camFree = { yaw: 0, pitch: 0 };
  private warp = 0;
  private t = -8;
  private running = false;
  private base = new THREE.Vector3();
  private quat = new THREE.Quaternion();
  private shake = 0;
  private stagedAt = -1;
  private rangerSepAt = -1;
  private phase: "ascent" | "orbit" | "dock" | "docked" | "descent" | "landed" = "ascent";
  /** The homecoming: a Ranger flown down from the edge of space to the farm. */
  private flyer = buildRanger();
  private fp = new THREE.Vector3();
  private fv = new THREE.Vector3();
  private fq = new THREE.Quaternion();
  private flyCam = new THREE.Vector3();
  private tars = false;
  private heat: THREE.Sprite;
  private walker = new Walker();
  private walking = false;
  /** Docking: the Ranger's nose relative to the port (x along the approach), and velocity. */
  private rel = new THREE.Vector3();
  private relV = new THREE.Vector3();
  private auto = false;
  private dockEl: HTMLElement | null = null;
  private bumps = 0;
  private clock = 0;
  private fov = 30;
  constructor(private s: Story) {
    this.smoke = new Smoke(3000, s.earth.u);
    this.endurance.group.scale.setScalar(32);
    this.endurance.group.visible = false;
    s.earth.scene.add(this.site.group, this.rocket.group, this.smoke.points, this.endurance.group);
    s.earth.anchors.push([this.site.group, PAD.x, PAD.z]);
    // Re-entry glow: a hot orange bloom ahead of the nose.
    const c = document.createElement("canvas");
    c.width = c.height = 128;
    const g = c.getContext("2d")!,
      grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    grad.addColorStop(0, "rgba(255,230,190,1)");
    grad.addColorStop(0.3, "rgba(255,140,60,.55)");
    grad.addColorStop(1, "rgba(255,80,20,0)");
    g.fillStyle = grad;
    g.fillRect(0, 0, 128, 128);
    this.heat = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0 }));
    this.flyer.group.visible = false;
    s.earth.scene.add(this.flyer.group, this.heat);
  }
  private get w() {
    return this.s.earth;
  }

  // --- Setup -----------------------------------------------------------------
  start(checkpoint = "start") {
    const { w } = this;
    this.checkpoint = checkpoint;
    w.resetScene();
    w.setMood(MOODS.day);
    w.truck.group.visible = false;
    w.farm.donald.root.visible = false;
    this.s.camera.fov = 30;
    this.s.camera.updateProjectionMatrix();
    this.smoke.pixelHeight = w.pixelHeight;
    const run = {
      start: () => this.countdown(),
      orbit: () => this.toOrbit(),
      dock: () => this.docking(true),
      home: () => this.homecoming(),
    }[checkpoint];
    this.s.run(run ?? (() => this.countdown()));
  }
  dispose() {
    const { w } = this;
    w.scene.remove(this.site.group, this.rocket.group, this.smoke.points, this.endurance.group, this.flyer.group, this.heat);
    const i = w.anchors.findIndex((a) => a[0] === this.site.group);
    if (i >= 0) w.anchors.splice(i, 1);
    this.dockEl?.remove();
    this.s.audio.rumble(0, 0.5);
    this.s.camera.fov = 60;
    this.s.camera.updateProjectionMatrix();
    w.resetScene();
    this.s.ui.reset();
    this.s.input.capture(false);
  }
  skip() {
    this.s.ui.hideCard();
  }

  // --- Scripts -------------------------------------------------------------------
  private *countdown(): Generator<Wait> {
    const { ui, audio } = this.s;
    this.checkpoint = "start";
    this.phase = "ascent";
    this.rocket.reset();
    this.smoke.clear();
    this.site.swing(0);
    this.t = -9;
    this.running = true;
    this.cam = "ground";
    this.s.cinematicMode = true;
    this.s.input.capture(true);
    ui.fade(1, 0);
    audio.rumble(0.02, 1);
    yield 0.8;
    ui.fade(0, 2.5);
    ui.card("Chapter five", "Liftoff", "");
    yield 3;
    ui.hideCard();
    yield () => this.t >= 0;
    this.s.cinematicMode = false;
    ui.hint("<kbd>C</kbd> camera · <kbd>[</kbd> <kbd>]</kbd> time warp · mouse to look");
    yield () => this.t >= 30;
    ui.hint(null);
    yield () => this.t >= SECO + 8;
    yield* this.toOrbit();
  }

  /** Checkpoint and continuation: in orbit behind the Endurance. */
  private *toOrbit(): Generator<Wait> {
    const { ui } = this.s;
    this.checkpoint = "orbit";
    if (this.t < SECO) {
      // Starting here: jump the flight to engine cut-off.
      this.t = SECO + 8;
      this.stagedAt = STAGING;
      this.rangerSepAt = SECO + 6;
      this.rocket.lower.visible = false;
      this.running = true;
    }
    this.phase = "orbit";
    this.setWarp(0);
    this.s.cinematicMode = false;
    this.s.input.capture(true);
    ui.fade(0, 0.8);
    yield 2;
    yield ui.say("TARS", "Two hundred kilometres, circular. The Endurance is two kilometres ahead.");
    yield ui.say("Cooper", "I see her.");
    ui.objective("Close on the Endurance");
    ui.hint("<kbd>]</kbd> speed up time · <kbd>C</kbd> camera");
    yield () => this.phase === "dock";
    yield* this.docking(false);
  }

  private *docking(fromCheckpoint: boolean): Generator<Wait> {
    const { ui, audio } = this.s;
    this.checkpoint = "dock";
    if (fromCheckpoint) {
      this.t = SECO + 60;
      this.stagedAt = STAGING;
      this.rangerSepAt = SECO + 6;
      this.rocket.lower.visible = this.rocket.upper.visible = false;
      this.running = true;
      ui.fade(1, 0);
      ui.fade(0, 1);
    }
    this.phase = "dock";
    this.setWarp(0);
    // Start 260 m back on the approach axis, a little off line, closing slowly.
    this.rel.set(-260, 3.5, -6);
    this.relV.set(1.8, 0, 0);
    this.auto = false;
    this.bumps = 0;
    this.cam = "nose";
    this.camFree.yaw = this.camFree.pitch = 0;
    this.endurance.group.visible = true;
    this.s.cinematicMode = false;
    this.s.input.capture(true);
    this.dockEl = document.createElement("div");
    this.dockEl.className = "sb-dock";
    this.dockEl.innerHTML = "<i></i>";
    ui.root.append(this.dockEl);
    ui.objective("Dock with the Endurance");
    ui.hint("<kbd>W</kbd>/<kbd>S</kbd> closing speed · <kbd>A</kbd>/<kbd>D</kbd> <kbd>R</kbd>/<kbd>F</kbd> line up · <kbd>T</kbd> let TARS fly it · <kbd>C</kbd> camera");
    this.s.side.run(
      function* (this: LaunchChapter): Generator<Wait> {
        yield ui.say("TARS", "Want me to take her in?");
        yield ui.say("Cooper", "I've got it. Keep the numbers coming.");
        yield ui.say("TARS", "Line up the ring on the port. Under half a metre a second at contact.");
      }.bind(this),
    );
    yield () => this.phase === "docked";
    this.s.side.stop();
    ui.clearLines();
    this.dockEl?.remove();
    this.dockEl = null;
    ui.objective(null);
    ui.hint(null);
    ui.telemetry(null);
    audio.thud(4);
    yield 0.6;
    yield ui.say("TARS", "Contact. Latches engaged. Hard dock.");
    yield ui.say("Doyle", "Endurance, Ranger. We're aboard.");
    yield ui.say("Brand", "Next stop, Saturn. Two years.");
    yield 1;
    this.s.cinematicMode = true;
    yield 2;
    this.s.input.capture(false);
    audio.padLevel(0.3, 3);
    ui.end("Chapter five complete", "Liftoff", "From the pad to orbit without a cut. The Endurance can take it from here: the atlas flies you on to Saturn, and back down to the farm whenever you like.", [
      ["Fly on toward Saturn ▶", () => this.s.leaveForAtlas()],
      ["Take the Ranger back down", () => this.s.play("launch", "home")],
      ["Replay chapter", () => this.s.restart(false)],
      ["Chapters", () => this.s.toMenu()],
    ]);
  }

  // --- Homecoming: fly the Ranger down to the farm ------------------------------------------
  private *homecoming(): Generator<Wait> {
    const { ui, audio } = this.s;
    this.checkpoint = "home";
    this.phase = "descent";
    this.running = true;
    this.walking = false;
    this.rocket.group.visible = false;
    this.endurance.group.visible = false;
    this.site.swing(1);
    this.flyer.group.visible = true;
    // 120 km up and 900 km west of home, gliding in from the edge of space.
    this.fp.set(-900000, 120000, -20000);
    this.fv.set(2600, -80, 0);
    this.fq.setFromRotationMatrix(new THREE.Matrix4().lookAt(this.fp, this.fp.clone().add(this.fv), new THREE.Vector3(0, 1, 0)));
    this.flyCam.copy(this.fp).add(new THREE.Vector3(-60, 14, 0));
    this.tars = false;
    this.cam = "chase";
    this.setWarp(0);
    this.s.cinematicMode = false;
    this.s.gameplay();
    ui.fade(1, 0);
    ui.fade(0, 1.6);
    ui.card("", "Homecoming", "");
    yield 2.4;
    ui.hideCard();
    ui.objective("Fly the Ranger down to the farm");
    ui.hint(
      "Mouse to steer · <kbd>A</kbd>/<kbd>D</kbd> roll · <kbd>W</kbd> thrust, <kbd>Shift</kbd> more · <kbd>S</kbd> brake · <kbd>T</kbd> TARS flies · <kbd>[</kbd> <kbd>]</kbd> time warp · <kbd>C</kbd> camera<br>Below 1 km and slow, the Ranger hovers: <kbd>W A S D</kbd> move · <kbd>R</kbd>/<kbd>F</kbd> up/down",
    );
    this.s.side.run(function* (): Generator<Wait> {
      yield 3;
      yield ui.say("TARS", "Entry interface. It gets warm from here.");
      yield ui.say("TARS", "Say the word and I'll fly us home.");
    });
    yield () => this.phase === "landed";
    this.s.side.stop();
    ui.objective(null);
    ui.hint(null);
    ui.telemetry(null);
    audio.thud(2);
    yield 0.8;
    yield ui.say("TARS", "Touchdown. Welcome home.");
    // Step out into the yard.
    const out = this.fp.clone().add(new THREE.Vector3(0, 0, 11));
    this.walker.place(out.x, height(out.x, out.z), out.z, Math.atan2(out.x, out.z), 0);
    this.walking = true;
    ui.objective("Home");
    ui.hint("<kbd>W A S D</kbd> walk · <kbd>Shift</kbd> run · mouse to look");
    yield 8;
    this.s.input.capture(false);
    ui.end("Home", "Back on the farm", "One unbroken journey: the corn, the pad, orbit and back down again.", [
      [
        "Keep walking",
        () => {
          ui.end(null);
          this.s.gameplay();
        },
      ],
      ["Fly again", () => this.s.restart(true)],
      ["Chapters", () => this.s.toMenu()],
    ]);
  }

  private flyFrame(dt: number) {
    const { w, s } = this;
    const { ui, input, camera, audio } = s;
    const p = this.fp,
      v = this.fv;
    const ground = height(p.x, p.z);
    const alt = p.y - ground;
    const speed = v.length();
    this.flyer.group.position.copy(p);
    this.flyer.group.quaternion.copy(this.fq);
    if (this.walking) {
      w.farm.colliders.dynamic = [{ x: p.x, z: p.z, r: 8, top: ground + 4 }];
      this.walker.update(dt, input, w.farm.colliders, camera, true);
      this.flyer.update(dt, 0, this.clock);
      this.heat.visible = false;
      ui.marker(null, camera);
      audio.rumble(0, 1);
      audio.birds(dt, true);
      return;
    }
    // Home: a patch of yard east of the house.
    const lz = new THREE.Vector3(34, 0, 22);
    lz.y = height(lz.x, lz.z);
    const toLz = new THREE.Vector3(lz.x - p.x, 0, lz.z - p.z);
    const dist = toLz.length();
    const high = alt > 15000;
    if (input.hit("BracketRight")) this.setWarp(this.warp + 1);
    if (input.hit("BracketLeft")) this.setWarp(this.warp - 1);
    if (!high) this.warp = 0;
    const step = dt * WARPS[this.warp];
    if (input.hit("KeyT")) {
      this.tars = !this.tars;
      ui.say("TARS", this.tars ? "I have the controls." : "Your airplane.");
    }
    if (input.hit("KeyC")) this.cam = this.cam === "chase" ? "nose" : "chase";
    const dens = Math.exp(-alt / 8000);
    const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(this.fq);
    const hover = alt < 1200 && speed < 160;
    if (this.tars) {
      // A glide path down to the yard: slow as you come in, then settle onto the spot.
      const wantAlt = Math.min(p.y, lz.y + 30 + dist * 0.11);
      const wantSpeed = THREE.MathUtils.clamp(dist * 0.035 + Math.min(dist, 400) * 0.06, 1.5, 2600);
      const dir = toLz.clone().normalize().multiplyScalar(Math.min(wantSpeed, dist * 0.5));
      dir.y = THREE.MathUtils.clamp((wantAlt - p.y) * 0.08, -300, 60);
      // Over the spot first, then straight down.
      if (dist < 40) dir.y = THREE.MathUtils.clamp((lz.y + 1 - p.y) * 0.5, -6, 2) * THREE.MathUtils.clamp(1.2 - dist / 30, 0.1, 1);
      v.lerp(dir, 1 - Math.exp(-0.5 * step));
    } else if (hover) {
      const flat = new THREE.Vector3(fwd.x, 0, fwd.z).normalize();
      const right = new THREE.Vector3(-flat.z, 0, flat.x);
      const want = flat
        .multiplyScalar((input.key("KeyW") ? 1 : 0) - (input.key("KeyS") ? 1 : 0))
        .addScaledVector(right, (input.key("KeyD") ? 1 : 0) - (input.key("KeyA") ? 1 : 0))
        .multiplyScalar(input.key("ShiftLeft", "ShiftRight") ? 90 : 30);
      want.y = ((input.key("KeyR") ? 1 : 0) - (input.key("KeyF") ? 1 : 0)) * 12;
      v.lerp(want, 1 - Math.exp(-1.1 * dt));
    } else {
      const thrust = (input.key("KeyW") ? 1 : 0) * (input.key("ShiftLeft", "ShiftRight") ? 60 : 15);
      v.addScaledVector(fwd, thrust * step);
      if (input.key("KeyS")) v.multiplyScalar(Math.exp(-0.4 * step));
      // A lifting body: in thick enough air the flight path follows the nose and lift holds it up.
      const lift = THREE.MathUtils.clamp((dens * speed) / 50, 0, 1);
      v.y -= 9.81 * step * (1 - lift * 0.95);
      const sp = v.length();
      v.lerp(fwd.clone().multiplyScalar(sp), 1 - Math.exp(-lift * 1.5 * step));
      v.multiplyScalar(Math.exp(-dens * 1.4e-5 * sp * step));
    }
    // Attitude: mouse and roll keys; TARS and hover mode keep it tidy.
    const m = input.mouse();
    if (this.tars || hover) {
      // Low down the Ranger stays level, facing where it's going (or where it was facing).
      const look = this.tars && v.lengthSq() > 4 && alt > 1500 ? v.clone() : this.tars && v.x * v.x + v.z * v.z > 4 ? new THREE.Vector3(v.x, 0, v.z) : new THREE.Vector3(fwd.x, 0, fwd.z);
      if (hover && !this.tars) look.applyAxisAngle(new THREE.Vector3(0, 1, 0), -m.dx * SENS);
      if (look.lengthSq() > 1e-6) {
        const target = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().lookAt(p, p.clone().add(look), new THREE.Vector3(0, 1, 0)));
        this.fq.slerp(target, 1 - Math.exp(-(hover ? 8 : 1.5) * dt));
      }
    } else {
      const roll = ((input.key("KeyA") ? 1 : 0) - (input.key("KeyD") ? 1 : 0)) * 1.4 * dt;
      this.fq.multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(-m.dy * SENS, -m.dx * SENS, roll, "YXZ")));
    }
    this.fq.normalize();
    p.addScaledVector(v, step);
    // Touchdown, or a hard arrival.
    if (p.y - height(p.x, p.z) < 1.2) {
      p.y = height(p.x, p.z) + 1.2;
      const soft = v.length() < 12;
      v.set(0, 0, 0);
      this.phase = "landed";
      // It sits in the corn: flatten what's under it.
      const f = new THREE.Vector3(fwd.x, 0, fwd.z).normalize();
      w.corn.flatten([-8, 0, 8].map((d) => ({ x: p.x + f.x * d, z: p.z + f.z * d, r: 9, amount: 1 })));
      if (!soft) {
        this.tars = false;
        ui.say("TARS", "That was more of an arrival than a landing. Let's try that again.");
        this.s.run(
          function* (this: LaunchChapter): Generator<Wait> {
            yield ui.fade(1, 1);
            yield 1;
            this.s.restart(true);
          }.bind(this),
        );
      }
    }
    this.flyer.group.position.copy(p);
    this.flyer.group.quaternion.copy(this.fq);
    this.flyer.update(dt, (input.key("KeyW") ? 1 : 0) + (hover ? 0.4 : 0), this.clock);
    // The heat of entry, blooming ahead of the nose.
    const heat = THREE.MathUtils.clamp(dens * Math.pow(speed / 1000, 3) * 2.5, 0, 1.4);
    (this.heat.material as THREE.SpriteMaterial).opacity = heat;
    this.heat.visible = heat > 0.01;
    if (speed > 1) this.heat.position.copy(p).addScaledVector(v.clone().normalize(), 10);
    this.heat.scale.setScalar(26 + heat * 30);
    // Camera.
    const up = new THREE.Vector3(0, 1, 0);
    if (this.cam === "nose") {
      camera.position.copy(p).add(new THREE.Vector3(0, 2.4, -5).applyQuaternion(this.fq));
      camera.quaternion.copy(this.fq);
      camera.up.copy(new THREE.Vector3(0, 1, 0).applyQuaternion(this.fq));
    } else {
      const back = v.lengthSq() > 25 && !hover ? v.clone().normalize() : fwd.clone().setY(0).normalize();
      const want = p.clone().addScaledVector(back, -55).addScaledVector(up, 14);
      want.y = Math.max(want.y, height(want.x, want.z) + 3);
      this.flyCam.lerp(want, 1 - Math.exp(-4 * dt));
      // Stay close behind at any speed (it can't lag kilometres behind at 2 km/s).
      if (this.flyCam.distanceTo(p) > 120) this.flyCam.copy(want);
      camera.position.copy(this.flyCam);
      camera.up.copy(up);
      camera.lookAt(p.clone().addScaledVector(fwd, 20));
    }
    if (camera.fov !== 60) {
      camera.fov = 60;
      camera.updateProjectionMatrix();
    }
    const cam = camera.position;
    ui.marker(new THREE.Vector3(lz.x, lz.y + 5 - dropFrom(cam.x, cam.z, lz.x, lz.z), lz.z), camera, "Home");
    ui.telemetry([
      ["Altitude", alt > 10000 ? `${(alt / 1000).toFixed(1)} km` : `${Math.round(alt)} m`],
      ["Speed", speed > 1000 ? `${(speed / 1000).toFixed(2)} km/s` : `${Math.round(speed)} m/s`],
      ["Farm", dist > 10000 ? `${Math.round(dist / 1000)} km` : `${Math.round(dist)} m`],
      ["Flying", this.tars ? "TARS" : hover ? "Cooper · hover" : "Cooper"],
      ["Warp", `×${WARPS[this.warp]}${high ? "" : " (held)"}`],
    ]);
    audio.rumble(THREE.MathUtils.clamp(heat * 0.6 + (input.key("KeyW") ? 0.15 : 0) + (hover ? 0.12 : 0), 0, 0.8), 0.3);
  }

  // --- Helpers -------------------------------------------------------------------------
  private setWarp(i: number) {
    this.warp = THREE.MathUtils.clamp(i, 0, WARPS.length - 1);
  }
  /** Where the stack is, and which way it points (world frame). */
  private placeRocket(f: Flight, cam: THREE.Vector3) {
    const y0 = height(PAD.x, PAD.z) + MOUNT_TOP;
    this.base.set(PAD.x + f.down, y0 + f.alt, PAD.z);
    // Seen from far away, it sits lower by the curve of the Earth.
    const drop = dropFrom(cam.x, cam.z, this.base.x, this.base.z);
    // Pitch over toward the east; the roll puts the crew heads-up in orbit.
    this.quat.setFromEuler(new THREE.Euler(0, 0, -f.pitch)).multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(0, -Math.PI / 2, 0)));
    this.rocket.group.position.copy(this.base).setY(this.base.y - drop);
    this.rocket.group.quaternion.copy(this.quat);
  }
  private stackUp() {
    return new THREE.Vector3(0, 1, 0).applyQuaternion(this.quat);
  }
  private stackPoint(y: number, z = 0) {
    return new THREE.Vector3(0, y, z).applyQuaternion(this.quat).add(this.rocket.group.position);
  }

  // --- Frame -----------------------------------------------------------------------------
  update(dt: number) {
    const { w, s } = this;
    const { ui, input, camera, audio } = s;
    this.clock += dt;
    if (!this.running) {
      w.update(dt, camera);
      return;
    }
    if (this.phase === "descent" || this.phase === "landed") {
      this.flyFrame(dt);
      w.update(dt, camera);
      return;
    }
    // Time warp (not during the dramatic parts).
    const calm = (this.t > 30 && this.t < 55) || (this.t > 90 && this.t < STAGING - 6) || (this.t > STAGING + 12 && this.t < SECO - 8) || this.phase === "orbit";
    if (input.hit("BracketRight")) this.setWarp(this.warp + 1);
    if (input.hit("BracketLeft")) this.setWarp(this.warp - 1);
    if (!calm && this.phase === "ascent") this.warp = 0;
    const k = this.phase === "dock" || this.phase === "docked" ? 1 : WARPS[this.warp];
    const step = dt * k;
    const prev = this.t;
    this.t += step;
    const t = this.t;

    // Events.
    if (prev < -3 && t >= -3) audio.thud(3);
    if (prev < STAGING && t >= STAGING) {
      this.stagedAt = STAGING;
      audio.thud(5);
      this.shake += 3;
    }
    if (prev < SECO + 6 && t >= SECO + 6) {
      this.rangerSepAt = SECO + 6;
      audio.thud(2.5);
    }
    this.lines(prev, t);

    // Engines.
    const s1 = t >= -3 && t < STAGING ? THREE.MathUtils.clamp((t + 3) / 2, 0, 1) * (t > 55 && t < 80 ? 0.72 : 1) : 0;
    const s2 = t >= STAGING + 3 && t < SECO ? Math.min(1, (t - STAGING - 3) / 1.5) : 0;
    const f = flight(t);
    // The Ranger and the stack share one frame; after separation the stages drift away.
    this.placeRocket(f, camera.position);
    this.rocket.engines(s1, s2, f.alt, this.clock);
    this.site.swing(THREE.MathUtils.smoothstep(t, -8, -4));
    if (this.stagedAt >= 0) {
      const u = t - this.stagedAt;
      this.rocket.lower.position.y = -(3 * u + 0.5 * 18 * u * u);
      this.rocket.lower.rotation.x = u * 0.05;
      this.rocket.lower.rotation.z = u * 0.03;
      this.rocket.lower.visible = u < 40;
    }
    if (this.rangerSepAt >= 0) {
      const u = t - this.rangerSepAt;
      this.rocket.upper.position.y = -(0.6 * u);
      this.rocket.upper.rotation.x = u * 0.01;
      this.rocket.upper.visible = u < 120;
    }
    this.rocket.ranger.update(dt, this.phase === "dock" ? Math.max(0, this.relV.x) * 0.1 : 0, this.clock);

    // Smoke: the trench blast at the pad, then a column behind the rising stack.
    const pad = new THREE.Vector3(PAD.x, height(PAD.x, PAD.z), PAD.z);
    if (t > -3 && t < 25) {
      this.smoke.emit(260 * Math.min(1, s1), step, () => {
        const side = Math.random() < 0.5 ? -1 : 1;
        return {
          p: new THREE.Vector3(PAD.x + side * (30 + Math.random() * 8), pad.y + 3, PAD.z + (Math.random() - 0.5) * 8),
          v: new THREE.Vector3(side * (28 + Math.random() * 20), 4 + Math.random() * 6, (Math.random() - 0.5) * 14),
          size: 10 + Math.random() * 10,
          life: 40 + Math.random() * 25,
        };
      });
    }
    if (s1 > 0 && f.alt < 4000 && t > 0) {
      this.smoke.emit(90, step, () => {
        const p = this.stackPoint(-8 - Math.random() * 30);
        const back = this.stackUp().multiplyScalar(-20 - Math.random() * 20);
        return { p, v: back.add(new THREE.Vector3((Math.random() - 0.5) * 6, 0, (Math.random() - 0.5) * 6)), size: 7 + Math.random() * 6, life: 70 + Math.random() * 30 };
      });
    }
    this.smoke.glow(this.stackPoint(-10), s1 * Math.exp(-f.alt / 400));
    this.smoke.update(step, pad.y);

    // Orbit: the Endurance ahead on the same orbit; docking flies the Ranger relative to it.
    if (this.phase === "orbit" || this.phase === "dock" || this.phase === "docked") this.orbitFrame(dt);

    // Camera.
    if (input.hit("KeyC")) {
      const order: Cam[] = this.phase === "ascent" ? ["ground", "chase", "nose"] : ["nose", "chase"];
      this.cam = order[(order.indexOf(this.cam) + 1) % order.length];
      this.camFree.yaw = this.camFree.pitch = 0;
    }
    if (this.phase === "ascent" && t > 26 && t - step <= 26 && this.cam === "ground") this.cam = "chase";
    const m = input.mouse();
    this.camFree.yaw = THREE.MathUtils.clamp(this.camFree.yaw - m.dx * SENS, -2.5, 2.5);
    this.camFree.pitch = THREE.MathUtils.clamp(this.camFree.pitch - m.dy * SENS, -1.2, 1.2);
    const q = THREE.MathUtils.clamp((f.speed / 450) * Math.exp(-Math.abs(t - 68) / 14), 0, 1);
    this.shake = THREE.MathUtils.damp(this.shake, 0, 2, dt);
    const buzz = (s1 * (0.5 + 1.8 * q) + s2 * 0.15) * (this.cam === "nose" ? 1 : 0.4) + this.shake;
    this.placeCamera(buzz, dt);

    // Sound: a roar that thins to a rumble felt through the seat as the air goes.
    const air = Math.exp(-f.alt / 12000);
    const near = this.cam === "ground" ? Math.min(1, 1600 / Math.max(400, camera.position.distanceTo(this.rocket.group.position))) : 1;
    audio.rumble(Math.max(s1 * (0.3 + 0.7 * air) * near + s2 * 0.25, t < 0 && t > -3 ? 0.4 : 0), 0.3);

    // HUD.
    if (this.phase === "ascent" && t >= 0)
      ui.telemetry([
        ["T+", `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, "0")}`],
        ["Altitude", f.alt < 10000 ? `${(f.alt / 1000).toFixed(2)} km` : `${(f.alt / 1000).toFixed(1)} km`],
        ["Speed", f.speed < 1000 ? `${Math.round(f.speed)} m/s` : `${(f.speed / 1000).toFixed(2)} km/s`],
        ["Downrange", `${Math.round(f.down / 1000)} km`],
        ["Stage", t < STAGING ? "1" : t < SECO ? "2" : "—"],
        ["Warp", `×${WARPS[this.warp]}${calm ? "" : " (held)"}`],
      ]);
    else if (this.phase === "ascent") ui.telemetry([["T−", `0:${String(Math.ceil(-t)).padStart(2, "0")}`]]);
    else if (this.phase === "orbit")
      ui.telemetry([
        ["Orbit", `${(f.alt / 1000).toFixed(0)} km · ${(f.speed / 1000).toFixed(2)} km/s`],
        ["Endurance", `${(this.endurance.group.position.x - this.stackPoint(STACK.top).x - 12.2).toFixed(0)} m ahead`],
        ["Warp", `×${WARPS[this.warp]}`],
      ]);
    w.update(dt, camera);
  }

  /** Mission-control and crew lines on the way up. */
  private lines(prev: number, t: number) {
    const at = (x: number) => prev < x && t >= x;
    const { ui, audio } = this.s;
    const mc = (text: string) => {
      audio.radio();
      ui.say("Mission control", text, 1.8);
    };
    if (at(-7)) mc("T minus seven. Crew access arm retracting.");
    if (at(-3)) mc("Ignition sequence start.");
    if (at(-1.5)) ui.say("Mission control", "Two. One.", 1.4);
    if (at(0)) mc("Zero. Liftoff.");
    if (at(9)) mc("Tower cleared. Ranger, the vehicle is yours.");
    if (at(13)) ui.say("Cooper", "Copy. Roll program.");
    if (at(17)) ui.say("TARS", "Rolling. For the record, I'd rate this ride four stars. Out of ten.");
    if (at(50)) ui.say("Doyle", "Coming up on max Q.");
    if (at(58)) ui.say("Cooper", "Here it comes. Hold on to something.");
    if (at(84)) ui.say("TARS", "Through max Q. Throttling back up.");
    if (at(STAGING - 4)) ui.say("Cooper", "Stand by for staging.");
    if (at(STAGING)) ui.say("TARS", "Separation.");
    if (at(STAGING + 3)) ui.say("Cooper", "Second stage ignition. Good light.");
    if (at(205)) ui.say("Romilly", "Look at the sky. It's black.");
    if (at(214)) ui.say("Cooper", "Never gets old.");
    if (at(330)) ui.say("Brand", "We're over the Great Lakes already.");
    if (at(SECO - 5)) ui.say("Cooper", "Cut-off in five.");
    if (at(SECO)) ui.say("TARS", "Engine cut-off. Welcome to orbit.");
    if (at(SECO + 6)) ui.say("Cooper", "Separating from the stage.");
  }

  /** Orbital phase: the Endurance and (while docking) the Ranger flown relative to it. */
  private orbitFrame(dt: number) {
    const { input, ui } = this.s;
    // Everything rides along the orbit together: the anchor is where the flight puts the
    // Ranger's nose. The Endurance starts 2 km ahead, closing at 12 m/s.
    const anchor = this.stackPoint(STACK.top);
    const ahead = this.phase === "orbit" ? Math.max(260, 2000 - (this.t - SECO - 8) * 12) : 0;
    const e = this.endurance.group;
    e.visible = true;
    e.rotation.set(0, -Math.PI / 2, 0);
    this.endurance.update(dt, 0, 0, this.clock);
    e.position.copy(anchor).add(new THREE.Vector3(ahead + 12.2, 0, 0));
    if (this.phase === "orbit") {
      if (ahead <= 260) this.phase = "dock";
      return;
    }
    // Docking: the port on the Endurance's stern faces back along -x.
    if (this.phase === "dock") {
      const a = 0.25;
      if (this.auto) {
        // TARS: null the offsets, then close at a gentle rate.
        const want = new THREE.Vector3(Math.min(2.5, Math.max(0.25, -this.rel.x * 0.05)), -this.rel.y * 0.3, -this.rel.z * 0.3);
        this.relV.lerp(want, 1 - Math.exp(-1.2 * dt));
      } else {
        this.relV.x += (input.key("KeyW") ? a : 0) * dt - (input.key("KeyS") ? a : 0) * dt;
        this.relV.z += (input.key("KeyD") ? a : 0) * dt - (input.key("KeyA") ? a : 0) * dt;
        this.relV.y += (input.key("KeyR") ? a : 0) * dt - (input.key("KeyF") ? a : 0) * dt;
      }
      if (input.hit("KeyT") && !this.auto) {
        this.auto = true;
        ui.say("TARS", "Taking it in.");
      }
      this.rel.addScaledVector(this.relV, dt);
      const off = Math.hypot(this.rel.y, this.rel.z);
      if (this.rel.x >= -0.05) {
        if (this.relV.x < 0.55 && off < 0.4) {
          this.rel.set(0, 0, 0);
          this.relV.set(0, 0, 0);
          this.phase = "docked";
        } else {
          // Bounced off the collar.
          this.rel.x = -0.3;
          this.relV.x = -Math.abs(this.relV.x) * 0.4;
          this.bumps++;
          this.s.audio.thud(3);
          ui.say("TARS", this.relV.x < -0.2 ? "Too fast. Back off and try again." : "Off the line. Back off, line it up.");
        }
      }
      const good = this.relV.x < 0.55 && off < 0.4;
      if (this.dockEl) {
        const dot = this.dockEl.querySelector("i") as HTMLElement;
        const px = THREE.MathUtils.clamp(this.rel.z * 12, -72, 72),
          py = THREE.MathUtils.clamp(-this.rel.y * 12, -72, 72);
        dot.style.transform = `translate(${px}px, ${py}px)`;
        this.dockEl.classList.toggle("bad", !good && -this.rel.x < 40);
      }
      ui.telemetry([
        ["Range", `${(-this.rel.x).toFixed(1)} m`],
        ["Closing", `${this.relV.x.toFixed(2)} m/s`],
        ["Offset", `${off.toFixed(2)} m`],
        ["Pilot", this.auto ? "TARS" : "Cooper"],
      ]);
    }
    // Put the Ranger (the stack frame) so its nose sits at the port + rel.
    this.rocket.group.position.add(this.rel);
  }

  private placeCamera(buzz: number, dt: number) {
    const cam = this.s.camera;
    const tm = this.clock;
    const jitter = new THREE.Vector3(Math.sin(tm * 43) * Math.sin(tm * 17), Math.sin(tm * 37 + 1) * Math.sin(tm * 13), Math.sin(tm * 29 + 2)).multiplyScalar(buzz * 0.06);
    const free = new THREE.Quaternion().setFromEuler(new THREE.Euler(this.camFree.pitch, this.camFree.yaw, 0, "YXZ"));
    let fov = 50;
    if (this.cam === "ground") {
      // A long lens on a stand at the edge of a cornfield, 1.3 km from the pad.
      const pos = new THREE.Vector3(PAD.x - 1100, 0, PAD.z + 720);
      pos.y = height(pos.x, pos.z) + 3.1;
      const target = this.stackPoint(STACK.top * 0.55);
      cam.position.copy(pos);
      cam.up.set(0, 1, 0);
      cam.lookAt(target);
      cam.quaternion.multiply(free);
      const dist = pos.distanceTo(target);
      fov = THREE.MathUtils.clamp(THREE.MathUtils.radToDeg(2 * Math.atan(220 / dist)), 1.2, 30);
    } else if (this.cam === "chase") {
      // Below and behind, looking up the plume at the stack against the sky.
      const up = this.stackUp();
      const side = new THREE.Vector3(0, 0, 1);
      const pos = this.stackPoint(-60).addScaledVector(side, 70).add(new THREE.Vector3(0, -10, 0));
      pos.y = Math.max(pos.y, height(pos.x, pos.z) + 25);
      if (this.phase !== "ascent") pos.copy(this.stackPoint(10)).addScaledVector(side, 60).add(new THREE.Vector3(-40, 25, 0));
      cam.position.copy(pos);
      cam.up.copy(this.phase === "ascent" ? new THREE.Vector3(0, 1, 0).lerp(up, 0.3).normalize() : new THREE.Vector3(0, 1, 0));
      cam.lookAt(this.stackPoint(STACK.top * 0.6));
      cam.quaternion.multiply(free);
      fov = 55;
    } else {
      // Just above the Ranger's canopy, looking along the nose.
      const pos = this.stackPoint(STACK.adapter + 16, 2.6);
      cam.position.copy(pos);
      const fwd = this.stackUp();
      const top = new THREE.Vector3(0, 0, 1).applyQuaternion(this.quat);
      const m = new THREE.Matrix4().lookAt(pos, pos.clone().add(fwd), top);
      cam.quaternion.setFromRotationMatrix(m);
      cam.up.copy(top);
      cam.quaternion.multiply(free);
      fov = 62;
    }
    cam.position.add(jitter);
    this.fov = THREE.MathUtils.damp(this.fov, fov, 4, dt);
    if (Math.abs(cam.fov - this.fov) > 0.01) {
      cam.fov = this.fov;
      cam.updateProjectionMatrix();
    }
  }
}
