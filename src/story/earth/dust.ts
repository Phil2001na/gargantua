import * as THREE from "three";

/** A rectangle on the floor where the "gravity" gathers dust (world x/z). */
export type Stripe = { x0: number; x1: number; z0: number; z1: number };

export type DustOptions = {
  /** Floor area covered by the dust map. */
  x0: number;
  x1: number;
  z0: number;
  z1: number;
  floor: number;
  /** Map resolution in metres per texel. */
  texel?: number;
  /** Where the dust comes in: a box, and the wind direction through it. */
  source: { min: THREE.Vector3; max: THREE.Vector3; wind: THREE.Vector3 };
  colour?: number;
  max?: number;
};

/**
 * Dust blown in through an opening that settles on the floor in bands. Every grain is
 * simulated: it tumbles in on the wind, then a pull toward its band grows as it sinks,
 * so the lines form in front of you rather than appearing. Settled grains are painted
 * into a floor map, so the pattern builds up and stays.
 *
 * Built for Murph's room, and reused in the tesseract, where the pull is you.
 */
export class DustLines {
  readonly group = new THREE.Group();
  private readonly n: number;
  private pos: Float32Array;
  private vel: Float32Array;
  private tgt: Float32Array;
  private age: Float32Array;
  private live: Uint8Array;
  private free: number[] = [];
  private points: THREE.Points;
  private map: Float32Array;
  private bytes: Uint8Array;
  private tex: THREE.DataTexture;
  private nx: number;
  private nz: number;
  private carry = 0;
  private dirty = 0;
  private stripes: Stripe[] = [];
  private cum: number[] = [];
  /** Grains per second while pouring. */
  rate = 0;
  /** 0..1: how hard the bands pull (0 = dust just falls where the wind drops it). */
  pull = 1;
  /** Fraction of grains that ignore the bands and settle as a thin film. */
  stray = 0.14;
  readonly material: THREE.ShaderMaterial;
  constructor(private o: DustOptions) {
    this.n = o.max ?? 12000;
    this.pos = new Float32Array(this.n * 3);
    this.vel = new Float32Array(this.n * 3);
    this.tgt = new Float32Array(this.n * 2);
    this.age = new Float32Array(this.n);
    this.live = new Uint8Array(this.n);
    for (let i = this.n - 1; i >= 0; i--) this.free.push(i);
    const texel = o.texel ?? 0.0125;
    this.nx = Math.ceil((o.x1 - o.x0) / texel);
    this.nz = Math.ceil((o.z1 - o.z0) / texel);
    this.map = new Float32Array(this.nx * this.nz);
    this.bytes = new Uint8Array(this.nx * this.nz * 4);
    this.tex = new THREE.DataTexture(this.bytes, this.nx, this.nz, THREE.RGBAFormat);
    this.tex.magFilter = THREE.LinearFilter;
    this.tex.minFilter = THREE.LinearFilter;
    this.tex.needsUpdate = true;
    const colour = new THREE.Color(o.colour ?? 0xcdb896);
    // The settled layer: lit like the floor it lies on.
    const film = new THREE.Mesh(
      new THREE.PlaneGeometry(o.x1 - o.x0, o.z1 - o.z0).rotateX(-Math.PI / 2),
      new THREE.MeshStandardMaterial({ color: colour, roughness: 1, alphaMap: this.tex, transparent: true, depthWrite: false }),
    );
    // Plane UV v runs +z to -z after the rotation; the map rows run z0..z1, so flip it.
    this.tex.flipY = false;
    film.geometry.attributes.uv.array.forEach((_, i, a) => {
      if (i % 2) (a as Float32Array)[i] = 1 - a[i];
    });
    film.position.set((o.x0 + o.x1) / 2, o.floor + 0.004, (o.z0 + o.z1) / 2);
    film.receiveShadow = true;
    film.renderOrder = 1;
    // Grains in the air.
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(this.pos, 3));
    g.setAttribute("aLive", new THREE.BufferAttribute(this.live, 1, true));
    this.material = new THREE.ShaderMaterial({
      uniforms: { uColour: { value: colour }, uLight: { value: new THREE.Color(1, 0.8, 0.6) }, uSize: { value: 7 } },
      vertexShader: /* glsl */ `
        attribute float aLive; uniform float uSize; varying float vA;
        void main(){ vec4 mv=modelViewMatrix*vec4(position,1.); gl_Position=projectionMatrix*mv;
          vA=aLive; gl_PointSize=aLive>0.?clamp(uSize/-mv.z,1.,2.5):0.; }`,
      fragmentShader: /* glsl */ `
        uniform vec3 uColour; uniform vec3 uLight; varying float vA;
        void main(){ vec2 c=gl_PointCoord-.5; float r=dot(c,c)*4.; if(r>1.) discard;
          gl_FragColor=vec4(uColour*uLight,(1.-r)*.35); }`,
      transparent: true,
      depthWrite: false,
    });
    this.points = new THREE.Points(g, this.material);
    this.points.frustumCulled = false;
    this.group.add(film, this.points);
  }

  /** Where the grains gather. Wider stripes collect proportionally more. */
  setStripes(stripes: Stripe[]) {
    this.stripes = stripes;
    let a = 0;
    this.cum = stripes.map((s) => (a += (s.x1 - s.x0) * (s.z1 - s.z0)));
  }
  clear() {
    this.map.fill(0);
    this.bytes.fill(0);
    this.tex.needsUpdate = true;
    this.live.fill(0);
    this.free = [];
    for (let i = this.n - 1; i >= 0; i--) this.free.push(i);
    (this.points.geometry.attributes.aLive as THREE.BufferAttribute).needsUpdate = true;
  }
  /** Lay the finished pattern down at once (checkpoints, skipping). */
  settle(grains = 200000) {
    for (let i = 0; i < grains; i++) {
      const [x, z] = this.pick(Math.random() < this.stray);
      this.deposit(x, z);
    }
    this.flush();
  }
  /** Fraction of the target pattern laid down so far (0..1, roughly). */
  get coverage() {
    let s = 0,
      c = 0;
    for (const st of this.stripes) {
      const i = Math.floor(((st.x0 + st.x1) / 2 - this.o.x0) / (this.o.x1 - this.o.x0) * this.nx),
        k = Math.floor(((st.z0 + st.z1) / 2 - this.o.z0) / (this.o.z1 - this.o.z0) * this.nz);
      s += Math.min(1, this.map[k * this.nx + i] / FULL);
      c++;
    }
    return c ? s / c : 0;
  }

  private pick(stray: boolean): [number, number] {
    const o = this.o;
    if (stray || !this.stripes.length) return [o.x0 + Math.random() * (o.x1 - o.x0), o.z0 + Math.random() * (o.z1 - o.z0)];
    const r = Math.random() * this.cum[this.cum.length - 1];
    let i = 0;
    while (this.cum[i] < r) i++;
    const s = this.stripes[i];
    // Soft edges: a little spill past each side of the band.
    const jx = (Math.random() + Math.random() - 1) * 0.006;
    return [s.x0 + Math.random() * (s.x1 - s.x0) + jx, s.z0 + Math.random() * (s.z1 - s.z0)];
  }
  private spawn() {
    const i = this.free.pop();
    if (i === undefined) return;
    const { min, max, wind } = this.o.source;
    this.pos[i * 3] = min.x + Math.random() * (max.x - min.x);
    this.pos[i * 3 + 1] = min.y + Math.random() * (max.y - min.y);
    this.pos[i * 3 + 2] = min.z + Math.random() * (max.z - min.z);
    const gust = 0.6 + Math.random() * 0.8;
    this.vel[i * 3] = wind.x * gust + (Math.random() - 0.5) * 0.8;
    this.vel[i * 3 + 1] = wind.y * gust + (Math.random() - 0.5) * 0.5;
    this.vel[i * 3 + 2] = wind.z * gust + (Math.random() - 0.5) * 0.8;
    const stray = Math.random() < this.stray;
    const [tx, tz] = this.pick(stray);
    this.tgt[i * 2] = tx;
    this.tgt[i * 2 + 1] = tz;
    this.age[i] = stray ? -99 : 0;
    this.live[i] = 255;
  }
  private deposit(x: number, z: number) {
    const o = this.o;
    const fx = ((x - o.x0) / (o.x1 - o.x0)) * this.nx - 0.5,
      fz = ((z - o.z0) / (o.z1 - o.z0)) * this.nz - 0.5;
    const ix = Math.floor(fx),
      iz = Math.floor(fz),
      ux = fx - ix,
      uz = fz - iz;
    // Bilinear splat so single grains don't alias.
    for (const [dx, dz, w] of [
      [0, 0, (1 - ux) * (1 - uz)],
      [1, 0, ux * (1 - uz)],
      [0, 1, (1 - ux) * uz],
      [1, 1, ux * uz],
    ]) {
      const x2 = ix + dx,
        z2 = iz + dz;
      if (x2 < 0 || z2 < 0 || x2 >= this.nx || z2 >= this.nz) continue;
      const k = z2 * this.nx + x2;
      this.map[k] += w;
      const v = Math.min(255, Math.round(255 * Math.pow(Math.min(1, this.map[k] / FULL), 0.7)));
      const b = k * 4;
      this.bytes[b] = this.bytes[b + 1] = this.bytes[b + 2] = this.bytes[b + 3] = v;
    }
    this.dirty++;
  }
  private flush() {
    if (this.dirty) this.tex.needsUpdate = true;
    this.dirty = 0;
  }

  update(dt: number, t: number) {
    this.carry += this.rate * dt;
    while (this.carry >= 1) {
      this.carry--;
      this.spawn();
    }
    const floor = this.o.floor;
    const wind = this.o.source.wind;
    const pull = this.pull;
    for (let i = 0; i < this.n; i++) {
      if (!this.live[i]) continue;
      const a = (this.age[i] += dt);
      const p = i * 3;
      let x = this.pos[p],
        y = this.pos[p + 1],
        z = this.pos[p + 2];
      let vx = this.vel[p],
        vy = this.vel[p + 1],
        vz = this.vel[p + 2];
      // Air drag toward still air, a gentle fall, and turbulence.
      const drag = Math.exp(-1.6 * dt);
      vx *= drag;
      vz *= drag;
      vy = vy * Math.exp(-2.5 * dt) - 1.4 * dt;
      const sw = Math.sin(t * 3.1 + i * 0.37) + Math.sin(t * 5.3 + i * 1.91);
      vx += sw * 0.9 * dt;
      vz += Math.cos(t * 2.7 + i * 0.73) * 1.1 * dt;
      if (a >= 0 && pull > 0) {
        // The pull toward the band: weak on entry, firm near the floor.
        const k = pull * Math.min(1, a / 0.9) * (0.4 + 0.6 * THREE.MathUtils.clamp(1 - (y - floor) / 1.6, 0, 1));
        const tx = this.tgt[i * 2],
          tz = this.tgt[i * 2 + 1];
        vx += (18 * (tx - x) - 7 * vx) * k * dt;
        vz += (18 * (tz - z) - 7 * vz) * k * dt;
      } else vx += wind.x * 0.2 * dt;
      x += vx * dt;
      y += vy * dt;
      z += vz * dt;
      if (y <= floor + 0.01) {
        // Settle: pulled grains land on their mark once it has had time to act.
        if (a >= 0 && pull > 0.5) this.deposit(this.tgt[i * 2] * 0.7 + x * 0.3, this.tgt[i * 2 + 1] * 0.7 + z * 0.3);
        else this.deposit(x, z);
        this.live[i] = 0;
        this.free.push(i);
        continue;
      }
      if (a > 12 || Math.abs(vx) > 40) {
        this.live[i] = 0;
        this.free.push(i);
        continue;
      }
      this.pos[p] = x;
      this.pos[p + 1] = y;
      this.pos[p + 2] = z;
      this.vel[p] = vx;
      this.vel[p + 1] = vy;
      this.vel[p + 2] = vz;
    }
    this.points.geometry.attributes.position.needsUpdate = true;
    (this.points.geometry.attributes.aLive as THREE.BufferAttribute).needsUpdate = true;
    this.flush();
  }
}

/** Grains per texel for a fully covered band. */
const FULL = 11;
