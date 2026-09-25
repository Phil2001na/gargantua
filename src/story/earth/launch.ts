import * as THREE from "three";
import { PAD, height } from "./land";
import { buildRanger } from "../../endurance";
import { canvasTexture } from "./textures";
import { mergeStatic } from "./merge";
import type { EarthUniforms } from "./ground";

/**
 * The launch site 10 km west of the compound, and the rocket that carries the Ranger:
 * a two-stage booster about 96 m tall with the Ranger mounted nose-up on top.
 * Rocket frame: +y up the stack, origin at the base of the first stage.
 */

const std = (o: THREE.MeshStandardMaterialParameters) => new THREE.MeshStandardMaterial({ roughness: 0.75, ...o });
/** Height of the launch mount's deck, where the rocket stands. */
export const MOUNT_TOP = 8.6;
export const PAD_POS = new THREE.Vector3(PAD.x, 0, PAD.z);
/** Heights on the stack: stage 1, interstage, stage 2, adapter, Ranger. */
export const STACK = { s1: 46, inter: 50, s2: 70, adapter: 74, top: 96 };

export class LaunchSite {
  readonly group = new THREE.Group();
  /** The crew access arm: swings clear at ignition (0 = at the Ranger, 1 = retracted). */
  readonly arm = new THREE.Group();
  constructor() {
    const g = this.group;
    const y0 = height(PAD.x, PAD.z);
    g.position.set(PAD.x, y0, PAD.z);
    const concrete = std({ color: 0x9a968c, roughness: 0.95 });
    const scorched = std({ color: 0x3a3632, roughness: 1 });
    const steel = std({ color: 0x8d3a24, roughness: 0.6, metalness: 0.4 });
    const grey = std({ color: 0x6d7074, roughness: 0.6, metalness: 0.5 });
    const box = (w: number, h: number, d: number, m: THREE.Material, x: number, y: number, z: number, parent: THREE.Object3D = g) => {
      const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
      b.position.set(x, y, z);
      b.castShadow = b.receiveShadow = true;
      parent.add(b);
      return b;
    };
    // Apron, the mount over the flame hole, and the trench running east-west.
    box(150, 1, 150, concrete, 0, 0, 0);
    for (const [x, z, w, d] of [
      [-8.5, 0, 7, 24],
      [8.5, 0, 7, 24],
      [0, -8.5, 10, 7],
      [0, 8.5, 10, 7],
    ])
      box(w, MOUNT_TOP, d, concrete, x, MOUNT_TOP / 2, z);
    box(10, 0.3, 10, scorched, 0, 0.55, 0);
    box(70, 0.2, 13, scorched, 0, 0.55, 0);
    for (const s of [-1, 1]) box(70, 3, 1.2, concrete, 0, 1.5, s * 7);
    // Hold-down posts around the flame hole.
    for (const [x, z] of [
      [-4.2, -4.2],
      [4.2, -4.2],
      [-4.2, 4.2],
      [4.2, 4.2],
    ])
      box(1, 1.4, 1, grey, x, MOUNT_TOP + 0.7, z);
    // The tower: a lattice 110 m tall beside the rocket, with a hammerhead crane on top.
    const tx = 0,
      tz = -17,
      half = 4.5,
      H = 110;
    const tower = new THREE.Group();
    for (const [x, z] of [
      [-half, -half],
      [half, -half],
      [-half, half],
      [half, half],
    ])
      box(0.7, H, 0.7, steel, tx + x, MOUNT_TOP + H / 2, tz + z, tower);
    for (let y = MOUNT_TOP + 6; y < MOUNT_TOP + H; y += 6) {
      box(2 * half, 0.35, 0.35, steel, tx, y, tz - half, tower);
      box(2 * half, 0.35, 0.35, steel, tx, y, tz + half, tower);
      box(0.35, 0.35, 2 * half, steel, tx - half, y, tz, tower);
      box(0.35, 0.35, 2 * half, steel, tx + half, y, tz, tower);
      // X-bracing on each face.
      const diag = Math.hypot(2 * half, 6);
      const a = Math.atan2(6, 2 * half);
      for (const s of [-1, 1]) {
        box(diag, 0.25, 0.25, steel, tx, y - 3, tz + s * half, tower).rotation.z = a;
        box(diag, 0.25, 0.25, steel, tx, y - 3, tz + s * half, tower).rotation.z = -a;
        const bx = box(0.25, 0.25, diag, steel, tx + s * half, y - 3, tz, tower);
        bx.rotation.x = a;
        const by = box(0.25, 0.25, diag, steel, tx + s * half, y - 3, tz, tower);
        by.rotation.x = -a;
      }
    }
    box(12, 3, 12, grey, tx, MOUNT_TOP + H + 1.5, tz, tower);
    box(40, 1.6, 1.6, steel, tx + 8, MOUNT_TOP + H + 4, tz, tower);
    box(2, 6, 2, grey, tx - 10, MOUNT_TOP + H + 1, tz, tower);
    g.add(tower);
    // Crew access arm to the Ranger's hatch.
    this.arm.position.set(tx + half, MOUNT_TOP + 84, tz + half * 0.2);
    box(14, 2.4, 2.6, grey, 7, 0, 0, this.arm);
    box(3, 3, 3, grey, 14, 0, 0, this.arm);
    g.add(this.arm);
    // Lightning masts and a water tower.
    for (const [x, z] of [
      [-60, -60],
      [60, 60],
    ]) {
      box(1.2, 130, 1.2, grey, x, 65, z);
      box(0.3, 8, 0.3, grey, x, 134, z);
    }
    const wt = new THREE.Mesh(new THREE.SphereGeometry(9, 24, 16), std({ color: 0xd8d8d2, roughness: 0.5, metalness: 0.3 }));
    wt.position.set(-130, 42, 90);
    wt.castShadow = true;
    g.add(wt);
    for (const [x, z] of [
      [-6, -6],
      [6, -6],
      [-6, 6],
      [6, 6],
    ])
      box(0.8, 36, 0.8, grey, -130 + x, 18, 90 + z);
    // A low blockhouse and a few service buildings.
    box(26, 5, 14, concrete, 110, 3, -80);
    box(18, 8, 10, std({ color: 0xb8b2a4 }), -100, 4.5, -95);
    box(40, 6, 16, std({ color: 0xc2bcb0 }), 120, 3.5, 100);
    mergeStatic(g, [this.arm]);
  }
  /** The access arm: 0 docked against the Ranger, 1 swung clear. */
  swing(u: number) {
    this.arm.rotation.y = u * 1.3;
  }
}

/** Paint for the booster: white with black roll-pattern blocks, and a little grime. */
function boosterTexture() {
  return canvasTexture(512, (c, r) => {
    c.fillStyle = "#e9e7e1";
    c.fillRect(0, 0, 512, 512);
    c.fillStyle = "#1b1b1c";
    // Two opposite black quarters near the top and bottom.
    for (const [y, h] of [
      [0, 70],
      [440, 72],
    ]) {
      c.fillRect(0, y, 128, h);
      c.fillRect(256, y, 128, h);
    }
    c.fillRect(0, 250, 512, 8);
    for (let i = 0; i < 400; i++) {
      c.fillStyle = `rgba(90,80,60,${r() * 0.05})`;
      c.fillRect(r() * 512, r() * 512, 2 + r() * 20, 1 + r() * 60);
    }
    c.fillStyle = "#1b1b1c";
    c.font = "bold 44px sans-serif";
    c.save();
    c.translate(200, 300);
    c.rotate(-Math.PI / 2);
    c.fillText("U S A", 0, 0);
    c.restore();
  });
}

const plumeVertex = /* glsl */ `
uniform float uSpread;
varying float vU;
varying float vFacing;
void main(){
  vU=-position.y;
  // In thin air the exhaust balloons out downstream of the nozzle.
  vec3 p=position;
  p.xz*=1.+uSpread*4.*sqrt(clamp(vU,0.,1.));
  vec4 mv=modelViewMatrix*vec4(p,1.);
  vec3 n=normalize(normalMatrix*normal);
  vFacing=abs(dot(n,normalize(-mv.xyz)));
  gl_Position=projectionMatrix*mv;
}`;
const plumeFragment = /* glsl */ `
uniform float uTime; uniform float uThrust; uniform float uLength; uniform float uSpread;
varying float vU;
varying float vFacing;
float h1(float n){ return fract(sin(n)*43758.5453); }
float n1(float x){ float i=floor(x), f=fract(x); f=f*f*(3.-2.*f); return mix(h1(i),h1(i+1.),f); }
void main(){
  // A shell seen face-on looks thick (the core); edge-on it is thin.
  float u=clamp(vU,0.,1.);
  float flick=.8+.2*n1(uTime*40.+u*12.)+.15*n1(uTime*23.-u*30.);
  // Shock diamonds in thick air; a soft glow in thin air.
  float diamonds=.5+.5*cos(u*uLength*.35-uTime*5.);
  float body=pow(vFacing,1.6)*pow(1.-u,1.4);
  vec3 hot=vec3(1.,.95,.82), warm=vec3(1.,.58,.2), cool=vec3(.85,.38,.18);
  vec3 c=mix(hot,mix(warm,cool,u),smoothstep(.04,.45,u));
  c=mix(c,vec3(.75,.8,1.),uSpread*.5);
  float a=body*flick*uThrust*(1.+.4*diamonds*(1.-uSpread))*(1.-uSpread*.6);
  // Guarded: one bad value here blacks out the whole frame through the bloom.
  a=clamp(a,0.,1.);
  gl_FragColor=vec4(c*a*3.,a);
}`;

/** Exhaust smoke: big soft puffs that billow, drift and linger. World space. */
export class Smoke {
  readonly points: THREE.Points;
  private pos: Float32Array;
  private vel: Float32Array;
  private age: Float32Array;
  private size: Float32Array;
  private life: Float32Array;
  private next = 0;
  private carry = 0;
  private mat: THREE.ShaderMaterial;
  constructor(
    private n: number,
    u: EarthUniforms,
  ) {
    this.pos = new Float32Array(n * 3);
    this.vel = new Float32Array(n * 3);
    this.age = new Float32Array(n).fill(1e9);
    this.size = new Float32Array(n);
    this.life = new Float32Array(n).fill(1);
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(this.pos, 3));
    g.setAttribute("aAge", new THREE.BufferAttribute(this.age, 1));
    g.setAttribute("aSize", new THREE.BufferAttribute(this.size, 1));
    g.setAttribute("aLife", new THREE.BufferAttribute(this.life, 1));
    this.mat = new THREE.ShaderMaterial({
      uniforms: { ...u, uGlowPos: { value: new THREE.Vector3() }, uGlow: { value: 0 }, uPixH: { value: 600 } },
      vertexShader: /* glsl */ `
        attribute float aAge; attribute float aSize; attribute float aLife;
        uniform float uPixH; uniform vec3 uGlowPos; uniform float uGlow;
        varying float vA; varying vec3 vWorld; varying float vHeat;
        void main(){
          vec4 mv=modelViewMatrix*vec4(position,1.);
          gl_Position=projectionMatrix*mv;
          float t=aAge/aLife;
          vA=t<1.?smoothstep(0.,.04,t)*(1.-t)*(1.-t):0.;
          // Puffs right at the lens would fill the screen: fade them out.
          vA*=smoothstep(aSize*.6,aSize*2.5,-mv.z);
          vWorld=position;
          vHeat=uGlow*exp(-length(position-uGlowPos)/60.)*exp(-aAge*.6);
          gl_PointSize=vA>0.?min(aSize*uPixH*projectionMatrix[1][1]*.5/-mv.z,900.):0.;
        }`,
      fragmentShader: /* glsl */ `
        uniform vec3 uSunDir; uniform vec3 uSunCol; uniform vec3 uAmb;
        varying float vA; varying vec3 vWorld; varying float vHeat;
        void main(){
          vec2 c=gl_PointCoord-.5; float r=dot(c,c)*4.; if(r>1.) discard;
          // A lit ball: brighter on the sun side.
          vec3 n=normalize(vec3(c.x,-c.y,sqrt(max(1.-r,0.))));
          float lit=.55+.45*n.y;
          vec3 col=vec3(.86,.85,.83)*(uSunCol*.35*lit+uAmb*1.1)+vec3(1.,.5,.15)*vHeat*3.;
          gl_FragColor=vec4(col,vA*(1.-r)*.55);
        }`,
      transparent: true,
      depthWrite: false,
    });
    this.points = new THREE.Points(g, this.mat);
    this.points.frustumCulled = false;
  }
  set pixelHeight(h: number) {
    this.mat.uniforms.uPixH.value = h;
  }
  /** Light from the engines on the nearby smoke. */
  glow(at: THREE.Vector3, level: number) {
    this.mat.uniforms.uGlowPos.value.copy(at);
    this.mat.uniforms.uGlow.value = level;
  }
  clear() {
    this.age.fill(1e9);
    (this.points.geometry.attributes.aAge as THREE.BufferAttribute).needsUpdate = true;
  }
  emit(rate: number, dt: number, at: () => { p: THREE.Vector3; v: THREE.Vector3; size: number; life: number }) {
    this.carry += rate * dt;
    while (this.carry >= 1) {
      this.carry--;
      const i = this.next;
      this.next = (this.next + 1) % this.n;
      const e = at();
      this.pos.set([e.p.x, e.p.y, e.p.z], i * 3);
      this.vel.set([e.v.x, e.v.y, e.v.z], i * 3);
      this.age[i] = 0;
      this.size[i] = e.size;
      this.life[i] = e.life;
    }
  }
  update(dt: number, groundY: number) {
    for (let i = 0; i < this.n; i++) {
      if (this.age[i] > this.life[i]) continue;
      this.age[i] += dt;
      const k = i * 3;
      const drag = Math.exp(-0.9 * dt);
      this.vel[k] *= drag;
      this.vel[k + 2] *= drag;
      this.vel[k + 1] = this.vel[k + 1] * drag + 1.2 * dt; // hot smoke rises
      this.pos[k] += (this.vel[k] + 2.5) * dt; // and drifts downwind
      this.pos[k + 1] = Math.max(groundY + this.size[i] * 0.25, this.pos[k + 1] + this.vel[k + 1] * dt);
      this.pos[k + 2] += this.vel[k + 2] * dt;
      this.size[i] += dt * (4 + this.size[i] * 0.05);
    }
    const a = this.points.geometry.attributes;
    a.position.needsUpdate = a.aAge.needsUpdate = a.aSize.needsUpdate = a.aLife.needsUpdate = true;
  }
}

/**
 * The launch vehicle. `lower` is the first stage (with the interstage), `upper` the second
 * stage and adapter, `ranger` the spacecraft. Each can separate and drift away.
 */
export class Rocket {
  readonly group = new THREE.Group();
  readonly lower = new THREE.Group();
  readonly upper = new THREE.Group();
  readonly rangerMount = new THREE.Group();
  readonly ranger: ReturnType<typeof buildRanger>;
  readonly plume: THREE.Mesh;
  readonly plume2: THREE.Mesh;
  readonly light = new THREE.PointLight(0xffb070, 0, 700, 1.8);
  private plumeMat: THREE.ShaderMaterial;
  private plume2Mat: THREE.ShaderMaterial;
  constructor() {
    const paint = std({ map: boosterTexture(), roughness: 0.55, metalness: 0.1 });
    const white = std({ color: 0xe6e4de, roughness: 0.5 });
    const dark = std({ color: 0x2b2c2e, roughness: 0.6, metalness: 0.4 });
    const metal = std({ color: 0x5c5a58, roughness: 0.35, metalness: 0.85 });
    const R = 5;
    const cyl = (r0: number, r1: number, h: number, m: THREE.Material, y: number, parent: THREE.Object3D, open = false) => {
      const c = new THREE.Mesh(new THREE.CylinderGeometry(r1, r0, h, 40, 1, open), m);
      c.position.y = y + h / 2;
      c.castShadow = c.receiveShadow = true;
      parent.add(c);
      return c;
    };
    // First stage: five engines under a skirt.
    cyl(R + 0.3, R, 3, dark, 0, this.lower);
    cyl(R, R, STACK.s1 - 3, paint, 3, this.lower);
    cyl(R, R, STACK.inter - STACK.s1, dark, STACK.s1, this.lower);
    for (const [x, z] of [
      [0, 0],
      [2.6, 0],
      [-2.6, 0],
      [0, 2.6],
      [0, -2.6],
    ]) {
      const bell = cyl(1.2, 0.55, 3.2, metal, -3.2, this.lower, true);
      bell.position.x = x;
      bell.position.z = z;
      (bell.material as THREE.MeshStandardMaterial).side = THREE.DoubleSide;
    }
    // Second stage and the adapter up to the Ranger.
    cyl(R, R, STACK.s2 - STACK.inter, white, STACK.inter, this.upper);
    cyl(R, 2.4, STACK.adapter - STACK.s2, dark, STACK.s2, this.upper);
    const bell2 = cyl(2.2, 0.8, 4, metal, STACK.inter - 4, this.upper, true);
    (bell2.material as THREE.MeshStandardMaterial).side = THREE.DoubleSide;
    // The Ranger, nose up, its engines sitting on the adapter.
    this.ranger = buildRanger();
    this.ranger.group.rotation.x = Math.PI / 2;
    this.ranger.group.position.y = STACK.adapter + 11;
    this.rangerMount.add(this.ranger.group);
    this.group.add(this.lower, this.upper, this.rangerMount);
    // Exhaust plumes: first stage (five engines as one) and second stage.
    const makePlume = (radius: number) => {
      const geo = new THREE.CylinderGeometry(radius, radius * 1.7, 1, 24, 24, true).translate(0, -0.5, 0);
      const m = new THREE.ShaderMaterial({
        uniforms: { uTime: { value: 0 }, uThrust: { value: 0 }, uLength: { value: 60 }, uSpread: { value: 0 } },
        vertexShader: plumeVertex,
        fragmentShader: plumeFragment,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
      });
      const mesh = new THREE.Mesh(geo, m);
      mesh.frustumCulled = false;
      return { mesh, m };
    };
    const p1 = makePlume(3.6);
    this.plume = p1.mesh;
    this.plumeMat = p1.m;
    this.plume.position.y = -3.2;
    this.lower.add(this.plume);
    const p2 = makePlume(1.8);
    this.plume2 = p2.mesh;
    this.plume2Mat = p2.m;
    this.plume2.position.y = STACK.inter - 4;
    this.upper.add(this.plume2);
    this.light.position.y = -20;
    this.group.add(this.light);
    this.reset();
  }
  reset() {
    this.lower.position.set(0, 0, 0);
    this.lower.rotation.set(0, 0, 0);
    this.upper.position.set(0, 0, 0);
    this.upper.rotation.set(0, 0, 0);
    this.rangerMount.position.set(0, 0, 0);
    this.rangerMount.rotation.set(0, 0, 0);
    this.lower.visible = this.upper.visible = true;
    this.plumeMat.uniforms.uThrust.value = 0;
    this.plume2Mat.uniforms.uThrust.value = 0;
  }
  /**
   * Engines: `s1` and `s2` are throttle 0..1 for each stage. `alt` spreads the plume
   * as the air thins.
   */
  engines(s1: number, s2: number, alt: number, time: number) {
    const thin = 1 - Math.exp(-alt / 18000);
    for (const [m, t, len] of [
      [this.plumeMat, s1, 55],
      [this.plume2Mat, s2, 40],
    ] as [THREE.ShaderMaterial, number, number][]) {
      m.uniforms.uThrust.value = t;
      m.uniforms.uTime.value = time;
      m.uniforms.uSpread.value = thin;
      m.uniforms.uLength.value = len * (1 + thin * 1.8);
    }
    this.plume.scale.set(1, this.plumeMat.uniforms.uLength.value, 1);
    this.plume2.scale.set(1, this.plume2Mat.uniforms.uLength.value, 1);
    this.plume.visible = s1 > 0.01 && this.lower.visible;
    this.plume2.visible = s2 > 0.01 && this.upper.visible;
    this.light.intensity = (s1 * 3e4 + s2 * 4e3) * (1 - thin * 0.9);
    this.light.position.y = s1 > 0.01 ? -25 : STACK.inter - 25;
  }
}
