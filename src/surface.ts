import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { FXAAPass } from "three/addons/postprocessing/FXAAPass.js";
import { mergeVertices } from "three/addons/utils/BufferGeometryUtils.js";
import { buildRanger } from "./endurance";

/**
 * True-scale landing sites on two of Gargantua's worlds, in metres:
 *  - Miller: a knee-deep ocean to every horizon, crossed by kilometre-tall tidal waves.
 *  - Mann: fractured ice and rock under a sky of frozen clouds.
 * The ground is an endless procedural height field on a camera-centred polar grid,
 * and Gargantua itself hangs in the sky, ray-traced into a cube map.
 */
export type SurfaceId = "miller" | "mann";

// ---------------------------------------------------------------------------
// Height fields, written twice (JS for flight, GLSL for drawing) with the same
// integer hash so the two agree.
function ihash(x: number, y: number) {
  let h = (Math.imul(x | 0, 1597334677) ^ Math.imul(y | 0, 3812015801 | 0)) >>> 0;
  h = (h ^ (h >>> 16)) >>> 0;
  h = Math.imul(h, 2246822519 | 0) >>> 0;
  h = (h ^ (h >>> 13)) >>> 0;
  h = Math.imul(h, 3266489917 | 0) >>> 0;
  h = (h ^ (h >>> 16)) >>> 0;
  return h * 2.3283064e-10;
}
function vnoise(x: number, y: number) {
  const ix = Math.floor(x),
    iy = Math.floor(y),
    fx = x - ix,
    fy = y - iy,
    ux = fx * fx * (3 - 2 * fx),
    uy = fy * fy * (3 - 2 * fy);
  const a = ihash(ix, iy),
    b = ihash(ix + 1, iy),
    c = ihash(ix, iy + 1),
    d = ihash(ix + 1, iy + 1);
  return (a + (b - a) * ux) * (1 - uy) + (c + (d - c) * ux) * uy;
}
function mannHeight(x: number, z: number) {
  let base = 0,
    a = 0.5,
    qx = x / 5200,
    qy = z / 5200;
  for (let i = 0; i < 4; i++) {
    base += a * vnoise(qx, qy);
    qx = qx * 2.03 + 17.1;
    qy = qy * 2.03 + 9.3;
    a *= 0.5;
  }
  let ridge = 0,
    b = 0.5;
  qx = x / 2600 + 3.7;
  qy = z / 2600 + 1.9;
  for (let i = 0; i < 4; i++) {
    const n = 1 - Math.abs(2 * vnoise(qx, qy) - 1);
    ridge += b * n * n;
    qx = qx * 2.07 + 5.3;
    qy = qy * 2.07 + 2.1;
    b *= 0.5;
  }
  const t = THREE.MathUtils.clamp((base - 0.35) / 0.4, 0, 1),
    plateau = t * t * (3 - 2 * t);
  return 520 * base * base + 420 * ridge * ridge * plateau - 60;
}
/** Miller's tidal waves travel along WAVE_DIR, one every WAVE_PERIOD metres. */
const WAVE_DIR = new THREE.Vector2(0.94, 0.342).normalize();
const WAVE_PERIOD = 30000;
const WAVE_SPEED = 50;
const waveShift = (perp: number) => 900 * Math.sin(perp / 6100) + 500 * Math.sin(perp / 2300 + 1.7);
function millerHeight(x: number, z: number, t: number) {
  const s = x * WAVE_DIR.x + z * WAVE_DIR.y,
    perp = -x * WAVE_DIR.y + z * WAVE_DIR.x;
  const P = WAVE_PERIOD;
  const u = ((((s - WAVE_SPEED * t - waveShift(perp) + P / 2) % P) + P) % P) - P / 2;
  const amp = 1150 * (0.82 + 0.18 * Math.sin(perp / 4700 + 0.6));
  const w = u > 0 ? 650 : 2600;
  // Small swell and ripples live only in the shading: as geometry they would alias.
  return amp * Math.exp(-(u * u) / (w * w));
}

const heightGLSL = /* glsl */ `
uniform float uKind;
uniform float uTime;
float ihash(vec2 c){
  uvec2 q=uvec2(ivec2(c));
  uint h=(q.x*1597334677u)^(q.y*3812015801u);
  h^=h>>16u; h*=2246822519u; h^=h>>13u; h*=3266489917u; h^=h>>16u;
  return float(h)*2.3283064e-10;
}
float vnoise(vec2 p){
  vec2 i=floor(p), f=p-i, u=f*f*(3.-2.*f);
  float a=ihash(i), b=ihash(i+vec2(1,0)), c=ihash(i+vec2(0,1)), d=ihash(i+vec2(1,1));
  return mix(mix(a,b,u.x),mix(c,d,u.x),u.y);
}
float mannHeight(vec2 w){
  float base=0., a=.5; vec2 q=w/5200.;
  for(int i=0;i<4;i++){ base+=a*vnoise(q); q=q*2.03+vec2(17.1,9.3); a*=.5; }
  float ridge=0., b=.5; q=w/2600.+vec2(3.7,1.9);
  for(int i=0;i<4;i++){ float n=1.-abs(2.*vnoise(q)-1.); ridge+=b*n*n; q=q*2.07+vec2(5.3,2.1); b*=.5; }
  return 520.*base*base+420.*ridge*ridge*smoothstep(.35,.75,base)-60.;
}
const vec2 WD=vec2(${WAVE_DIR.x.toFixed(6)},${WAVE_DIR.y.toFixed(6)});
float millerHeight(vec2 w){
  float s=dot(w,WD), perp=dot(w,vec2(-WD.y,WD.x));
  float shift=900.*sin(perp/6100.)+500.*sin(perp/2300.+1.7);
  float P=${WAVE_PERIOD.toFixed(1)};
  float u=mod(s-${WAVE_SPEED.toFixed(1)}*uTime-shift+P*.5,P)-P*.5;
  float amp=1150.*(.82+.18*sin(perp/4700.+.6));
  float wd=u>0.?650.:2600.;
  return amp*exp(-(u*u)/(wd*wd));
}
float groundHeight(vec2 w){ return uKind<.5?millerHeight(w):mannHeight(w); }
`;

const skyGLSL = /* glsl */ `
uniform samplerCube uGarg;
uniform mat3 uGargRot;
uniform vec3 uHaze;
uniform vec3 uZenith;
uniform vec3 uSunDir;
uniform vec3 uSunColor;
uniform float uGargVis;
vec3 skyAt(vec3 d){
  float h=d.y, up=max(h,0.);
  vec3 base=mix(uHaze,uZenith,pow(up,.5));
  if(h<0.) base=uHaze*(1.-min(-h*1.5,.3));
  // Gargantua and its disk, seen through the air: faint low down, clear overhead.
  float air=exp(-up*5.);
  vec3 g=textureCube(uGarg,uGargRot*d).rgb;
  base+=g*uGargVis*(1.-air*.88)*smoothstep(-.03,.02,h);
  base+=uSunColor*pow(max(dot(d,uSunDir),0.),5.)*.1;
  return base;
}
`;

const groundVertex = /* glsl */ `
${heightGLSL}
uniform vec3 uCenter;
varying vec3 vWorld;
void main(){
  vec2 w=position.xz+uCenter.xz;
  vWorld=vec3(w.x,groundHeight(w),w.y);
  gl_Position=projectionMatrix*viewMatrix*vec4(vWorld,1.);
}
`;
const groundFragment = /* glsl */ `
precision highp float;
${heightGLSL}
${skyGLSL}
uniform vec3 uAmbient;
uniform float uFogDist;
varying vec3 vWorld;
void main(){
  vec3 toCam=cameraPosition-vWorld;
  float dist=length(toCam);
  vec3 V=toCam/dist;
  vec2 w=vWorld.xz;
  // Per-pixel normal from the height field, sampled at a scale that suits the distance.
  float e=max(1.,dist*.003);
  float h0=groundHeight(w), hx=groundHeight(w+vec2(e,0.)), hz=groundHeight(w+vec2(0.,e));
  vec3 macro=normalize(vec3(h0-hx,e,h0-hz));
  vec3 n=macro;
  vec3 col;
  float near=exp(-dist/700.);
  if(uKind<.5){
    // Wind ripples on the shallow water, faded out before they can shimmer.
    // Swell (slope of .6 sin(s/97) and .4 sin(.../53)), then wind ripples.
    float sw=dot(w,WD);
    vec2 g=WD*(.6/97.)*cos(sw/97.-uTime*.8)*exp(-dist/1400.)
      +vec2(.3,.954)*(.4/53.)*cos(dot(w,vec2(.3,.954))/53.-uTime*1.1)*exp(-dist/800.);
    for(int i=0;i<4;i++){
      float fi=float(i);
      vec2 k=vec2(cos(fi*1.7+.4),sin(fi*1.7+.4))*(6.2831/(3.+fi*3.1));
      g+=k*cos(dot(k,w)+uTime*(1.6-fi*.25)+fi*2.)*(.07-fi*.012)*exp(-dist/(260.-fi*40.));
    }
    n=normalize(macro-vec3(g.x,0.,g.y));
    float fres=.02+.98*pow(1.-max(dot(n,V),0.),5.);
    vec3 refl=skyAt(reflect(-V,n));
    float diffuse=max(dot(n,uSunDir),0.);
    vec3 light=uSunColor*diffuse*.5+uAmbient;
    float deep=smoothstep(3.,220.,h0);
    // Shallow water shows the pale seabed; the wave body is deep, cold water.
    vec3 body=mix(vec3(.2,.24,.22),vec3(.025,.07,.08),deep)*light;
    // Light shining through the thinning crest.
    float crest=smoothstep(350.,950.,h0)*(1.-macro.y);
    body+=vec3(.04,.16,.13)*crest*light*1.5;
    col=mix(body,refl,fres);
    // Foam and spray tearing off the steep face.
    float slope=1.-macro.y;
    float foamNoise=vnoise(w/45.+vec2(uTime*.3,0.))*.6+mix(.2,vnoise(w/11.),exp(-dist/3000.))*.4;
    float foam=smoothstep(.25,.65,slope)*smoothstep(150.,650.,h0)*mix(.5,smoothstep(.35,.75,foamNoise),exp(-dist/5000.));
    col=mix(col,vec3(.86,.9,.92)*(light*.8+.2),foam*.85);
    col+=uSunColor*pow(max(dot(reflect(-uSunDir,n),V),0.),220.)*1.6*(1.-foam);
  } else {
    // Detail relief: crusted snow and fractured ice.
    float d0=18.*vnoise(w/140.)+6.*vnoise(w/37.);
    float dx=18.*vnoise((w+vec2(2.,0.))/140.)+6.*vnoise((w+vec2(2.,0.))/37.);
    float dz=18.*vnoise((w+vec2(0.,2.))/140.)+6.*vnoise((w+vec2(0.,2.))/37.);
    n=normalize(macro+vec3(d0-dx,0.,d0-dz)*.5*(.2+.8*exp(-dist/2500.)));
    float slope=1.-macro.y;
    float variation=vnoise(w/180.)*.6+vnoise(w/41.)*.4;
    vec3 snow=vec3(.84,.88,.93), ice=vec3(.5,.64,.76), rock=vec3(.2,.21,.23);
    col=mix(snow,ice,smoothstep(.12,.32,slope+variation*.18-.08));
    col=mix(col,rock,smoothstep(.34,.55,slope+variation*.12));
    // Hairline crevasses.
    float crack=abs(vnoise(w/95.+vec2(vnoise(w/400.)*2.))-.5);
    col*=mix(.45,1.,smoothstep(0.,.02,crack)+(1.-exp(-dist/3000.)));
    float diffuse=max(dot(n,uSunDir),0.);
    col*=uSunColor*diffuse+uAmbient*(.55+.45*n.y);
    col+=uSunColor*pow(max(dot(reflect(-uSunDir,n),V),0.),60.)*.25*(1.-slope);
  }
  // Aerial perspective, thicker near the ground.
  float fog=1.-exp(-dist/uFogDist*(.6+.4*exp(-max(vWorld.y,0.)/2500.)));
  col=mix(col,skyAt(-V),fog);
  gl_FragColor=vec4(col,1.);
}
`;
const domeVertex = `varying vec3 vDir; void main(){vDir=(modelMatrix*vec4(position,0.)).xyz;vec4 p=projectionMatrix*viewMatrix*vec4(cameraPosition+vDir,1.);gl_Position=vec4(p.xy,p.w*.999999,p.w);}`;

/** Rings of vertices whose spacing grows with distance: fine underfoot, coarse at the horizon. */
function polarGrid(rings: number, segments: number, r0: number, rMax: number) {
  const k = Math.log(rMax / r0) / (rings - 1);
  const positions = [0, 0, 0];
  for (let i = 0; i < rings; i++) {
    const r = r0 * Math.exp(k * i);
    for (let j = 0; j < segments; j++) {
      const a = (j / segments) * Math.PI * 2;
      positions.push(Math.cos(a) * r, 0, Math.sin(a) * r);
    }
  }
  const index: number[] = [];
  for (let j = 0; j < segments; j++) index.push(0, 1 + ((j + 1) % segments), 1 + j);
  for (let i = 0; i < rings - 1; i++)
    for (let j = 0; j < segments; j++) {
      const a = 1 + i * segments + j,
        b = 1 + i * segments + ((j + 1) % segments),
        c = a + segments,
        d = b + segments;
      index.push(a, b, c, b, d, c);
    }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  g.setIndex(index);
  return g;
}

function ihash3(x: number, y: number, z: number) {
  return ihash(x + Math.imul(z | 0, 7919), y - Math.imul(z | 0, 104729));
}
function vnoise3(x: number, y: number, z: number) {
  const ix = Math.floor(x),
    iy = Math.floor(y),
    iz = Math.floor(z);
  const s = (t: number) => t * t * (3 - 2 * t);
  const fx = s(x - ix),
    fy = s(y - iy),
    fz = s(z - iz);
  const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
  const layer = (zz: number) =>
    lerp(
      lerp(ihash3(ix, iy, zz), ihash3(ix + 1, iy, zz), fx),
      lerp(ihash3(ix, iy + 1, zz), ihash3(ix + 1, iy + 1, zz), fx),
      fy,
    );
  return lerp(layer(iz), layer(iz + 1), fz);
}
/** A lumpy, flat-bottomed slab of frozen cloud with unit radius. */
function cloudGeometry(seed: number) {
  let g: THREE.BufferGeometry = new THREE.IcosahedronGeometry(1, 5);
  g.deleteAttribute("normal");
  g.deleteAttribute("uv");
  g = mergeVertices(g);
  const p = g.attributes.position as THREE.BufferAttribute;
  const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const n =
      vnoise3(v.x * 1.6 + seed, v.y * 1.6, v.z * 1.6 - seed) * 0.6 +
      vnoise3(v.x * 4.5 - seed, v.y * 4.5 + seed, v.z * 4.5) * 0.3 +
      vnoise3(v.x * 11, v.y * 11, v.z * 11 + seed) * 0.1;
    let r = 0.7 + 0.6 * n;
    if (v.y < 0) v.y *= 0.45; // Flattened, sheared-off undersides.
    else r *= 1 + 0.45 * vnoise3(v.x * 3 + seed, 0, v.z * 3);
    v.multiplyScalar(r);
    p.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeVertexNormals();
  return g;
}

type Cloud = { center: THREE.Vector3; scale: THREE.Vector3; yaw: number };
const CLOUD_TILE = 9000;

const settings: Record<
  SurfaceId,
  {
    kind: number;
    haze: number[];
    zenith: number[];
    sun: number[];
    ambient: number[];
    fog: number;
    gargVis: number;
    azimuth: number;
    elevation: number;
    tilt: number;
  }
> = {
  miller: {
    kind: 0,
    haze: [0.6, 0.64, 0.64],
    zenith: [0.3, 0.38, 0.44],
    sun: [1.05, 0.86, 0.64],
    ambient: [0.34, 0.38, 0.4],
    fog: 17000,
    gargVis: 1,
    azimuth: -0.42,
    elevation: 0.3,
    tilt: 0.22,
  },
  mann: {
    kind: 1,
    haze: [0.74, 0.79, 0.85],
    zenith: [0.36, 0.5, 0.68],
    sun: [1.35, 1.25, 1.12],
    ambient: [0.3, 0.35, 0.42],
    fog: 32000,
    gargVis: 0.75,
    azimuth: 0.55,
    elevation: 0.24,
    tilt: -0.12,
  },
};

export type SurfaceInput = {
  keys: Set<string>;
  steerX: number;
  steerY: number;
  boost: number;
  zoom: number;
  view: "chase" | "hull" | "cockpit";
  look: THREE.Quaternion;
  paused: boolean;
};

export class Surface {
  active = false;
  id: SurfaceId = "miller";
  /** Seconds spent on this world (Miller's clock runs ~61,000× slower than Earth's). */
  time = 0;
  thrust = 0;
  private scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(55, 1, 0.5, 160000);
  private composer: EffectComposer;
  private fxaa = new FXAAPass();
  private ranger = buildRanger();
  private ground: THREE.Mesh;
  private groundMaterial: THREE.ShaderMaterial;
  private sky: THREE.Mesh;
  private sun = new THREE.DirectionalLight(0xffffff, 2);
  private hemi = new THREE.HemisphereLight(0xbfd0e0, 0x8a9096, 0.8);
  private clouds: THREE.InstancedMesh[] = [];
  private cloudList: Cloud[] = [];
  private cloudTile = "";
  private garg = new THREE.WebGLCubeRenderTarget(512, {
    type: THREE.HalfFloatType,
    generateMipmaps: false,
    minFilter: THREE.LinearFilter,
  });
  private gargCam = new THREE.CubeCamera(0.05, 10, this.garg);
  private gargStep = -1;
  private ship = {
    pos: new THREE.Vector3(),
    vel: new THREE.Vector3(),
    quat: new THREE.Quaternion(),
    ang: new THREE.Vector3(),
  };
  private camQuat = new THREE.Quaternion();
  altitude = 0;
  constructor(
    private renderer: THREE.WebGLRenderer,
    private gargScene: THREE.Scene,
  ) {
    const common = {
      uKind: { value: 0 },
      uTime: { value: 0 },
      uGarg: { value: this.garg.texture },
      uGargRot: { value: new THREE.Matrix3() },
      uHaze: { value: new THREE.Color() },
      uZenith: { value: new THREE.Color() },
      uSunDir: { value: new THREE.Vector3(0, 1, 0) },
      uSunColor: { value: new THREE.Color() },
      uGargVis: { value: 1 },
    };
    this.groundMaterial = new THREE.ShaderMaterial({
      vertexShader: groundVertex,
      fragmentShader: groundFragment,
      uniforms: {
        ...common,
        uCenter: { value: new THREE.Vector3() },
        uAmbient: { value: new THREE.Color() },
        uFogDist: { value: 20000 },
      },
    });
    this.ground = new THREE.Mesh(polarGrid(300, 256, 1.2, 120000), this.groundMaterial);
    this.ground.frustumCulled = false;
    this.sky = new THREE.Mesh(
      new THREE.SphereGeometry(1, 32, 16),
      new THREE.ShaderMaterial({
        vertexShader: domeVertex,
        fragmentShader: `precision highp float;\n${skyGLSL}\nvarying vec3 vDir;void main(){gl_FragColor=vec4(skyAt(normalize(vDir)),1.);}`,
        uniforms: common,
        side: THREE.BackSide,
        depthWrite: false,
      }),
    );
    this.sky.frustumCulled = false;
    this.sky.renderOrder = -100;
    const cloudMaterial = new THREE.MeshStandardMaterial({
      color: new THREE.Color(0.86, 0.91, 0.96),
      roughness: 0.62,
      metalness: 0,
      emissive: new THREE.Color(0.07, 0.11, 0.15),
    });
    for (let i = 0; i < 3; i++) {
      const mesh = new THREE.InstancedMesh(cloudGeometry(i * 13.7 + 2), cloudMaterial, 64);
      mesh.count = 0;
      mesh.frustumCulled = false;
      this.clouds.push(mesh);
      this.scene.add(mesh);
    }
    this.scene.add(this.sky, this.ground, this.ranger.group, this.sun, this.sun.target, this.hemi);
    this.composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType }));
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.composer.addPass(new UnrealBloomPass(new THREE.Vector2(1, 1), 0.22, 0.4, 1.35));
    this.composer.addPass(new OutputPass());
    this.composer.addPass(this.fxaa);
  }
  setMultisampling(on: boolean) {
    for (const target of [this.composer.renderTarget1, this.composer.renderTarget2]) {
      target.samples = on ? 4 : 0;
      target.dispose();
    }
    this.fxaa.enabled = !on;
  }
  setSize(w: number, h: number) {
    this.composer.setSize(w, h);
    this.camera.aspect = innerWidth / innerHeight;
    this.camera.updateProjectionMatrix();
  }
  heightAt(x: number, z: number) {
    return this.id === "miller" ? millerHeight(x, z, this.time) : mannHeight(x, z);
  }
  /** Land at a world. `gargPoint` is where that world sits in Gargantua's frame. */
  enter(id: SurfaceId, gargPoint: THREE.Vector3) {
    const cfg = settings[id];
    this.id = id;
    this.active = true;
    const u = this.groundMaterial.uniforms;
    u.uKind.value = cfg.kind;
    u.uHaze.value.setRGB(cfg.haze[0], cfg.haze[1], cfg.haze[2]);
    u.uZenith.value.setRGB(cfg.zenith[0], cfg.zenith[1], cfg.zenith[2]);
    u.uSunColor.value.setRGB(cfg.sun[0], cfg.sun[1], cfg.sun[2]);
    u.uAmbient.value.setRGB(cfg.ambient[0], cfg.ambient[1], cfg.ambient[2]);
    u.uFogDist.value = cfg.fog;
    u.uGargVis.value = cfg.gargVis;
    this.scene.fog = new THREE.FogExp2(new THREE.Color(cfg.haze[0], cfg.haze[1], cfg.haze[2]), 1 / cfg.fog);

    // Arrive heading into the incoming waves (Miller) or across the ice (Mann).
    const heading = new THREE.Vector3(-WAVE_DIR.x, 0, -WAVE_DIR.y);
    if (id === "mann") heading.set(0.3, 0, -1).normalize();
    const right = heading.clone().cross(new THREE.Vector3(0, 1, 0)).normalize();
    // Gargantua's place in the sky, and the matching rotation into its frame.
    const gDir = heading
      .clone()
      .multiplyScalar(Math.cos(cfg.azimuth))
      .addScaledVector(right, Math.sin(cfg.azimuth))
      .multiplyScalar(Math.cos(cfg.elevation))
      .add(new THREE.Vector3(0, Math.sin(cfg.elevation), 0))
      .normalize();
    const a2 = new THREE.Vector3(0, 1, 0).addScaledVector(gDir, -gDir.y).normalize().applyAxisAngle(gDir, cfg.tilt);
    const A = new THREE.Matrix4().makeBasis(gDir, a2, gDir.clone().cross(a2));
    const b1 = gargPoint.clone().negate().normalize();
    const b2 = new THREE.Vector3(0, 1, 0).addScaledVector(b1, -b1.y).normalize();
    const B = new THREE.Matrix4().makeBasis(b1, b2, b1.clone().cross(b2));
    u.uGargRot.value.setFromMatrix4(B.multiply(A.transpose()));
    // The disk lights the world from Gargantua's direction.
    u.uSunDir.value.copy(gDir).setY(Math.max(gDir.y * 0.8, 0.12)).normalize();
    this.sun.position.copy(u.uSunDir.value).multiplyScalar(1000);
    this.sun.color.setRGB(cfg.sun[0], cfg.sun[1], cfg.sun[2]);
    this.sun.intensity = id === "miller" ? 1.6 : 2.4;
    this.hemi.color.setRGB(cfg.zenith[0] * 2, cfg.zenith[1] * 2, cfg.zenith[2] * 2);
    this.hemi.groundColor.setRGB(cfg.haze[0], cfg.haze[1], cfg.haze[2]);

    this.gargCam.position.copy(gargPoint);
    this.gargCam.updateMatrixWorld();
    this.gargStep = -1;

    // Miller: the next wave is 7 km out and closing. Mann: over a ridge line.
    const s = this.ship;
    if (id === "miller") {
      const shift0 = waveShift(0);
      this.time = ((((-7000 - shift0) % WAVE_PERIOD) + WAVE_PERIOD) % WAVE_PERIOD) / WAVE_SPEED;
      s.pos.set(0, 1800, 0);
    } else {
      this.time = 0;
      s.pos.set(0, 0, 0);
      s.pos.y = Math.max(mannHeight(0, 0), 0) + 1300;
    }
    const target = s.pos.clone().addScaledVector(heading, 1000).add(new THREE.Vector3(0, -140, 0));
    s.quat.setFromRotationMatrix(new THREE.Matrix4().lookAt(s.pos, target, new THREE.Vector3(0, 1, 0)));
    s.vel.copy(target).sub(s.pos).setLength(260);
    s.ang.set(0, 0, 0);
    this.camQuat.copy(s.quat);
    this.cloudTile = "";
    for (const m of this.clouds) m.visible = id === "mann";
  }
  leave() {
    this.active = false;
  }
  /** Keep Gargantua's disk turning: re-trace a quarter of one cube face per frame. */
  private refreshGargantua() {
    const target = this.garg;
    if (this.gargStep < 0) {
      target.scissorTest = false;
      this.gargCam.update(this.renderer, this.gargScene);
      this.gargStep = 0;
      return;
    }
    const face = Math.floor(this.gargStep / 4),
      strip = this.gargStep % 4,
      size = target.width,
      h = size / 4;
    target.scissor.set(0, strip * h, size, h);
    target.scissorTest = true;
    const previous = this.renderer.getRenderTarget();
    this.renderer.setRenderTarget(target, face);
    this.renderer.render(this.gargScene, this.gargCam.children[face] as THREE.Camera);
    this.renderer.setRenderTarget(previous);
    target.scissorTest = false;
    this.gargStep = (this.gargStep + 1) % 24;
  }
  private placeClouds(camera: THREE.Vector3) {
    if (this.id !== "mann") return;
    const tx = Math.floor(camera.x / CLOUD_TILE),
      tz = Math.floor(camera.z / CLOUD_TILE),
      key = `${tx},${tz}`;
    if (key === this.cloudTile) return;
    this.cloudTile = key;
    this.cloudList = [];
    const counts = [0, 0, 0];
    const m = new THREE.Matrix4(),
      q = new THREE.Quaternion();
    for (let i = tx - 3; i <= tx + 3; i++)
      for (let j = tz - 3; j <= tz + 3; j++) {
        if (ihash(i * 3 + 11, j * 5 - 7) > 0.72) continue;
        const h = (k: number) => ihash(i * 31 + k, j * 17 - k * 3);
        const cloud: Cloud = {
          center: new THREE.Vector3((i + 0.15 + 0.7 * h(1)) * CLOUD_TILE, 1400 + 900 * h(2), (j + 0.15 + 0.7 * h(3)) * CLOUD_TILE),
          scale: new THREE.Vector3(800 + 1400 * h(4), 320 + 480 * h(5), 800 + 1400 * h(6)),
          yaw: h(7) * Math.PI * 2,
        };
        this.cloudList.push(cloud);
        const variant = Math.floor(h(8) * 3) % 3;
        q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), cloud.yaw);
        m.compose(cloud.center, q, cloud.scale);
        this.clouds[variant].setMatrixAt(counts[variant]++, m);
      }
    this.clouds.forEach((mesh, i) => {
      mesh.count = counts[i];
      mesh.instanceMatrix.needsUpdate = true;
    });
  }
  /** Returns true when the Ranger has climbed out of the atmosphere. */
  update(dt: number, input: SurfaceInput) {
    const s = this.ship,
      k = input.keys;
    const step = input.paused ? 0 : dt;
    this.time += step;
    const u = this.groundMaterial.uniforms;
    u.uTime.value = this.time;
    // The Ranger: about 300 m/s on its own, boost for more (limited so the air stays air).
    const cap = 320 * Math.min(input.boost, 25);
    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(s.quat);
    const yaw = Number(k.has("a")) - Number(k.has("d")) - input.steerX;
    const pitch = Number(k.has("r")) - Number(k.has("f")) - input.steerY;
    const roll = Number(k.has("q")) - Number(k.has("e"));
    s.ang.lerp(new THREE.Vector3(pitch * 0.8, yaw * 0.8, roll * 1.2), 1 - Math.exp(-dt * 3.2));
    s.quat.multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(s.ang.x * dt, s.ang.y * dt, s.ang.z * dt, "YXZ"))).normalize();
    const thrust = Number(k.has("w")) - Number(k.has("s"));
    if (thrust) s.vel.addScaledVector(forward, thrust * Math.max(cap * 0.45, 40) * dt);
    if (k.has("x")) s.vel.multiplyScalar(Math.exp(-dt * 2.4));
    else {
      const along = forward.clone().multiplyScalar(s.vel.dot(forward));
      s.vel.sub(along).multiplyScalar(Math.exp(-dt * 1.2)).add(along);
    }
    const v = s.vel.length();
    if (v > cap) s.vel.setLength(THREE.MathUtils.damp(v, cap, 2.2, dt));
    this.thrust = THREE.MathUtils.damp(this.thrust, Math.abs(thrust), 6, dt);
    s.pos.addScaledVector(s.vel, dt);

    // Touch down on water or ice; the waves lift you with them.
    const ground = this.heightAt(s.pos.x, s.pos.z);
    const floor = (this.id === "miller" ? Math.max(ground, 0) : ground) + 2;
    if (s.pos.y < floor) {
      s.pos.y = floor;
      if (s.vel.y < 0) s.vel.y = 0;
      s.vel.x *= Math.exp(-dt * 1.5);
      s.vel.z *= Math.exp(-dt * 1.5);
      // Settle level when resting on the surface.
      if (!thrust && !yaw && !pitch && !roll) {
        const f = forward.clone().setY(0);
        if (f.lengthSq() > 1e-6) {
          const level = new THREE.Quaternion().setFromRotationMatrix(
            new THREE.Matrix4().lookAt(new THREE.Vector3(), f, new THREE.Vector3(0, 1, 0)),
          );
          s.quat.slerp(level, 1 - Math.exp(-dt * 1.5));
        }
      }
    }
    for (const c of this.cloudList) {
      const local = s.pos
        .clone()
        .sub(c.center)
        .applyAxisAngle(new THREE.Vector3(0, 1, 0), -c.yaw)
        .divide(c.scale);
      const r = local.length();
      if (r < 1) {
        local.multiplyScalar(1 / Math.max(r, 1e-3)).multiply(c.scale).applyAxisAngle(new THREE.Vector3(0, 1, 0), c.yaw);
        s.pos.copy(c.center).add(local);
        const n = local.normalize();
        const inward = s.vel.dot(n);
        if (inward < 0) s.vel.addScaledVector(n, -inward);
      }
    }
    this.altitude = s.pos.y - Math.max(ground, this.id === "miller" ? 0 : -Infinity);
    this.ranger.group.position.copy(s.pos);
    this.ranger.group.quaternion.copy(s.quat);
    this.ranger.update(dt, thrust, performance.now() / 1000);

    // Camera.
    const offsets = {
      chase: new THREE.Vector3(0, 12, 46).multiplyScalar(input.zoom),
      hull: new THREE.Vector3(6.5, 4.2, 16),
      cockpit: new THREE.Vector3(0, 2.9, -8.5),
    };
    if (input.view === "chase") this.camQuat.slerp(s.quat, 1 - Math.exp(-dt * 3.2));
    else this.camQuat.copy(s.quat);
    const offset = offsets[input.view].clone();
    if (input.view === "chase") offset.applyQuaternion(input.look);
    offset.applyQuaternion(this.camQuat);
    this.camera.position.copy(s.pos).add(offset);
    const camGround = this.heightAt(this.camera.position.x, this.camera.position.z);
    this.camera.position.y = Math.max(this.camera.position.y, Math.max(camGround, this.id === "miller" ? 0 : -1e9) + 1.5);
    this.camera.quaternion.copy(this.camQuat).multiply(input.look);
    this.camera.near = THREE.MathUtils.clamp(offset.length() * 0.04, 0.3, 40);
    this.camera.updateProjectionMatrix();
    this.camera.updateMatrixWorld();
    u.uCenter.value.set(Math.round(this.camera.position.x), 0, Math.round(this.camera.position.z));
    this.placeClouds(this.camera.position);

    this.refreshGargantua();
    this.composer.render();
    return this.altitude > 16000 && s.vel.y > 0;
  }
  speed() {
    return this.ship.vel.length();
  }
  /** Story mode draws this world with its own camera and composer: here is the scene. */
  get world() {
    return this.scene;
  }
  /** The flying Ranger (story mode hides it and places its own). */
  get flyer() {
    return this.ranger.group;
  }
  /**
   * Story mode: advance the ocean and the sky by `dt` and follow `camera`, without flying
   * the Ranger or rendering (the story does both).
   */
  stage(dt: number, camera: THREE.Camera) {
    // Build the sky a strip at a time from the start: tracing all six faces in one frame can
    // run past the GPU watchdog on integrated graphics and reset the device.
    if (this.gargStep < 0) this.gargStep = 0;
    this.time += dt;
    const u = this.groundMaterial.uniforms;
    u.uTime.value = this.time;
    u.uCenter.value.set(Math.round(camera.position.x), 0, Math.round(camera.position.z));
    this.placeClouds(camera.position);
    this.refreshGargantua();
  }
  /** Seconds until the next wave's crest reaches (x, z), for scripting around it. */
  waveEta(x: number, z: number) {
    const s = x * WAVE_DIR.x + z * WAVE_DIR.y,
      perp = -x * WAVE_DIR.y + z * WAVE_DIR.x;
    const P = WAVE_PERIOD;
    // The crest passes when s − vt − shift ≡ 0 (mod P); that offset shrinks at speed v.
    const q = (((s - WAVE_SPEED * this.time - waveShift(perp)) % P) + P) % P;
    return q / WAVE_SPEED;
  }
  /** Set the clock so the next crest reaches (x, z) in `seconds`. */
  waveIn(x: number, z: number, seconds: number) {
    this.time += this.waveEta(x, z) - seconds;
  }
  /** The direction the waves travel (horizontal, unit). */
  static waveDir() {
    return new THREE.Vector3(WAVE_DIR.x, 0, WAVE_DIR.y);
  }
  /** Where the Ranger is heading, for the climb back to orbit. */
  forward() {
    return new THREE.Vector3(0, 0, -1).applyQuaternion(this.ship.quat);
  }
}
