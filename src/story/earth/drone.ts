import * as THREE from "three";
import { solarCells } from "./textures";
import { height, cornAt } from "./land";

/**
 * A lost solar surveillance drone: a 16 m high-aspect wing covered in cells, still
 * flying its patrol a decade after anyone stopped listening. It follows a path over
 * the corn toward the reservoir, keeping just ahead of whoever is chasing it.
 */

const PATH = [
  [-420, 80, -170],
  [-120, 62, -40],
  [150, 44, 45],
  [420, 32, 170],
  [700, 30, 300],
  [950, 27, 210],
  [1180, 26, 320],
  [1400, 24, 250],
  [1580, 26, 215],
  [1660, 22, 170],
].map(([x, y, z]) => new THREE.Vector3(x, y, z));

export class Drone {
  readonly group = new THREE.Group();
  readonly curve = new THREE.CatmullRomCurve3(PATH, false, "centripetal");
  readonly length: number;
  /** Distance travelled along the path, metres. */
  s = 0;
  speed = 20;
  /** Cruise speed when nobody is chasing. */
  cruise = 20;
  /** After the path: circling over the reservoir. */
  loiter = 0;
  readonly loiterCentre = new THREE.Vector3(1640, 20, 215);
  readonly loiterRadius = 85;
  private props: THREE.Object3D[] = [];
  private shadow: THREE.Mesh;
  private bank = 0;
  private lights: THREE.Mesh[] = [];
  /** When set, the drone flies this override instead (landing under remote control). */
  override: { pos: THREE.Vector3; yaw: number; pitch: number } | null = null;
  constructor(scene: THREE.Object3D) {
    this.length = this.curve.getLength();
    const white = new THREE.MeshStandardMaterial({ color: 0xd9dcdf, roughness: 0.5, metalness: 0.2 }),
      grey = new THREE.MeshStandardMaterial({ color: 0x6d7278, roughness: 0.5, metalness: 0.4 }),
      cells = new THREE.MeshStandardMaterial({ map: solarCells(), roughness: 0.25, metalness: 0.5 }),
      lens = new THREE.MeshStandardMaterial({ color: 0x0a0c10, roughness: 0.05, metalness: 0.9 });
    (cells.map as THREE.Texture).repeat.set(8, 1);
    const wingMats = [white, white, cells, white, white, white];
    for (const s of [1, -1]) {
      const half = new THREE.Mesh(new THREE.BoxGeometry(8, 0.12, 1.4), wingMats);
      half.position.set(s * 4, 0.14, 0);
      half.rotation.z = s * 0.06;
      half.castShadow = true;
      const tip = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.7, 0.9), white);
      tip.position.set(s * 8, 0.62, -0.1);
      const light = new THREE.Mesh(
        new THREE.SphereGeometry(0.07, 8, 6),
        new THREE.MeshBasicMaterial({ color: s > 0 ? 0xff3322 : 0x33ff66 }),
      );
      light.position.set(s * 8.02, 0.62, 0.35);
      this.lights.push(light);
      this.group.add(half, tip, light);
      // Propellers on the leading edge.
      const prop = new THREE.Group();
      prop.position.set(s * 3.2, 0.3, 0.95);
      const nacelle = new THREE.Mesh(new THREE.CapsuleGeometry(0.12, 0.6, 4, 8).rotateX(Math.PI / 2), grey);
      nacelle.position.z = -0.25;
      const blades = new THREE.Group();
      for (let i = 0; i < 2; i++) {
        const b = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.08, 0.02), grey);
        b.rotation.z = i * Math.PI;
        b.position.x = 0;
        blades.add(b);
      }
      blades.position.z = 0.15;
      prop.add(nacelle, blades);
      this.props.push(blades);
      this.group.add(prop);
    }
    // Pod, sensor ball, tail boom and tail.
    const pod = new THREE.Mesh(new THREE.CapsuleGeometry(0.34, 2.0, 6, 12).rotateX(Math.PI / 2), white);
    pod.position.set(0, -0.1, 0.3);
    const ball = new THREE.Mesh(new THREE.SphereGeometry(0.28, 16, 12), lens);
    ball.position.set(0, -0.45, 1.0);
    const boom = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.09, 5, 8).rotateX(Math.PI / 2), white);
    boom.position.set(0, 0.05, -3.2);
    const tailH = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.06, 0.7), white);
    tailH.position.set(0, 0.1, -5.5);
    const tailV = new THREE.Mesh(new THREE.BoxGeometry(0.06, 1.1, 0.8), white);
    tailV.position.set(0, 0.6, -5.5);
    for (const m of [pod, ball, boom, tailH, tailV]) {
      m.castShadow = true;
      this.group.add(m);
    }
    scene.add(this.group);
    // Soft shadow cast on the ground or the corn tops (it helps you judge where it is).
    const c = document.createElement("canvas");
    c.width = 128;
    c.height = 32;
    const g = c.getContext("2d")!;
    const grad = g.createRadialGradient(64, 16, 2, 64, 16, 64);
    grad.addColorStop(0, "rgba(0,0,0,.55)");
    grad.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = grad;
    g.fillRect(0, 0, 128, 32);
    this.shadow = new THREE.Mesh(
      new THREE.PlaneGeometry(17, 4).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false }),
    );
    scene.add(this.shadow);
  }
  /** World position at path distance s (after the end, the loiter circle). */
  at(s: number, out = new THREE.Vector3()) {
    if (s <= this.length) return this.curve.getPointAt(THREE.MathUtils.clamp(s / this.length, 0, 1), out);
    const a = (s - this.length) / this.loiterRadius + 0.9;
    return out.set(
      this.loiterCentre.x + Math.cos(a) * this.loiterRadius,
      this.loiterCentre.y,
      this.loiterCentre.z - Math.sin(a) * this.loiterRadius,
    );
  }
  get position() {
    return this.group.position;
  }
  get onPath() {
    return this.s < this.length;
  }
  /** Keep ahead of the chaser: slow when they fall back, faster when they close in. */
  update(dt: number, t: number, chaser: THREE.Vector3 | null, sunDir: THREE.Vector3, moving = true) {
    for (const p of this.props) p.rotation.z += dt * 40;
    for (const l of this.lights) l.visible = Math.sin(t * 6) > 0.6;
    if (this.override) {
      this.group.position.copy(this.override.pos);
      this.group.rotation.set(this.override.pitch, this.override.yaw, 0, "YXZ");
    } else {
      if (moving) {
        let want = this.cruise;
        if (chaser) {
          const d = Math.hypot(this.position.x - chaser.x, this.position.z - chaser.z);
          // Always catchable: slower than the truck in the corn (~18 m/s) when you fall back,
          // pulling away only when you're right underneath.
          want = d > 110 ? THREE.MathUtils.clamp(14 * (110 / d), 6, 14) : d < 55 ? 21 : 16.5;
          if (!this.onPath) want = 16;
        }
        this.speed = THREE.MathUtils.damp(this.speed, want, 1.5, dt);
        this.s += this.speed * dt;
      }
      const p = this.at(this.s),
        ahead = this.at(this.s + 8);
      const yaw = Math.atan2(ahead.x - p.x, ahead.z - p.z);
      const prevYaw = this.group.rotation.y;
      let dYaw = yaw - prevYaw;
      dYaw = Math.atan2(Math.sin(dYaw), Math.cos(dYaw));
      this.bank = THREE.MathUtils.damp(this.bank, THREE.MathUtils.clamp((-dYaw / Math.max(dt, 1e-3)) * 0.9, -0.5, 0.5), 2, dt);
      this.group.position.copy(p);
      this.group.position.y += Math.sin(t * 0.7) * 0.6;
      this.group.rotation.set(Math.atan2(p.y - ahead.y, 8) * 0.5, yaw, this.bank, "YXZ");
    }
    // Cast along the low morning sun: the shadow lands well to the west of the drone.
    const q = this.group.position;
    const alt0 = q.y - height(q.x, q.z);
    const sx = q.x - (sunDir.x / sunDir.y) * alt0,
      sz = q.z - (sunDir.z / sunDir.y) * alt0;
    const ground = height(sx, sz) + cornAt(sx, sz) * 2.55;
    const alt = q.y - ground;
    this.shadow.position.set(sx, ground + 0.15, sz);
    this.shadow.rotation.y = this.group.rotation.y;
    (this.shadow.material as THREE.MeshBasicMaterial).opacity = THREE.MathUtils.clamp(1.4 - alt / 60, 0.15, 1);
    this.shadow.visible = this.group.visible && ground > -5;
  }
  hide() {
    this.group.visible = this.shadow.visible = false;
  }
}
