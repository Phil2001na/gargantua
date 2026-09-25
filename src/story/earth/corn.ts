import * as THREE from "three";
import { landGLSL, hazeGLSL, ROW_X, ROW_Z } from "./land";
import type { EarthUniforms } from "./ground";

/**
 * Individual corn plants around the camera. Nothing is stored per plant: each instance
 * finds its own spot on a row grid snapped to the camera, hashes its look from that
 * spot, and hides itself outside the fields. Two meshes share the job: a detailed plant
 * close up and a lighter one out to the edge of the ring, where the canopy takes over.
 */

type Builder = { pos: number[]; nrm: number[]; kind: number[]; t: number[] };

function quad(b: Builder, a: THREE.Vector3, c: THREE.Vector3, d: THREE.Vector3, e: THREE.Vector3, kind: number, ta: number, tb: number) {
  // a,c along one edge (bottom), d,e along the top; two triangles.
  const n = new THREE.Vector3().subVectors(c, a).cross(new THREE.Vector3().subVectors(d, a)).normalize();
  for (const [p, t] of [
    [a, ta],
    [c, ta],
    [d, tb],
    [c, ta],
    [e, tb],
    [d, tb],
  ] as [THREE.Vector3, number][]) {
    b.pos.push(p.x, p.y, p.z);
    b.nrm.push(n.x, n.y, n.z);
    b.kind.push(kind);
    b.t.push(t);
  }
}

function plant(detail: boolean) {
  const b: Builder = { pos: [], nrm: [], kind: [], t: [] };
  const H = 2.35;
  // Stalk: a tapered prism (three sides close up, two crossed blades far away).
  const sides = detail ? 3 : 2,
    segs = detail ? 2 : 1;
  for (let s = 0; s < sides; s++) {
    const a0 = (s / sides) * Math.PI * (detail ? 2 : 1),
      a1 = a0 + (detail ? (Math.PI * 2) / sides : Math.PI);
    for (let k = 0; k < segs; k++) {
      const y0 = (H * k) / segs,
        y1 = (H * (k + 1)) / segs;
      const r0 = 0.024 * (1 - (0.6 * k) / segs),
        r1 = 0.024 * (1 - (0.6 * (k + 1)) / segs);
      quad(
        b,
        new THREE.Vector3(Math.cos(a0) * r0, y0, Math.sin(a0) * r0),
        new THREE.Vector3(Math.cos(a1) * r0, y0, Math.sin(a1) * r0),
        new THREE.Vector3(Math.cos(a0) * r1, y1, Math.sin(a0) * r1),
        new THREE.Vector3(Math.cos(a1) * r1, y1, Math.sin(a1) * r1),
        0,
        y0 / H,
        y1 / H,
      );
    }
  }
  // Leaves: long arching blades, alternating sides up the stalk.
  const leaves = detail ? 7 : 4,
    lsegs = detail ? 3 : 2;
  for (let i = 0; i < leaves; i++) {
    const y = 0.35 + (i / (leaves - 1)) * 1.55,
      az = (i % 2 ? 0 : Math.PI) + (i * 0.37 - 1.1) * 0.35;
    const len = 0.95 - Math.abs(i / (leaves - 1) - 0.4) * 0.5,
      width = detail ? 0.085 : 0.17;
    const dir = new THREE.Vector3(Math.cos(az), 0, Math.sin(az)),
      side = new THREE.Vector3(-dir.z, 0, dir.x);
    const at = (u: number) => {
      // Rises, then droops under its own weight.
      const out = len * u,
        up = 0.55 * len * Math.sin(u * 1.9) - 0.25 * len * u * u;
      return new THREE.Vector3(dir.x * out, y + up, dir.z * out);
    };
    for (let k = 0; k < lsegs; k++) {
      const u0 = k / lsegs,
        u1 = (k + 1) / lsegs,
        w0 = width * Math.sin(Math.PI * (0.15 + 0.85 * u0)) + 0.01,
        w1 = width * Math.sin(Math.PI * (0.15 + 0.85 * u1)) * (k === lsegs - 1 ? 0.15 : 1) + 0.005;
      const p0 = at(u0),
        p1 = at(u1);
      quad(
        b,
        p0.clone().addScaledVector(side, -w0 / 2),
        p0.clone().addScaledVector(side, w0 / 2),
        p1.clone().addScaledVector(side, -w1 / 2),
        p1.clone().addScaledVector(side, w1 / 2),
        1,
        u0,
        u1,
      );
    }
  }
  // Tassel: two crossed thin plumes on top.
  for (let s = 0; s < 2; s++) {
    const a = s * Math.PI * 0.5,
      c = new THREE.Vector3(Math.cos(a), 0, Math.sin(a));
    quad(
      b,
      new THREE.Vector3(-c.x * 0.035, H - 0.05, -c.z * 0.035),
      new THREE.Vector3(c.x * 0.035, H - 0.05, c.z * 0.035),
      new THREE.Vector3(-c.x * 0.004, H + 0.32, -c.z * 0.004),
      new THREE.Vector3(c.x * 0.004, H + 0.32, c.z * 0.004),
      2,
      0,
      1,
    );
  }
  // An ear of corn in its husk, close up only.
  if (detail) {
    for (let s = 0; s < 2; s++) {
      const a = 0.7 + s * Math.PI * 0.5,
        c = new THREE.Vector3(Math.cos(a), 0, Math.sin(a)),
        o = new THREE.Vector3(0.05, 1.05, 0.02);
      quad(
        b,
        o.clone().addScaledVector(c, -0.035),
        o.clone().addScaledVector(c, 0.035),
        o.clone().add(new THREE.Vector3(0.09, 0.26, 0.02)).addScaledVector(c, -0.02),
        o.clone().add(new THREE.Vector3(0.09, 0.26, 0.02)).addScaledVector(c, 0.02),
        3,
        0,
        1,
      );
    }
  }
  const g = new THREE.InstancedBufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(b.pos, 3));
  g.setAttribute("normal", new THREE.Float32BufferAttribute(b.nrm, 3));
  g.setAttribute("aKind", new THREE.Float32BufferAttribute(b.kind, 1));
  g.setAttribute("aT", new THREE.Float32BufferAttribute(b.t, 1));
  return g;
}

const vertex = /* glsl */ `
${landGLSL}
${hazeGLSL}
attribute float aKind;
attribute float aT;
uniform float uTime;
uniform vec2 uSnap;
uniform vec2 uGrid;
uniform float uRowStep;
uniform float uInner;
uniform float uOuter;
uniform sampler2D uTrample;
uniform vec4 uTrampleRect;
uniform vec3 uTruck;
varying vec3 vWorld;
varying vec3 vNormal;
varying float vKind;
varying float vT;
varying float vAO;
varying vec3 vTint;
void main(){
  float id=float(gl_InstanceID);
  float col=mod(id,uGrid.x), row=floor(id/uGrid.x);
  vec2 spacing=vec2(${ROW_X},${ROW_Z}*uRowStep);
  vec2 ic=floor(uSnap/spacing+.5)+vec2(col,row)-floor(uGrid*.5);
  vec2 cell=ic*spacing;
  // Cheap rejections first: outside the ring, then a gap in the row, then not a cornfield.
  float dist=length(cell-cameraPosition.xz);
  if(dist<uInner-.5||dist>uOuter+.5){ gl_Position=vec4(0.,0.,-2.,1.); return; }
  float h1=ihash(ic*vec2(1.,uRowStep)), h2=ihash(ic+vec2(31.,17.)), h3=ihash(ic+vec2(-7.,53.));
  vec2 base=cell+vec2((h1-.5)*.1,(h2-.5)*.12);
  dist=length(base-cameraPosition.xz);
  float keep=step(h3,.94)*step(uInner,dist)*step(dist,uOuter);
  // Thin out the last few metres so the edge of the ring doesn't show.
  keep*=step(h2,1.-smoothstep(uOuter-8.,uOuter,dist));
  if(keep<.5||cornAt(base)<.5){ gl_Position=vec4(0.,0.,-2.,1.); return; }
  float scale=.88+.26*h3;
  vec3 p=position; p.y*=scale;
  float a=h1*6.2832; float ca=cos(a), sa=sin(a);
  p.xz=mat2(ca,-sa,sa,ca)*p.xz;
  vec3 nrm=normal; nrm.xz=mat2(ca,-sa,sa,ca)*nrm.xz;
  float hn=clamp(p.y/2.5,0.,1.);
  // Wind: slow gusts rolling across the field, with a quicker flutter on the leaves.
  float gust=vnoise(base*.025+vec2(uTime*.4,uTime*.13));
  vec2 wind=vec2(.9,.35)*(.03+.2*gust*gust)*(.6+.4*sin(uTime*1.9+base.x*.4+base.y*.25));
  p.xz+=wind*hn*hn*2.4;
  p.y+=aKind==1.?sin(uTime*6.+h1*20.+aT*3.)*.015*aT:0.;
  // Flattened where the truck has driven through.
  vec2 tuv=(base-uTrampleRect.xy)/uTrampleRect.zw;
  float tr=0.;
  if(tuv.x>0.&&tuv.y>0.&&tuv.x<1.&&tuv.y<1.) tr=texture2D(uTrample,tuv).r;
  if(tr>.02){
    float ang=tr*1.45*(.8+.2*h3);
    vec2 dir=normalize(vec2(h2-.5,h1-.5)+1e-3);
    float y=p.y;
    p.xz+=dir*sin(ang)*y;
    p.y=y*cos(ang)+.04;
  }
  // Plants right against the truck are shoved aside and under it.
  vec2 rel=base-uTruck.xy;
  float sh=sin(uTruck.z), ch=cos(uTruck.z);
  vec2 lt=vec2(rel.x*ch-rel.y*sh, rel.x*sh+rel.y*ch);
  vec2 outside=max(abs(lt)-vec2(1.05,2.9),0.);
  float push=1.-smoothstep(0.,1.3,length(outside));
  if(push>0.){
    float side=lt.x>=0.?1.:-1.;
    vec2 away=vec2(side*ch, -side*sh);
    float ang=push*1.35;
    float y=p.y;
    p.xz=p.xz*(1.-push*.6)+away*sin(ang)*y;
    p.y=y*cos(ang)+.03;
  }
  vec3 world=vec3(base.x,landHeight(base),base.y)+p;
  vWorld=world; vNormal=nrm; vKind=aKind; vT=aT;
  vAO=mix(.28,1.,smoothstep(.0,2.3,position.y))*mix(1.,.8,tr);
  vTint=vec3(h1,h2,h3);
  gl_Position=projectionMatrix*viewMatrix*vec4(world,1.);
}
`;

const fragment = /* glsl */ `
precision highp float;
${hazeGLSL}
varying vec3 vWorld;
varying vec3 vNormal;
varying float vKind;
varying float vT;
varying float vAO;
varying vec3 vTint;
void main(){
  vec3 n=normalize(vNormal); if(!gl_FrontFacing) n=-n;
  vec3 V=normalize(vWorld-cameraPosition);
  vec3 c;
  if(vKind<.5) c=mix(vec3(.2,.25,.08),vec3(.32,.33,.14),vT);
  else if(vKind<1.5){
    c=mix(vec3(.1,.22,.045),vec3(.2,.32,.07),vTint.x);
    // Dry, curling tips on the older leaves.
    c=mix(c,vec3(.45,.38,.2),smoothstep(.62,1.,vT)*(.35+.5*vTint.y));
  } else if(vKind<2.5) c=mix(vec3(.36,.3,.14),vec3(.5,.42,.2),vT*vTint.z);
  else c=vec3(.38,.44,.16);
  c*=.85+.3*vTint.z;
  float diff=max(dot(n,uSunDir),0.);
  // Thin leaves glow when the sun is behind them.
  float through=pow(max(dot(V,uSunDir),0.),3.)*(vKind>.5&&vKind<1.5?.7:.15);
  vec3 lit=c*(uSunCol*(diff*.8+through)*vAO+uAmb*vAO*1.1+lamps(vWorld,n)*vAO);
  gl_FragColor=vec4(applyHaze(lit,vWorld),1.);
}
`;

export class Corn {
  readonly group = new THREE.Group();
  readonly trample: THREE.WebGLRenderTarget;
  /** World rectangle covered by the trample map: x0, z0, width, depth. */
  readonly trampleRect = new THREE.Vector4(-300, -1100, 2048, 2048);
  private near: THREE.Mesh;
  private far: THREE.Mesh;
  private stampScene = new THREE.Scene();
  private stampCamera = new THREE.OrthographicCamera(0, 1, 1, 0, -1, 1);
  private stamp: THREE.Mesh;
  private radius = 40;
  /** Truck x, z and heading, for pushing plants out of its way. */
  readonly truck = new THREE.Vector3(1e6, 1e6, 0);
  constructor(
    u: EarthUniforms,
    private renderer: THREE.WebGLRenderer,
  ) {
    this.trample = new THREE.WebGLRenderTarget(2048, 2048, { depthBuffer: false });
    const clearColor = renderer.getClearColor(new THREE.Color()),
      clearAlpha = renderer.getClearAlpha();
    renderer.setRenderTarget(this.trample);
    renderer.setClearColor(0x000000, 0);
    renderer.clear();
    renderer.setRenderTarget(null);
    renderer.setClearColor(clearColor, clearAlpha);
    const make = (detail: boolean) => {
      const m = new THREE.Mesh(
        plant(detail),
        new THREE.ShaderMaterial({
          uniforms: {
            ...u,
            uSnap: { value: new THREE.Vector2() },
            uGrid: { value: new THREE.Vector2() },
            uRowStep: { value: detail ? 1 : 2 },
            uInner: { value: 0 },
            uOuter: { value: 0 },
            uTrample: { value: this.trample.texture },
            uTrampleRect: { value: this.trampleRect },
            uTruck: { value: this.truck },
          },
          vertexShader: vertex,
          fragmentShader: fragment,
          side: THREE.DoubleSide,
        }),
      );
      m.frustumCulled = false;
      this.group.add(m);
      return m;
    };
    this.near = make(true);
    this.far = make(false);
    this.setRadius(40);
    // Soft round stamp, max-blended so passes don't stack past fully flat.
    this.stamp = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1),
      new THREE.ShaderMaterial({
        uniforms: { uAmount: { value: 1 } },
        vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
        fragmentShader: `uniform float uAmount; varying vec2 vUv; void main(){ float d=length(vUv-.5)*2.; gl_FragColor=vec4(vec3(uAmount*smoothstep(1.,.45,d)),1.); }`,
        blending: THREE.CustomBlending,
        blendEquation: THREE.MaxEquation,
        blendSrc: THREE.OneFactor,
        blendDst: THREE.OneFactor,
        depthTest: false,
        depthWrite: false,
      }),
    );
    this.stampScene.add(this.stamp);
  }
  /** Detailed plants to `radius`/3, lighter ones to `radius`. */
  setRadius(radius: number) {
    this.radius = radius;
    const inner = Math.max(10, radius * 0.33);
    for (const [mesh, r0, r1] of [
      [this.near, 0, inner],
      [this.far, inner, radius],
    ] as [THREE.Mesh, number, number][]) {
      const mat = mesh.material as THREE.ShaderMaterial;
      const step = mesh === this.near ? 1 : 2;
      const grid = new THREE.Vector2(Math.ceil((2 * r1) / ROW_X) + 2, Math.ceil((2 * r1) / (ROW_Z * step)) + 2);
      mat.uniforms.uGrid.value.copy(grid);
      mat.uniforms.uInner.value = r0;
      mat.uniforms.uOuter.value = r1;
      (mesh.geometry as THREE.InstancedBufferGeometry).instanceCount = grid.x * grid.y;
    }
  }
  get plantRadius() {
    return this.radius;
  }
  update(camera: THREE.Camera) {
    for (const m of [this.near, this.far])
      (m.material as THREE.ShaderMaterial).uniforms.uSnap.value.set(camera.position.x, camera.position.z);
  }
  /** Flatten the corn in a disc of the given radius (metres) around a world point. */
  flatten(stamps: { x: number; z: number; r: number; amount: number }[]) {
    if (!stamps.length) return;
    const r = this.trampleRect,
      renderer = this.renderer;
    this.stampCamera.left = r.x;
    this.stampCamera.right = r.x + r.z;
    this.stampCamera.bottom = r.y;
    this.stampCamera.top = r.y + r.w;
    this.stampCamera.updateProjectionMatrix();
    const prevTarget = renderer.getRenderTarget(),
      prevAuto = renderer.autoClear;
    renderer.autoClear = false;
    renderer.setRenderTarget(this.trample);
    for (const s of stamps) {
      // The stamp scene is laid out in the map's own x/z plane (z stored as y).
      this.stamp.position.set(s.x, s.z, 0);
      this.stamp.scale.setScalar(s.r * 2);
      (this.stamp.material as THREE.ShaderMaterial).uniforms.uAmount.value = s.amount;
      renderer.render(this.stampScene, this.stampCamera);
    }
    renderer.setRenderTarget(prevTarget);
    renderer.autoClear = prevAuto;
  }
  reset() {
    const renderer = this.renderer,
      prev = renderer.getRenderTarget();
    renderer.setRenderTarget(this.trample);
    renderer.setClearColor(0x000000, 0);
    renderer.clear();
    renderer.setRenderTarget(prev);
  }
}
