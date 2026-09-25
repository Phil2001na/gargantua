import * as THREE from "three";
import { height, cornAt, roadDist } from "./land";
import type { Colliders } from "./collide";
import { person, CAST, type Person } from "./people";

/**
 * The farm pickup: a stylised early-2000s truck and an arcade driving model
 * (grip that depends on the surface, drag through the corn, real falls off edges).
 * Local frame: +z forward, driver on the left (+x), origin on the ground between the axles.
 */

export type DriveInput = { throttle: number; brake: number; steer: number; handbrake: boolean };

const WHEELBASE = 3.3,
  TRACK = 1.7,
  WHEEL_R = 0.4;

export class Truck {
  readonly group = new THREE.Group();
  readonly body = new THREE.Group();
  readonly cooper: Person;
  readonly tom: Person;
  readonly murph: Person;
  readonly pos = new THREE.Vector3();
  heading = 0;
  readonly vel = new THREE.Vector2();
  vy = 0;
  steer = 0;
  airborne = false;
  /** Signed speed along the truck's nose, m/s. */
  speed = 0;
  /** 0..1: how hard the truck is ploughing through corn right now. */
  cornLoad = 0;
  /** Surface the wheels are on: 0 road, 1 dirt/grass, 2 corn. */
  surface = 1;
  /** Last collision strength, m/s (read and cleared by the caller). */
  impact = 0;
  /** Vertical landing speed of the last touchdown. */
  landing = 0;
  private wheels: { pivot: THREE.Group; spin: THREE.Group; front: boolean; x: number; z: number }[] = [];
  private pitch = 0;
  private roll = 0;
  private lean = 0;
  private squat = 0;
  private spin = 0;
  private headlights: THREE.Mesh[] = [];
  constructor() {
    const paint = new THREE.MeshStandardMaterial({ color: 0x6b7780, roughness: 0.5, metalness: 0.2 }),
      dark = new THREE.MeshStandardMaterial({ color: 0x1c1d1f, roughness: 0.8 }),
      chrome = new THREE.MeshStandardMaterial({ color: 0x9a9ea3, roughness: 0.3, metalness: 0.9 }),
      glass = new THREE.MeshStandardMaterial({ color: 0x0f1418, roughness: 0.08, metalness: 0.5, transparent: true, opacity: 0.55 }),
      rubber = new THREE.MeshStandardMaterial({ color: 0x151515, roughness: 0.95 }),
      dust = new THREE.MeshStandardMaterial({ color: 0x8a7d68, roughness: 1 });
    const part = (w: number, h: number, d: number, m: THREE.Material, x: number, y: number, z: number) => {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
      mesh.position.set(x, y, z);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      this.body.add(mesh);
      return mesh;
    };
    // Frame, hood, grille, bumpers.
    part(1.6, 0.25, 5.0, dark, 0, 0.55, -0.2);
    part(1.84, 0.52, 1.75, paint, 0, 1.02, 1.55);
    part(1.7, 0.08, 1.6, paint, 0, 1.3, 1.52).rotation.x = 0.04;
    part(1.6, 0.42, 0.08, chrome, 0, 0.98, 2.44);
    part(1.9, 0.2, 0.22, chrome, 0, 0.66, 2.52);
    part(1.9, 0.2, 0.2, chrome, 0, 0.7, -2.86);
    for (const x of [0.62, -0.62]) {
      const lamp = part(0.3, 0.2, 0.05, new THREE.MeshStandardMaterial({ color: 0xfff1d0, emissive: 0xffe0a0, emissiveIntensity: 0.2 }), x, 1.05, 2.47);
      this.headlights.push(lamp);
      part(0.2, 0.25, 0.04, new THREE.MeshStandardMaterial({ color: 0x5a0f0f, emissive: 0x400000 }), x * 1.38, 1.05, -2.84);
    }
    // Cab: lower body, roof, pillars and windows.
    part(1.9, 0.6, 1.75, paint, 0, 1.05, 0.05);
    part(1.76, 0.08, 1.4, paint, 0, 1.96, -0.05);
    for (const x of [0.86, -0.86]) {
      part(0.06, 0.62, 0.08, paint, x, 1.65, 0.62).rotation.x = -0.35;
      part(0.06, 0.62, 0.08, paint, x, 1.65, -0.72);
      part(0.03, 0.5, 1.2, glass, x, 1.63, -0.03);
    }
    const shield = part(1.72, 0.66, 0.03, glass, 0, 1.64, 0.68);
    shield.rotation.x = -0.35;
    part(1.72, 0.55, 0.03, glass, 0, 1.63, -0.76);
    // Bed.
    part(1.8, 0.08, 2.05, dark, 0, 0.86, -1.8);
    for (const x of [0.88, -0.88]) part(0.07, 0.52, 2.05, paint, x, 1.12, -1.8);
    part(1.8, 0.52, 0.07, paint, 0, 1.12, -2.8);
    part(1.8, 0.52, 0.07, paint, 0, 1.12, -0.8);
    // Fenders, with a layer of dust.
    for (const [x, z] of [
      [0.9, 1.65],
      [-0.9, 1.65],
      [0.9, -1.65],
      [-0.9, -1.65],
    ]) {
      part(0.24, 0.1, 1.05, paint, x * 1.02, 1.03, z);
      part(0.22, 0.02, 1.0, dust, x * 1.02, 1.085, z);
    }
    // A spare tyre and junk in the bed.
    const spare = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.12, 8, 16), rubber);
    spare.rotation.x = Math.PI / 2;
    spare.position.set(0.3, 1.0, -2.1);
    this.body.add(spare);
    part(0.5, 0.35, 0.4, new THREE.MeshStandardMaterial({ color: 0x6e5a40, roughness: 1 }), -0.4, 1.07, -1.4);
    // Wheels.
    const tyre = new THREE.CylinderGeometry(WHEEL_R, WHEEL_R, 0.3, 18).rotateZ(Math.PI / 2);
    const rim = new THREE.CylinderGeometry(WHEEL_R * 0.55, WHEEL_R * 0.55, 0.32, 10).rotateZ(Math.PI / 2);
    for (const [x, z] of [
      [TRACK / 2, WHEELBASE / 2],
      [-TRACK / 2, WHEELBASE / 2],
      [TRACK / 2, -WHEELBASE / 2],
      [-TRACK / 2, -WHEELBASE / 2],
    ]) {
      const pivot = new THREE.Group(),
        spin = new THREE.Group();
      pivot.position.set(x, WHEEL_R, z);
      const t = new THREE.Mesh(tyre, rubber),
        r = new THREE.Mesh(rim, chrome);
      t.castShadow = true;
      spin.add(t, r);
      pivot.add(spin);
      this.group.add(pivot);
      this.wheels.push({ pivot, spin, front: z > 0, x, z });
    }
    // Bench seat, Cooper driving (left), Murph in the middle, Tom on the right.
    part(1.7, 0.18, 0.5, new THREE.MeshStandardMaterial({ color: 0x5a4a3a, roughness: 1 }), 0, 1.0, -0.4);
    part(1.7, 0.6, 0.12, new THREE.MeshStandardMaterial({ color: 0x5a4a3a, roughness: 1 }), 0, 1.35, -0.66);
    const seat = (s: typeof CAST.cooper, x: number) => {
      const p = person(s, true);
      const k = s.height / 1.8;
      p.root.position.set(x, 1.1 - 0.45 * k, -0.42);
      this.body.add(p.root);
      return p;
    };
    this.cooper = seat(CAST.cooper, 0.42);
    this.murph = seat(CAST.murph, 0.02);
    this.tom = seat(CAST.tom, -0.44);
    this.cooper.armL.rotation.x = this.cooper.armR.rotation.x = -1.2;
    // Steering wheel.
    const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.19, 0.02, 6, 20), dark);
    wheel.position.set(0.42, 1.3, 0.34);
    wheel.rotation.x = -0.9;
    this.body.add(wheel);
    this.group.add(this.body);
  }
  /** Driver's eye, in truck-local coordinates. */
  static readonly EYE = new THREE.Vector3(0.42, 1.72, -0.35);

  place(x: number, z: number, heading: number) {
    this.pos.set(x, height(x, z), z);
    this.heading = heading;
    this.vel.set(0, 0);
    this.vy = 0;
    this.speed = 0;
    this.steer = 0;
    this.airborne = false;
    this.sync(0);
  }
  forward() {
    return new THREE.Vector2(Math.sin(this.heading), Math.cos(this.heading));
  }
  /** World position of a truck-local point (ignores body tilt). */
  local(x: number, z: number) {
    const s = Math.sin(this.heading),
      c = Math.cos(this.heading);
    return new THREE.Vector2(this.pos.x + x * c + z * s, this.pos.z - x * s + z * c);
  }
  update(dt: number, input: DriveInput, colliders: Colliders) {
    const f = this.forward(),
      r = new THREE.Vector2(-f.y, f.x); // right
    let vLong = this.vel.dot(f),
      vLat = this.vel.dot(r);
    const corn = cornAt(this.pos.x, this.pos.z),
      road = roadDist(this.pos.x, this.pos.z) < 3.8;
    this.surface = corn ? 2 : road ? 0 : 1;
    this.cornLoad = THREE.MathUtils.damp(this.cornLoad, corn * Math.min(1, Math.abs(vLong) / 12), 6, dt);
    if (!this.airborne) {
      let a = 0;
      if (input.throttle > 0) a += vLong < -0.5 ? 11 * input.throttle : input.throttle * (7.2 * Math.max(0, 1 - vLong / 38) + 0.5);
      if (input.brake > 0) a -= vLong > 0.5 ? 11 * input.brake : input.brake * 4.5 * Math.max(0, 1 + vLong / 9);
      const sign = Math.sign(vLong);
      const drag = (road ? 0.25 : 0.5) + 0.0028 * vLong * vLong + corn * (0.8 + 0.0062 * vLong * vLong);
      a -= sign * drag;
      if (input.handbrake) a -= sign * 7;
      const before = vLong;
      vLong += a * dt;
      if (Math.sign(vLong) !== Math.sign(before) && !input.throttle && !input.brake) vLong = 0;
      if (!input.throttle && !input.brake && Math.abs(vLong) < 0.25) vLong = 0;
      const grip = input.handbrake ? 1.6 : road ? 9 : corn ? 6.5 : 5.5;
      vLat *= Math.exp(-grip * dt);
      const maxSteer = 0.6 / (1 + Math.abs(vLong) / 13);
      this.steer = THREE.MathUtils.damp(this.steer, input.steer * maxSteer, 7, dt);
      this.heading += (vLong / WHEELBASE) * Math.tan(this.steer) * dt;
    }
    const nf = this.forward(),
      nr = new THREE.Vector2(-nf.y, nf.x);
    if (!this.airborne) this.vel.copy(nf).multiplyScalar(vLong).addScaledVector(nr, vLat);
    this.speed = this.vel.dot(nf);
    this.pos.x += this.vel.x * dt;
    this.pos.z += this.vel.y * dt;

    // Collide three body circles with the farm (fences and porches are driven over).
    for (const zc of [1.6, 0, -1.6]) {
      const c = this.local(0, zc),
        p = { x: c.x, z: c.y };
      const hit = colliders.resolve(p, 1.05, this.pos.y, 1.3, true);
      if (hit) {
        this.pos.x += p.x - c.x;
        this.pos.z += p.z - c.y;
        const vn = this.vel.x * hit.nx + this.vel.y * hit.nz;
        if (vn < 0) {
          this.vel.x -= hit.nx * vn * 1.25;
          this.vel.y -= hit.nz * vn * 1.25;
          this.impact = Math.max(this.impact, -vn);
        }
      }
    }

    // Suspension: the body follows the ground under the four wheels.
    const hs = this.wheels.map((w) => {
      const p = this.local(w.x, w.z);
      return height(p.x, p.y);
    });
    const ground = (hs[0] + hs[1] + hs[2] + hs[3]) / 4;
    if (this.airborne) {
      this.vy -= 9.81 * dt;
      this.pos.y += this.vy * dt;
      if (this.pos.y <= ground) {
        this.landing = -this.vy;
        this.pos.y = ground;
        this.vy = 0;
        this.airborne = false;
      }
    } else if (ground < this.pos.y - 0.35 && this.vy - 9.81 * dt > (ground - this.pos.y) / dt) {
      // The ground fell away faster than gravity can follow: we're flying.
      this.airborne = true;
      this.vy -= 9.81 * dt;
      this.pos.y += this.vy * dt;
    } else {
      this.vy = dt > 0 ? THREE.MathUtils.clamp((ground - this.pos.y) / dt, -30, 30) : 0;
      this.pos.y = ground;
    }
    const tp = Math.atan2((hs[0] + hs[1]) / 2 - (hs[2] + hs[3]) / 2, WHEELBASE),
      tr = Math.atan2((hs[0] + hs[2]) / 2 - (hs[1] + hs[3]) / 2, TRACK);
    if (!this.airborne) {
      this.pitch = THREE.MathUtils.damp(this.pitch, tp, 10, dt);
      this.roll = THREE.MathUtils.damp(this.roll, tr, 10, dt);
    } else this.pitch = THREE.MathUtils.damp(this.pitch, -0.35, 0.8, dt);
    const latAccel = (vLong * vLong * Math.tan(this.steer)) / WHEELBASE;
    this.lean = THREE.MathUtils.damp(this.lean, THREE.MathUtils.clamp(latAccel * 0.006, -0.06, 0.06), 5, dt);
    this.squat = THREE.MathUtils.damp(this.squat, (input.throttle - input.brake) * 0.02 * (this.airborne ? 0 : 1), 4, dt);
    this.spin += (this.speed / WHEEL_R) * dt;
    this.sync(dt);
  }
  private sync(_dt: number) {
    this.group.position.copy(this.pos);
    // Bumps when off the road: ruts between corn rows and clods of dirt.
    const rough = this.surface === 0 ? 0.004 : 0.02;
    const t = performance.now() / 1000;
    const bump = Math.sin(t * 23 + this.pos.x) * Math.sin(t * 17) * rough * Math.min(1, Math.abs(this.speed) / 10);
    this.group.rotation.set(0, 0, 0);
    this.group.rotation.order = "YXZ";
    this.group.rotation.y = this.heading;
    this.group.rotation.x = -this.pitch;
    this.group.rotation.z = this.roll;
    this.body.position.y = bump;
    this.body.rotation.set(-this.squat + bump * 0.5, 0, this.lean);
    for (const w of this.wheels) {
      w.spin.rotation.x = this.spin;
      if (w.front) w.pivot.rotation.y = this.steer;
    }
  }
  /** Headlights: the lenses glow, a spotlight lights ordinary meshes, and the world shaders read `lampsOn`. */
  lampsOn = false;
  readonly spot = (() => {
    const s = new THREE.SpotLight(0xffe6c0, 0, 90, 0.5, 0.45, 1.6);
    s.position.set(0, 1.05, 2.5);
    s.target.position.set(0, 0.2, 12);
    this.body.add(s, s.target);
    return s;
  })();
  headlightsOn(on: boolean) {
    this.lampsOn = on;
    this.spot.intensity = on ? 90 : 0;
    for (const h of this.headlights) (h.material as THREE.MeshStandardMaterial).emissiveIntensity = on ? 3 : 0.2;
  }
}
