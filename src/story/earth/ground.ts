import * as THREE from "three";
import { landGLSL, hazeGLSL, WATER_Y } from "./land";
import { globeGLSL, globeUniforms } from "./globe";

/** Morning in the dust belt: low sun in the east, a warm haze that swallows the horizon. */
export function earthUniforms() {
  const sun = new THREE.Vector3(0.86, 0.36, -0.36).normalize();
  return {
    uSunDir: { value: sun },
    uSunCol: { value: new THREE.Vector3(2.5, 2.05, 1.5) },
    uAmb: { value: new THREE.Vector3(0.42, 0.43, 0.45) },
    uHaze: { value: new THREE.Vector3(0.62, 0.53, 0.41) },
    uGlow: { value: new THREE.Vector3(1.0, 0.72, 0.4) },
    uFogDist: { value: 3200 },
    uPlanetR: { value: 6371000 },
    uZenith: { value: new THREE.Vector3(0.2, 0.32, 0.5) },
    /** Stars fade in with this (0 by day, 1 on a clear night). */
    uNight: { value: 0 },
    uLampA: { value: new THREE.Vector4() },
    uLampB: { value: new THREE.Vector4() },
    uLampDir: { value: new THREE.Vector3(0, 0, 1) },
    uLampDirB: { value: new THREE.Vector3(0, 0, 1) },
    uTime: { value: 0 },
    /** Horizontal distances over which the local map dissolves into the globe (from high up). */
    uPatch: { value: new THREE.Vector2(1e9, 2e9) },
    ...globeUniforms(),
  };
}
export type EarthUniforms = ReturnType<typeof earthUniforms>;

/** Rings of vertices whose spacing grows with distance: fine underfoot, coarse at the horizon. */
export function polarGrid(rings: number, segments: number, r0: number, rMax: number) {
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

const canopyColour = /* glsl */ `
// Corn seen from above or afar: leaf mass, gold tassels, sun-dried patches.
vec3 canopyAlbedo(vec2 w,float dist){
  float n1=vnoise(w/.9), n2=vnoise(w/3.2+vec2(5.,1.)), n3=vnoise(w/23.), n4=vnoise(w/140.);
  float detail=exp(-dist/180.);
  float leaf=mix(.5,n1*.7+n2*.3,detail)*.8+n3*.2;
  vec3 dark=vec3(.05,.1,.025), lit=vec3(.13,.21,.05);
  vec3 c=mix(dark,lit,leaf);
  float tassel=smoothstep(.6,.9,mix(.55,n1,detail)+n3*.2);
  c=mix(c,vec3(.42,.36,.18),tassel*.25);
  c=mix(c,vec3(.24,.24,.12),smoothstep(.6,.85,n4)*.35);
  // Rows run north-south; they shimmer when too fine to resolve, so fade them.
  float rows=.5+.5*cos(w.x*${(2 * Math.PI / 0.76).toFixed(5)});
  c*=mix(1.,.75+.35*rows,exp(-dist/40.));
  return c;
}
`;

/** From high up, the local map takes its colours from the same map as the globe, so they meet without a seam. */
const fromOrbit = /* glsl */ `
vec3 orbitAlbedo(vec3 col,vec3 wp,float dist){
  if(uSpace<=0.) return col;
  vec3 n=normalize(vec3(wp.x-cameraPosition.x,PR,wp.z-cameraPosition.z));
  vec3 g=surfaceAlbedo(normalize(uToEcef*n),dist*uPix)*1.6;
  return mix(col,g,uSpace*.8);
}
`;

const groundVertex = /* glsl */ `
${landGLSL}
${hazeGLSL}
uniform vec3 uCenter;
uniform float uLift;
varying vec3 vWorld;
varying float vCorn;
varying vec3 vNormal;
void main(){
  vec2 w=position.xz+uCenter.xz;
  // Terrain normal per vertex (the land is gentle; the grid is fine where it matters).
  float e=max(.3,length(position.xz)*.004);
  float h0=landHeight(w), hx=landHeight(w+vec2(e,0.)), hz=landHeight(w+vec2(0.,e));
  vNormal=normalize(vec3(h0-hx,e,h0-hz));
  float corn=uLift>0.?cornAt(w):0.;
  vWorld=vec3(w.x,landHeight(w)+uLift*corn*(.92+.16*vnoise(w/37.)),w.y);
  vCorn=corn;
  vec3 p=vWorld; p.y-=curveDrop(p);
  gl_Position=projectionMatrix*viewMatrix*vec4(p,1.);
}
`;

const groundFragment = /* glsl */ `
precision highp float;
${landGLSL}
${hazeGLSL}
${globeGLSL}
${canopyColour}
${fromOrbit}
uniform float uTime;
uniform vec2 uPatch;
varying vec3 vWorld;
varying vec3 vNormal;
void main(){
  // From high up, the edge of the local map dissolves into the globe.
  if(ihash(gl_FragCoord.xy)<smoothstep(uPatch.x,uPatch.y,length(vWorld.xz-cameraPosition.xz))) discard;
  vec3 toCam=cameraPosition-vWorld; float dist=length(toCam);
  vec2 w=vWorld.xz;
  vec3 n=normalize(vNormal);
  float slope=1.-n.y;
  float road=roadDist(w), corn=cornAt(w);
  float n1=vnoise(w/2.3), n2=vnoise(w/11.), n3=vnoise(w/57.), n4=vnoise(w/260.);
  float fine=exp(-dist/90.);
  // Dust-bowl soil and dry grass.
  vec3 soil=mix(vec3(.3,.24,.17),vec3(.42,.34,.24),n2*.6+n3*.4);
  vec3 grass=mix(vec3(.42,.38,.22),vec3(.52,.45,.28),n1*fine+n3*(1.-fine));
  grass=mix(grass,vec3(.3,.33,.16),smoothstep(.6,.85,n2)*.5);
  vec3 col=mix(soil,grass,smoothstep(.35,.65,n4*.5+n3*.3+n2*.2));
  col*=.85+.3*mix(.5,n1,fine);
  // Under the corn: shaded soil between the rows.
  if(corn>.5){
    float rows=.5+.5*cos(w.x*${(2 * Math.PI / 0.76).toFixed(5)});
    col=mix(vec3(.2,.16,.11),vec3(.26,.21,.14),rows*fine+(1.-fine)*.5);
  }
  // Packed-dirt roads with pale wheel tracks.
  float roadMask=1.-smoothstep(2.6,3.8,road+.8*(n1-.5)*fine);
  vec3 dirt=mix(vec3(.43,.37,.29),vec3(.5,.43,.34),n1*fine+.5*(1.-fine));
  float track=smoothstep(.35,.0,abs(abs(road)-.95))*fine;
  dirt=mix(dirt,vec3(.36,.3,.23),track*.6);
  col=mix(col,dirt,roadMask);
  // Canyon walls: layered sandstone.
  float strata=vnoise(vec2(vWorld.y*1.7,w.y/90.));
  vec3 rock=mix(vec3(.42,.3,.21),vec3(.6,.46,.33),strata);
  col=mix(col,rock,smoothstep(.28,.5,slope));
  // Far away the canopy layer is gone, so the corn is painted onto the ground.
  col=mix(col,canopyAlbedo(w,dist),corn*smoothstep(1300.,1550.,dist));
  col=orbitAlbedo(col,vWorld,dist);
  float diff=max(dot(n,uSunDir),0.);
  float shade=corn>.5?mix(.35,1.,smoothstep(1300.,1550.,dist)):1.;
  vec3 lit=col*(uSunCol*diff*shade+uAmb*(.55+.45*n.y)*mix(.6,1.,shade)+lamps(vWorld,n)*shade);
  gl_FragColor=vec4(applyHaze(lit,vWorld),1.);
}
`;

const canopyFragment = /* glsl */ `
precision highp float;
${landGLSL}
${hazeGLSL}
${globeGLSL}
${canopyColour}
${fromOrbit}
uniform float uInner;
uniform vec2 uPatch;
varying vec3 vWorld;
varying float vCorn;
void main(){
  if(vCorn<.5) discard;
  if(ihash(gl_FragCoord.xy+17.)<smoothstep(uPatch.x,uPatch.y,length(vWorld.xz-cameraPosition.xz))) discard;
  vec3 toCam=cameraPosition-vWorld; float dist=length(toCam);
  // Dissolve into the individual plants close up, and into the ground far away.
  float h=ihash(gl_FragCoord.xy);
  if(h>smoothstep(uInner,uInner+10.,dist)) discard;
  if(h<smoothstep(1300.,1600.,dist)) discard;
  vec3 n=normalize(cross(dFdx(vWorld),dFdy(vWorld)));
  if(n.y<0.) n=-n;
  vec2 w=vWorld.xz;
  vec3 c=canopyAlbedo(w,dist);
  // Steep canopy edges are the sides of the field: stalks in shadow.
  c=mix(c,vec3(.035,.06,.02),smoothstep(.3,.8,1.-n.y));
  c=orbitAlbedo(c,vWorld,dist);
  float diff=max(dot(n,uSunDir),0.)*.85+.15;
  vec3 V=-toCam/dist;
  float through=pow(max(dot(V,uSunDir),0.),4.)*.35;
  vec3 lit=c*(uSunCol*(diff+through)+uAmb+lamps(vWorld,n));
  gl_FragColor=vec4(applyHaze(lit,vWorld),1.);
}
`;

const skyVertex = /* glsl */ `
varying vec3 vDir;
void main(){
  vDir=position;
  // Rotate only: adding the camera position (millions of metres up) would quantise it.
  vec4 p=projectionMatrix*vec4(mat3(viewMatrix)*position,1.);
  gl_Position=vec4(p.xy,p.w*.99999,p.w);
}
`;
const skyFragment = /* glsl */ `
precision highp float;
${hazeGLSL}
${globeGLSL}
uniform float uNight;
varying vec3 vDir;
float starHash(vec3 p){ p=fract(p*.3183099+.1); p*=17.; return fract(p.x*p.y*p.z*(p.x+p.y+p.z)); }
void main(){
  vec3 d=normalize(vDir);
  float h=d.y;
  vec3 zen=uZenith;
  vec3 hor=hazeColor(d)*1.08;
  vec3 col=mix(hor,zen,pow(clamp(h,0.,1.),.5));
  if(h<0.) col=hazeColor(d)*mix(1.,.8,clamp(-h*4.,0.,1.));
  float s=dot(d,uSunDir);
  // The disc: blotted out to a smudge when the air is thick with dust.
  col+=uSunCol*smoothstep(.99955,.99975,s)*6.*clamp(uFogDist/900.,.04,1.);
  col+=uGlow*pow(max(s,0.),600.)*1.5;
  if(uNight>0.&&h>0.){
    // Stars: one per cell of a fine direction grid, dimmer toward the dusty horizon.
    vec3 q=d*420.; vec3 c=floor(q); float r=starHash(c);
    vec3 f=q-c-vec3(.5); float star=smoothstep(.12,0.,length(f))*step(.985,r);
    float band=exp(-pow(dot(d,normalize(vec3(.3,.5,-.8))),2.)*9.)*.5;
    col+=vec3(.9,.92,1.)*star*(r-.985)*90.*uNight*smoothstep(0.,.25,h);
    col+=vec3(.05,.055,.07)*band*uNight*smoothstep(0.,.3,h);
  }
  // Higher up: the real sky, the planet's limb and the whole globe.
  if(uSpace>0.) col=mix(col,globe(d,uSunDir,uSunCol),uSpace);
  gl_FragColor=vec4(col,1.);
}
`;

const waterFragment = /* glsl */ `
precision highp float;
${landGLSL}
${hazeGLSL}
uniform float uTime;
varying vec3 vWorld;
void main(){
  vec3 toCam=cameraPosition-vWorld; float dist=length(toCam); vec3 V=toCam/dist;
  vec2 w=vWorld.xz;
  vec2 g=vec2(vnoise(w/7.+uTime*.12)-.5,vnoise(w/9.-uTime*.1+3.)-.5)*.12*exp(-dist/600.);
  vec3 n=normalize(vec3(g.x,1.,g.y));
  vec3 r=reflect(-V,n);
  float fres=.03+.97*pow(1.-max(dot(n,V),0.),5.);
  vec3 sky=mix(hazeColor(r),uZenith,pow(max(r.y,0.),.5));
  vec3 body=vec3(.06,.08,.07);
  vec3 col=mix(body,sky,fres);
  col+=uSunCol*pow(max(dot(r,uSunDir),0.),300.)*2.;
  gl_FragColor=vec4(applyHaze(col,vWorld),1.);
}
`;

export class Ground {
  readonly group = new THREE.Group();
  private ground: THREE.Mesh;
  private canopy: THREE.Mesh;
  private groundMat: THREE.ShaderMaterial;
  private canopyMat: THREE.ShaderMaterial;
  constructor(u: EarthUniforms) {
    const base = { ...u, uCenter: { value: new THREE.Vector3() } };
    this.groundMat = new THREE.ShaderMaterial({
      uniforms: { ...base, uLift: { value: 0 } },
      vertexShader: groundVertex,
      fragmentShader: groundFragment,
    });
    this.ground = new THREE.Mesh(polarGrid(256, 192, 0.5, 24000), this.groundMat);
    this.ground.frustumCulled = false;
    this.canopyMat = new THREE.ShaderMaterial({
      uniforms: { ...base, uCenter: this.groundMat.uniforms.uCenter, uLift: { value: 2.5 }, uInner: { value: 30 } },
      vertexShader: groundVertex,
      fragmentShader: canopyFragment,
    });
    this.canopy = new THREE.Mesh(polarGrid(200, 224, 0.8, 1700), this.canopyMat);
    this.canopy.frustumCulled = false;
    const sky = new THREE.Mesh(
      new THREE.SphereGeometry(10, 48, 24),
      new THREE.ShaderMaterial({
        uniforms: u,
        vertexShader: skyVertex,
        fragmentShader: skyFragment,
        side: THREE.BackSide,
        depthWrite: false,
      }),
    );
    sky.frustumCulled = false;
    sky.renderOrder = -10;
    // The reservoir: one flat sheet in the canyon (the ground hides it everywhere else).
    const water = new THREE.Mesh(
      new THREE.PlaneGeometry(1400, 5000).rotateX(-Math.PI / 2).translate(1950, WATER_Y, 0),
      new THREE.ShaderMaterial({
        uniforms: u,
        vertexShader: `varying vec3 vWorld; void main(){ vWorld=(modelMatrix*vec4(position,1.)).xyz; gl_Position=projectionMatrix*viewMatrix*vec4(vWorld,1.); }`,
        fragmentShader: waterFragment,
      }),
    );
    this.group.add(sky, this.ground, this.canopy, water);
    this.water = water;
  }
  private water: THREE.Mesh;
  /** Draw the local map (false from orbit, where only the sky and globe remain). */
  set local(on: boolean) {
    this.ground.visible = this.canopy.visible = this.water.visible = on;
  }
  /** Corn plants are drawn individually inside this radius; the canopy takes over beyond it. */
  set plantRadius(r: number) {
    this.canopyMat.uniforms.uInner.value = r - 12;
  }
  update(camera: THREE.Camera) {
    this.groundMat.uniforms.uCenter.value.set(camera.position.x, 0, camera.position.z);
  }
}
