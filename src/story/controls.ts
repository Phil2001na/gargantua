import * as THREE from "three";
import type { Input } from "./engine";
import type { Colliders } from "./earth/collide";
import { cornAt, height } from "./earth/land";
import { Truck } from "./earth/truck";

const SENS = 0.0022;

/** First-person walking: mouse look, WASD, Shift to run, steps and porches. */
export class Walker {
  readonly pos = new THREE.Vector3();
  yaw = 0;
  pitch = 0;
  private vel = new THREE.Vector2();
  private vy = 0;
  private bob = 0;
  eye = 1.7;
  /** Walking speed multiplier (wading is slow). */
  pace = 1;
  place(x: number, y: number, z: number, yaw: number, pitch = 0) {
    this.pos.set(x, y, z);
    this.yaw = yaw;
    this.pitch = pitch;
    this.vel.set(0, 0);
    this.vy = 0;
  }
  update(dt: number, input: Input, colliders: Colliders, camera: THREE.PerspectiveCamera, canMove = true) {
    const m = input.mouse();
    this.yaw -= m.dx * SENS;
    this.pitch = THREE.MathUtils.clamp(this.pitch - m.dy * SENS, -1.45, 1.45);
    const fwd = new THREE.Vector2(-Math.sin(this.yaw), -Math.cos(this.yaw)),
      right = new THREE.Vector2(-fwd.y, fwd.x);
    const ix = canMove ? input.axis(["KeyA", "ArrowLeft"], ["KeyD", "ArrowRight"]) : 0,
      iz = canMove ? input.axis(["KeyS", "ArrowDown"], ["KeyW", "ArrowUp"]) : 0;
    const wish = fwd.clone().multiplyScalar(iz).addScaledVector(right, ix);
    if (wish.lengthSq() > 1) wish.normalize();
    const inCorn = cornAt(this.pos.x, this.pos.z);
    const top = (input.key("ShiftLeft", "ShiftRight") ? 5.2 : 2.1) * (inCorn ? 0.6 : 1) * this.pace;
    this.vel.lerp(wish.multiplyScalar(top), 1 - Math.exp(-10 * dt));
    this.pos.x += this.vel.x * dt;
    this.pos.z += this.vel.y * dt;
    colliders.resolve(this.pos, 0.3, this.pos.y);
    const floor = colliders.floorAt(this.pos.x, this.pos.z, this.pos.y);
    if (this.pos.y > floor + 0.05) {
      this.vy -= 9.81 * dt;
      this.pos.y = Math.max(floor, this.pos.y + this.vy * dt);
    } else {
      this.vy = 0;
      // Step up smoothly onto porches and stairs.
      this.pos.y = THREE.MathUtils.damp(this.pos.y, floor, 18, dt);
    }
    const speed = this.vel.length();
    this.bob += speed * dt * 1.9;
    camera.position.set(this.pos.x, this.pos.y + this.eye + Math.sin(this.bob * 2) * 0.03 * Math.min(1, speed / 2), this.pos.z);
    camera.rotation.set(this.pitch, this.yaw, Math.sin(this.bob) * 0.004 * Math.min(1, speed / 2), "YXZ");
  }
}

/** Chase camera behind the truck, or the driver's seat. Mouse looks around; it recentres when idle. */
export class DriveCamera {
  mode: "chase" | "cabin" = "chase";
  private yawOff = 0;
  private pitchOff = 0;
  private idle = 0;
  private camYaw = 0;
  private pos = new THREE.Vector3();
  private fresh = true;
  shake = 0;
  reset() {
    this.fresh = true;
    this.yawOff = this.pitchOff = 0;
  }
  toggle() {
    this.mode = this.mode === "chase" ? "cabin" : "chase";
    this.fresh = true;
  }
  update(dt: number, input: Input, truck: Truck, camera: THREE.PerspectiveCamera) {
    const m = input.mouse();
    if (m.dx || m.dy) this.idle = 0;
    else this.idle += dt;
    this.yawOff -= m.dx * SENS;
    this.pitchOff = THREE.MathUtils.clamp(this.pitchOff - m.dy * SENS, -0.9, 0.7);
    if (this.mode === "chase") this.yawOff = Math.atan2(Math.sin(this.yawOff), Math.cos(this.yawOff));
    else this.yawOff = THREE.MathUtils.clamp(this.yawOff, -2.2, 2.2);
    if (this.idle > 1.6 && this.mode === "chase") {
      this.yawOff = THREE.MathUtils.damp(this.yawOff, 0, 2, dt);
      this.pitchOff = THREE.MathUtils.damp(this.pitchOff, 0, 2, dt);
    }
    const speed = Math.abs(truck.speed);
    camera.fov = THREE.MathUtils.damp(camera.fov, (this.mode === "chase" ? 60 : 68) + Math.min(10, speed * 0.3), 3, dt);
    camera.updateProjectionMatrix();
    const shake = this.shake + Math.min(1, speed / 25) * (truck.surface === 0 ? 0.05 : 0.2) + truck.cornLoad * 0.35;
    this.shake = THREE.MathUtils.damp(this.shake, 0, 4, dt);
    const t = performance.now() / 1000;
    const jitter = new THREE.Vector3(Math.sin(t * 37) * Math.sin(t * 13), Math.sin(t * 41 + 1) * Math.sin(t * 11), 0).multiplyScalar(shake * 0.02);
    if (this.mode === "cabin") {
      truck.group.updateMatrixWorld();
      camera.position.copy(truck.body.localToWorld(Truck.EYE.clone())).add(jitter);
      const q = truck.body.getWorldQuaternion(new THREE.Quaternion());
      camera.quaternion.copy(q).multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(this.pitchOff - 0.04, Math.PI + this.yawOff, 0, "YXZ")));
      this.fresh = true;
      return;
    }
    // Swing round behind the direction of travel (the nose when slow or reversing).
    let want = truck.heading;
    if (truck.speed > 4) want = Math.atan2(truck.vel.x, truck.vel.y);
    let d = want - this.camYaw;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    this.camYaw = this.fresh ? want : this.camYaw + d * (1 - Math.exp(-3.2 * dt));
    const yaw = this.camYaw + this.yawOff;
    const dist = 7.6,
      rise = 2.7 + this.pitchOff * -3.5;
    const target = truck.pos.clone().add(new THREE.Vector3(0, 1.4, 0));
    const desired = target.clone().add(new THREE.Vector3(-Math.sin(yaw) * dist, rise, -Math.cos(yaw) * dist));
    const floor = height(desired.x, desired.z) + 0.8;
    if (desired.y < floor) desired.y = floor;
    if (this.fresh) this.pos.copy(desired);
    else this.pos.lerp(desired, 1 - Math.exp(-9 * dt));
    this.fresh = false;
    camera.position.copy(this.pos).add(jitter);
    camera.up.set(0, 1, 0);
    camera.lookAt(target.add(new THREE.Vector3(Math.sin(yaw) * 3, 0, Math.cos(yaw) * 3)));
  }
}
