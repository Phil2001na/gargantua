import * as THREE from "three";
import { earthUniforms, Ground, type EarthUniforms } from "./ground";
import { Corn } from "./corn";
import { Farm } from "./farm";
import { Truck } from "./truck";
import { Drone } from "./drone";
import { height, cornAt, roadDist } from "./land";
import { MurphRoom } from "./room";
import { Storm } from "./storm";
import { Compound } from "./compound";
import { toEcef, arcRotation, farmBasis, dropFrom } from "./geo";

/** Dust kicked up behind the wheels: a ring buffer of soft, growing, fading puffs. */
class Dust {
  readonly points: THREE.Points;
  private pos: Float32Array;
  private vel: Float32Array;
  private age: Float32Array;
  private next = 0;
  private carry = 0;
  constructor(
    private count: number,
    u: EarthUniforms,
  ) {
    this.pos = new Float32Array(count * 3);
    this.vel = new Float32Array(count * 3);
    this.age = new Float32Array(count).fill(99);
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(this.pos, 3));
    g.setAttribute("aAge", new THREE.BufferAttribute(this.age, 1));
    this.points = new THREE.Points(
      g,
      new THREE.ShaderMaterial({
        uniforms: { ...u, uScale: { value: 400 } },
        vertexShader: `attribute float aAge; uniform float uScale; varying float vA;
          void main(){ vA=aAge; vec4 mv=modelViewMatrix*vec4(position,1.); gl_Position=projectionMatrix*mv;
          gl_PointSize=aAge>5.?0.:min(uScale*(.6+aAge*1.2)/-mv.z,220.); }`,
        fragmentShader: `uniform vec3 uSunCol; uniform vec3 uAmb; uniform vec3 uHaze; varying float vA;
          void main(){ vec2 c=gl_PointCoord-.5; float r=dot(c,c)*4.; if(r>1.) discard;
          float a=(1.-r)*(1.-smoothstep(.2,5.,vA))*.13;
          vec3 col=vec3(.55,.46,.34)*(uSunCol*.35+uAmb); gl_FragColor=vec4(mix(col,uHaze,.3),a); }`,
        transparent: true,
        depthWrite: false,
      }),
    );
    this.points.frustumCulled = false;
  }
  emit(x: number, y: number, z: number, vx: number, vz: number) {
    const i = this.next;
    this.next = (this.next + 1) % this.count;
    this.pos.set([x + (Math.random() - 0.5) * 0.8, y + 0.2, z + (Math.random() - 0.5) * 0.8], i * 3);
    this.vel.set([vx * 0.25 + (Math.random() - 0.5) * 1.5, 0.6 + Math.random() * 0.8, vz * 0.25 + (Math.random() - 0.5) * 1.5], i * 3);
    this.age[i] = 0;
  }
  /** Spawn along a wheel at a rate that grows with speed. */
  spray(rate: number, dt: number, at: () => [number, number, number, number, number]) {
    this.carry += rate * dt;
    while (this.carry >= 1) {
      this.carry--;
      this.emit(...at());
    }
  }
  update(dt: number) {
    for (let i = 0; i < this.count; i++) {
      if (this.age[i] > 5) continue;
      this.age[i] += dt;
      const k = Math.exp(-1.2 * dt);
      this.vel[i * 3] = this.vel[i * 3] * k + 0.9 * dt; // the breeze carries it east
      this.vel[i * 3 + 1] *= k;
      this.vel[i * 3 + 2] *= k;
      this.pos[i * 3] += this.vel[i * 3] * dt;
      this.pos[i * 3 + 1] += this.vel[i * 3 + 1] * dt;
      this.pos[i * 3 + 2] += this.vel[i * 3 + 2] * dt;
    }
    this.points.geometry.attributes.position.needsUpdate = true;
    this.points.geometry.attributes.aAge.needsUpdate = true;
  }
}

/** Time of day and weather: everything the sky, haze and lights need. */
export type Mood = {
  sunDir: [number, number, number];
  sunCol: [number, number, number];
  amb: [number, number, number];
  haze: [number, number, number];
  glow: [number, number, number];
  zenith: [number, number, number];
  fog: number;
  night: number;
  light: number;
  lightCol: [number, number, number];
  hemi: number;
  env: number;
};
export const MOODS = {
  morning: {
    sunDir: [0.86, 0.36, -0.36],
    sunCol: [2.5, 2.05, 1.5],
    amb: [0.42, 0.43, 0.45],
    haze: [0.62, 0.53, 0.41],
    glow: [1.0, 0.72, 0.4],
    zenith: [0.2, 0.32, 0.5],
    fog: 3200,
    night: 0,
    light: 3.2,
    lightCol: [1, 0.886, 0.722],
    hemi: 0.5,
    env: 0.8,
  },
  evening: {
    sunDir: [-0.92, 0.13, 0.3],
    sunCol: [2.3, 1.35, 0.7],
    amb: [0.3, 0.27, 0.28],
    haze: [0.66, 0.46, 0.3],
    glow: [1.15, 0.58, 0.25],
    zenith: [0.15, 0.2, 0.36],
    fog: 2600,
    night: 0,
    light: 3.0,
    lightCol: [1, 0.66, 0.4],
    hemi: 0.32,
    env: 0.5,
  },
  storm: {
    sunDir: [-0.92, 0.2, 0.3],
    sunCol: [0.42, 0.3, 0.18],
    amb: [0.2, 0.15, 0.1],
    haze: [0.3, 0.21, 0.13],
    glow: [0.18, 0.1, 0.04],
    zenith: [0.24, 0.17, 0.1],
    fog: 70,
    night: 0,
    light: 0.4,
    lightCol: [1, 0.7, 0.45],
    hemi: 0.3,
    env: 0.25,
  },
  /** Launch day: a high sun, clear and bright. */
  day: {
    sunDir: [0.45, 0.8, 0.4],
    sunCol: [2.1, 1.97, 1.75],
    amb: [0.36, 0.39, 0.44],
    haze: [0.64, 0.62, 0.57],
    glow: [0.7, 0.6, 0.45],
    zenith: [0.22, 0.36, 0.6],
    fog: 6000,
    night: 0,
    light: 2.6,
    lightCol: [1, 0.95, 0.88],
    hemi: 0.45,
    env: 0.9,
  },
  night: {
    sunDir: [0.35, 0.5, 0.6],
    sunCol: [0.13, 0.16, 0.23],
    amb: [0.03, 0.035, 0.05],
    haze: [0.022, 0.028, 0.042],
    glow: [0.03, 0.04, 0.06],
    zenith: [0.006, 0.01, 0.022],
    fog: 2400,
    night: 1,
    light: 0.3,
    lightCol: [0.62, 0.72, 0.9],
    hemi: 0.05,
    env: 0.06,
  },
} satisfies Record<string, Mood>;

/**
 * Everything on Earth that persists between chapters: land, sky, corn, farm, truck, drone.
 */
export class EarthWorld {
  readonly scene = new THREE.Scene();
  readonly u = earthUniforms();
  readonly ground: Ground;
  readonly corn: Corn;
  readonly farm: Farm;
  readonly truck: Truck;
  readonly drone: Drone;
  readonly dust: Dust;
  readonly sun: THREE.DirectionalLight;
  readonly room: MurphRoom;
  readonly storm: Storm;
  readonly compound: Compound;
  private shadowHalf = 35;
  private hemi: THREE.HemisphereLight;
  /** A searchlight from above (the security drone): position, aim and strength. */
  searchlight: { pos: THREE.Vector3; aim: THREE.Vector3; power: number } | null = null;
  /** Underground: no sun or sky light at all. */
  underground = false;
  /** 0 outdoors, 1 deep inside a building: sky light and reflections are mostly shut out. */
  indoor = 0;
  private mood: Mood = MOODS.morning;
  /** The mood's sun, haze and fog before altitude changes them. */
  private base = { sun: new THREE.Vector3(), sunCol: new THREE.Vector3(), haze: new THREE.Vector3(), fog: 3200 };
  /** Height of the camera above the ground, metres. */
  altitude = 0;
  /** Drawing-buffer height in pixels (for the globe's texture detail). */
  pixelHeight = 720;
  /** Big things far from the camera sink below its horizon: [group, x, z]. */
  readonly anchors: [THREE.Object3D, number, number][] = [];
  private stampAcc = 0;
  private lastStamp = new THREE.Vector2(1e9, 1e9);
  time = 0;
  constructor(renderer: THREE.WebGLRenderer) {
    const s = this.scene;
    this.ground = new Ground(this.u);
    this.corn = new Corn(this.u, renderer);
    this.farm = new Farm();
    this.truck = new Truck();
    this.dust = new Dust(900, this.u);
    s.add(this.ground.group, this.corn.group, this.farm.group, this.truck.group, this.dust.points);
    this.drone = new Drone(s);
    this.room = new MurphRoom();
    this.storm = new Storm(this.u);
    s.add(this.room.group, this.storm.group);
    this.compound = new Compound(this.farm.colliders);
    s.add(this.compound.surface, this.compound.below);
    const sunDir = this.u.uSunDir.value;
    this.sun = new THREE.DirectionalLight(0xffe2b8, 3.2);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(1024, 1024);
    const sc = this.sun.shadow.camera;
    sc.left = sc.bottom = -35;
    sc.right = sc.top = 35;
    sc.near = 1;
    sc.far = 400;
    this.sun.shadow.bias = -0.0004;
    this.sun.shadow.normalBias = 0.09;
    s.add(this.sun, this.sun.target);
    this.hemi = new THREE.HemisphereLight(0x9fb2c8, 0x5a4a38, 0.5);
    s.add(this.hemi);
    const haze = this.u.uHaze.value;
    s.fog = new THREE.FogExp2(new THREE.Color(haze.x, haze.y, haze.z), 1 / 3200);
    this.sun.position.copy(sunDir).multiplyScalar(200);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    // Image-based light for metal and paint: the same dusty sky over brown ground.
    const envScene = new THREE.Scene();
    const skyDome = (this.ground.group.children[0] as THREE.Mesh).clone();
    envScene.add(skyDome);
    const floor = new THREE.Mesh(
      new THREE.CircleGeometry(9, 32).rotateX(-Math.PI / 2).translate(0, -0.5, 0),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(0.26, 0.21, 0.14) }),
    );
    envScene.add(floor);
    const pmrem = new THREE.PMREMGenerator(renderer);
    s.environment = pmrem.fromScene(envScene, 0, 0.1, 50).texture;
    s.environmentIntensity = 0.8;
    pmrem.dispose();
    const farmUp = new THREE.Vector3().setFromMatrix3Column(farmBasis(), 1);
    this.u.uFarmUp.value.copy(farmUp);
    this.anchors.push([this.farm.group, 0, 0], [this.room.group, 0, 0], [this.compound.surface, 380, -5310]);
    this.setMood(MOODS.morning);
  }
  /** Half-width of the sun's shadow box: small indoors for crisp window light, large outside. */
  set shadowSpan(half: number) {
    if (half === this.shadowHalf) return;
    this.shadowHalf = half;
    const sc = this.sun.shadow.camera;
    sc.left = sc.bottom = -half;
    sc.right = sc.top = half;
    sc.updateProjectionMatrix();
  }
  /** Back to a clear morning with nothing left over from another chapter. */
  resetScene() {
    this.setMood(MOODS.morning);
    this.indoor = 0;
    this.shadowSpan = 35;
    this.storm.front = -1e5;
    this.storm.strength = 0;
    this.room.dust.clear();
    this.room.dust.rate = 0;
    this.room.wind = 0;
    this.room.lampOn(0);
    this.room.landerOnShelf(true);
    this.room.setSash(1);
    this.room.booksHome(true);
    this.room.watchOnShelf(false);
    this.truck.headlightsOn(false);
    this.truck.group.visible = true;
    this.farm.donald.root.visible = true;
    for (const p of [this.truck.tom, this.truck.murph]) p.root.visible = true;
    this.searchlight = null;
    this.underground = false;
    this.compound.lightsOn(false);
    this.compound.holoLevel(0);
    this.compound.floods.emissiveIntensity = 0;
    this.drone.override = null;
    this.drone.hide();
  }
  /** Set the sky, haze and lights, optionally blended between two moods (t = 0..1). */
  setMood(a: Mood, b: Mood = a, t = 0) {
    const u = this.u;
    const mix3 = (x: number[], y: number[]) => x.map((v, i) => v + (y[i] - v) * t) as [number, number, number];
    const lerp = (x: number, y: number) => x + (y - x) * t;
    u.uSunDir.value.set(...mix3(a.sunDir, b.sunDir)).normalize();
    u.uSunCol.value.set(...mix3(a.sunCol, b.sunCol));
    u.uAmb.value.set(...mix3(a.amb, b.amb));
    u.uHaze.value.set(...mix3(a.haze, b.haze));
    u.uGlow.value.set(...mix3(a.glow, b.glow));
    u.uZenith.value.set(...mix3(a.zenith, b.zenith));
    // Haze distance blends in log space so a storm closes in smoothly.
    u.uFogDist.value = Math.exp(lerp(Math.log(a.fog), Math.log(b.fog)));
    u.uNight.value = lerp(a.night, b.night);
    this.mood = {
      sunDir: a.sunDir,
      sunCol: a.sunCol,
      amb: a.amb,
      haze: a.haze,
      glow: a.glow,
      zenith: a.zenith,
      fog: u.uFogDist.value,
      night: u.uNight.value,
      light: lerp(a.light, b.light),
      lightCol: mix3(a.lightCol, b.lightCol),
      hemi: lerp(a.hemi, b.hemi),
      env: lerp(a.env, b.env),
    };
    this.base.sun.copy(u.uSunDir.value);
    this.base.sunCol.copy(u.uSunCol.value);
    this.base.haze.copy(u.uHaze.value);
    this.base.fog = u.uFogDist.value;
    this.aloft(this.altitude, 0, 0);
  }
  /**
   * Height changes the sky: the dust haze thins, the real sky and the globe take over,
   * and the sun moves as you travel over the curve of the Earth.
   */
  private aloft(alt: number, x: number, z: number) {
    const u = this.u;
    const space = THREE.MathUtils.smoothstep(alt, 1200, 14000);
    u.uSpace.value = space;
    u.uAlt.value = alt;
    // The sun is fixed in the farm's frame; seen from further round the planet it moves.
    const arc = arcRotation(x, z);
    u.uSunDir.value.copy(this.base.sun).applyMatrix3(arc.clone().transpose()).normalize();
    u.uToEcef.value.copy(toEcef(x, z));
    // Above the air the sun is white; the scattering shader reddens it where it should.
    u.uSunCol.value.copy(this.base.sunCol).lerp(new THREE.Vector3(2.7, 2.6, 2.45), space);
    // Thin the haze with height, and turn it from dust to clear blue.
    u.uFogDist.value = this.base.fog * (1 + Math.max(0, alt - 150) / 120) * (1 + space * 40);
    u.uHaze.value.copy(this.base.haze).lerp(new THREE.Vector3(0.5, 0.62, 0.8), space * 0.7);
    // From high up the local map dissolves into the globe at its edge, then entirely.
    const gone = THREE.MathUtils.smoothstep(alt, 22000, 45000);
    if (space <= 0) u.uPatch.value.set(1e9, 2e9);
    else u.uPatch.value.set(THREE.MathUtils.lerp(13000, -2000, gone), THREE.MathUtils.lerp(22000, 1, gone));
    const fog = this.scene.fog as THREE.FogExp2;
    fog.color.setRGB(u.uHaze.value.x, u.uHaze.value.y, u.uHaze.value.z);
    fog.density = 1 / u.uFogDist.value;
  }
  /** Advance shared animation and keep camera-following pieces in place. */
  update(dt: number, camera: THREE.Camera) {
    this.time += dt;
    this.u.uTime.value = this.time;
    const cp = camera.position;
    this.altitude = Math.max(0, cp.y - height(cp.x, cp.z));
    this.aloft(this.altitude, cp.x, cp.z);
    for (const [g, x, z] of this.anchors) g.position.y = -dropFrom(cp.x, cp.z, x, z);
    const cam = camera as THREE.PerspectiveCamera;
    if (cam.isPerspectiveCamera) {
      this.u.uPix.value = (2 * Math.tan(THREE.MathUtils.degToRad(cam.fov) / 2)) / this.pixelHeight;
      // See the ground from orbit: push the far plane out with height.
      const far = Math.max(60000, this.altitude * 3 + 60000);
      if (Math.abs(cam.far - far) > far * 0.05) {
        cam.far = far;
        cam.updateProjectionMatrix();
      }
    }
    const m = this.mood,
      shut = 1 - 0.55 * this.indoor;
    this.sun.intensity = this.underground ? 0 : m.light;
    this.sun.color.setRGB(...m.lightCol);
    // In space there is no sky to light things from all round: just the sun and earthshine.
    const air = 1 - 0.85 * this.u.uSpace.value;
    this.hemi.intensity = this.underground ? 0.1 : m.hemi * shut * air;
    this.scene.environmentIntensity = this.underground ? 0.14 : m.env * shut * air;
    // Headlights for the custom world shaders (the truck's spotlight covers everything else).
    const t = this.truck;
    if (t.lampsOn) {
      t.group.updateMatrixWorld();
      const a = t.body.localToWorld(new THREE.Vector3(0.62, 1.05, 2.5)),
        b = t.body.localToWorld(new THREE.Vector3(-0.62, 1.05, 2.5));
      const aim = t.body.localToWorld(new THREE.Vector3(0, 0.3, 14)).sub(a.clone().add(b).multiplyScalar(0.5)).normalize();
      // Both lenses as one lamp, aimed down the road.
      const mid = a.add(b).multiplyScalar(0.5);
      this.u.uLampA.value.set(mid.x, mid.y, mid.z, 2);
      this.u.uLampDir.value.copy(aim);
    } else this.u.uLampA.value.w = 0;
    const sl = this.searchlight;
    if (sl && sl.power > 0) {
      this.u.uLampB.value.set(sl.pos.x, sl.pos.y, sl.pos.z, sl.power);
      this.u.uLampDirB.value.copy(sl.aim).normalize();
    } else this.u.uLampB.value.w = 0;
    // The local map is gone from high up; stop drawing it at all.
    const local = this.altitude < 50000;
    this.ground.local = local;
    this.corn.group.visible = local;
    this.ground.update(camera);
    if (local) this.corn.update(camera);
    this.farm.update(this.time);
    this.dust.update(dt);
    this.room.update(this.time);
    this.room.dust.update(dt, this.time);
    if (this.compound.below.visible) this.compound.update(this.time, camera);
    this.storm.update(camera);
    // The shadow box follows the camera, snapped to texels so edges don't crawl.
    const focus = camera.position;
    const step = (2 * this.shadowHalf) / 1024;
    const fx = Math.round(focus.x / step) * step,
      fz = Math.round(focus.z / step) * step;
    // High up, the shadows that matter are on the vehicle, not the ground.
    const fy = this.altitude > 400 ? focus.y : height(fx, fz);
    this.sun.target.position.set(fx, fy, fz);
    this.sun.position.set(fx, fy, fz).addScaledVector(this.u.uSunDir.value, 200);
  }
  /** Truck effects on the world: flattened corn and dust. */
  truckEffects(dt: number) {
    const t = this.truck;
    this.corn.truck.set(t.pos.x, t.pos.z, t.heading);
    const moving = Math.abs(t.speed);
    const here = new THREE.Vector2(t.pos.x, t.pos.z);
    if (!t.airborne && moving > 0.5 && here.distanceTo(this.lastStamp) > 0.6) {
      this.lastStamp.copy(here);
      const stamps: { x: number; z: number; r: number; amount: number }[] = [];
      for (const z of [3.4, 2.2, 1, -0.4]) {
        const p = t.local(0, z);
        if (cornAt(p.x, p.y)) stamps.push({ x: p.x, z: p.y, r: 1.9, amount: 1 });
      }
      this.corn.flatten(stamps);
    }
    this.stampAcc += dt;
    if (!t.airborne && moving > 3) {
      const offRoad = roadDist(t.pos.x, t.pos.z) > 3.8;
      // Dry dirt throws the most; inside the corn the plants hold most of it down.
      const rate = moving * (t.surface === 2 ? 0.4 : offRoad ? 1.8 : 1.2);
      let w = 0;
      this.dust.spray(rate, dt, () => {
        w = (w + 1) % 2;
        const p = t.local(w ? 0.85 : -0.85, -1.7);
        return [p.x, height(p.x, p.y), p.y, -t.vel.x, -t.vel.y];
      });
    }
  }
}
