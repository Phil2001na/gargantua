import * as THREE from "three";
import type { Story } from "../story";
import { DriveCamera } from "../controls";
import type { Colliders } from "../earth/collide";
import type { DriveInput } from "../earth/truck";

/** Look at something and press E. The nearest target in front of you gets the prompt. */
export type Interactable = {
  at: () => THREE.Vector3;
  label: string;
  range?: number;
  when?: () => boolean;
  act: () => void;
};
export class Interactions {
  items: Interactable[] = [];
  add(i: Interactable) {
    this.items.push(i);
    return i;
  }
  remove(i: Interactable) {
    this.items = this.items.filter((x) => x !== i);
  }
  clear() {
    this.items = [];
  }
  /** Returns the target under the prompt (if any) after handling E. */
  update(s: Story, enabled: boolean) {
    const cam = s.camera;
    const fwd = cam.getWorldDirection(new THREE.Vector3());
    let best: Interactable | null = null,
      bestScore = Infinity;
    if (enabled)
      for (const it of this.items) {
        if (it.when && !it.when()) continue;
        const to = it.at().sub(cam.position);
        const d = to.length();
        if (d > (it.range ?? 1.8)) continue;
        const cos = to.dot(fwd) / Math.max(d, 1e-3);
        if (cos < 0.8) continue;
        const score = d * (2 - cos);
        if (score < bestScore) {
          bestScore = score;
          best = it;
        }
      }
    s.ui.prompt(best ? "E" : null, best?.label ?? "");
    if (best && s.input.hit("KeyE")) {
      s.ui.prompt(null);
      best.act();
    }
    return best;
  }
}

/**
 * The pickup truck, driven by the player (or coasting to a stop when not): physics,
 * flattened corn and dust, bumps, the chase/cabin camera and engine sound.
 */
export class Driving {
  readonly cam = new DriveCamera();
  constructor(private s: Story) {}
  read(free: boolean): DriveInput {
    const i = this.s.input;
    return {
      throttle: free && i.key("KeyW", "ArrowUp") ? 1 : 0,
      brake: free && i.key("KeyS", "ArrowDown") ? 1 : 0,
      steer: free ? i.axis(["KeyD", "ArrowRight"], ["KeyA", "ArrowLeft"]) : 0,
      handbrake: free && i.key("Space"),
    };
  }
  /** `control`: the player drives. `camera`: the drive camera owns the view. `auto`: a script drives. */
  update(dt: number, control: boolean, camera: boolean, colliders: Colliders, engineOn = true, auto?: DriveInput) {
    const { s } = this;
    const w = s.earth,
      truck = w.truck;
    const drive = auto ?? this.read(control);
    if (!control && !auto) drive.brake = Math.abs(truck.speed) > 0.3 ? 1 : 0;
    truck.update(dt, drive, colliders);
    w.truckEffects(dt);
    if (truck.impact > 2) {
      s.audio.thud(truck.impact);
      this.cam.shake += Math.min(3, truck.impact * 0.3);
    }
    truck.impact = 0;
    if (truck.landing > 3) {
      s.audio.thud(truck.landing * 1.5);
      this.cam.shake += Math.min(4, truck.landing * 0.4);
    }
    truck.landing = 0;
    if (camera) {
      if (control && s.input.hit("KeyC")) this.cam.toggle();
      this.cam.update(dt, s.input, truck, s.camera);
      truck.cooper.root.visible = this.cam.mode === "chase";
    }
    const rpm = Math.min(1, Math.abs(truck.speed) / 30 + (drive.throttle ? 0.15 : 0));
    s.audio.truck(engineOn, rpm, drive.throttle, truck.speed, truck.cornLoad, truck.surface === 0 ? 0 : 1);
    s.ui.speed(camera && control ? truck.speed * 3.6 : null);
    return drive;
  }
}

/** Steer toward a point and hold a speed (m/s): a script driving the truck. */
export function autopilot(truck: { pos: THREE.Vector3; heading: number; speed: number }, to: THREE.Vector3, speed: number): DriveInput {
  let d = Math.atan2(to.x - truck.pos.x, to.z - truck.pos.z) - truck.heading;
  d = Math.atan2(Math.sin(d), Math.cos(d));
  return {
    throttle: truck.speed < speed ? 1 : 0,
    brake: truck.speed > speed + 2 ? 1 : 0,
    steer: THREE.MathUtils.clamp(d * 2.5, -1, 1),
    handbrake: false,
  };
}

/** A simple walk cycle for the stylised people (legs and arms swing, a little bounce). */
export function walkPose(p: { legL: THREE.Object3D; legR: THREE.Object3D; armL: THREE.Object3D; armR: THREE.Object3D; torso: THREE.Object3D }, phase: number, amount: number) {
  const s = Math.sin(phase) * 0.5 * amount;
  p.legL.rotation.x = s;
  p.legR.rotation.x = -s;
  p.armL.rotation.x = -s * 0.8;
  p.armR.rotation.x = s * 0.8;
  p.torso.position.y = (p.torso.userData.baseY ??= p.torso.position.y) + Math.abs(Math.cos(phase)) * 0.03 * amount;
}
