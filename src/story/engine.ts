import * as THREE from "three";

/** Keyboard and mouse for story mode, polled once per frame. Uses KeyboardEvent.code. */
export class Input {
  enabled = false;
  locked = false;
  private down = new Set<string>();
  private hits = new Set<string>();
  private dx = 0;
  private dy = 0;
  /** Called when pointer lock is lost without us asking (Escape, alt-tab). */
  onUnlock: () => void = () => {};
  private wantLock = false;
  constructor(private canvas: HTMLCanvasElement) {
    window.addEventListener("keydown", (e) => {
      if (!this.enabled) return;
      if (["Space", "Tab", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.code)) e.preventDefault();
      if (!e.repeat) this.hits.add(e.code);
      this.down.add(e.code);
    });
    window.addEventListener("keyup", (e) => this.down.delete(e.code));
    window.addEventListener("blur", () => this.down.clear());
    document.addEventListener("mousemove", (e) => {
      if (!this.enabled || !this.locked) return;
      this.dx += e.movementX;
      this.dy += e.movementY;
    });
    document.addEventListener("pointerlockchange", () => {
      const was = this.locked;
      this.locked = document.pointerLockElement === this.canvas;
      if (was && !this.locked && this.enabled && this.wantLock) this.onUnlock();
    });
    canvas.addEventListener("mousedown", () => {
      if (this.enabled && this.wantLock && !this.locked) this.requestLock();
    });
  }
  private requestLock() {
    try {
      const p = this.canvas.requestPointerLock() as unknown as Promise<void> | undefined;
      p?.catch?.(() => {});
    } catch {
      /* not allowed yet: the next click will try again */
    }
  }
  /** Ask for mouse look (pointer lock); `false` releases the mouse for menus. */
  capture(on: boolean) {
    this.wantLock = on;
    if (on && !this.locked) this.requestLock();
    if (!on && this.locked) document.exitPointerLock();
  }
  key(...codes: string[]) {
    return codes.some((c) => this.down.has(c));
  }
  hit(...codes: string[]) {
    return codes.some((c) => this.hits.has(c));
  }
  axis(neg: string[], pos: string[]) {
    return (this.key(...pos) ? 1 : 0) - (this.key(...neg) ? 1 : 0);
  }
  mouse() {
    return { dx: this.dx, dy: this.dy };
  }
  endFrame() {
    this.hits.clear();
    this.dx = this.dy = 0;
  }
  clear() {
    this.down.clear();
    this.endFrame();
  }
}

/**
 * Scripts are generator functions that yield what to wait for: a number of seconds,
 * or a predicate that becomes true. `yield* other()` nests.
 */
export type Wait = number | (() => boolean) | void;
export type ScriptFn = () => Generator<Wait, void, unknown>;
export class Script {
  private it: Generator<Wait, void, unknown> | null = null;
  private wait: Wait = undefined;
  private t = 0;
  run(fn: ScriptFn) {
    this.it = fn();
    this.wait = undefined;
    this.t = 0;
    this.step(0);
  }
  stop() {
    this.it = null;
  }
  get running() {
    return !!this.it;
  }
  step(dt: number) {
    if (!this.it) return;
    for (let guard = 0; guard < 64; guard++) {
      if (typeof this.wait === "number") {
        this.t += dt;
        dt = 0;
        if (this.t < this.wait) return;
      } else if (typeof this.wait === "function" && !this.wait()) return;
      this.t = 0;
      const r = this.it.next();
      if (r.done) {
        this.it = null;
        return;
      }
      this.wait = r.value;
    }
  }
}

/** A camera move along a spline, looking along a second spline (or at a fixed point). */
export class Rail {
  private path: THREE.CatmullRomCurve3;
  private look: THREE.CatmullRomCurve3 | null;
  t = 0;
  constructor(
    points: THREE.Vector3[],
    look: THREE.Vector3[],
    readonly duration: number,
    private ease = true,
  ) {
    this.path = new THREE.CatmullRomCurve3(points, false, "centripetal");
    this.look = look.length > 1 ? new THREE.CatmullRomCurve3(look, false, "centripetal") : null;
    this.fixed = look[0];
  }
  private fixed: THREE.Vector3;
  get done() {
    return this.t >= this.duration;
  }
  apply(camera: THREE.PerspectiveCamera, dt: number) {
    this.t = Math.min(this.duration, this.t + dt);
    let u = this.t / this.duration;
    if (this.ease) u = u * u * (3 - 2 * u);
    camera.position.copy(this.path.getPointAt(u));
    camera.up.set(0, 1, 0);
    camera.lookAt(this.look ? this.look.getPointAt(u) : this.fixed);
  }
}
