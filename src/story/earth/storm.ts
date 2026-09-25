import * as THREE from "three";
import { landGLSL, hazeGLSL } from "./land";
import type { EarthUniforms } from "./ground";

const wallVertex = /* glsl */ `
${landGLSL}
${hazeGLSL}
uniform float uFront;
uniform float uTime;
varying vec3 vWorld;
varying vec2 vUv;
varying float vShade;
varying float vTop;
void main(){
  vUv=uv;
  // The wall stands along z at x = uFront, rolling east (+x) with its top boiling forward.
  float z=position.x, y=position.y;
  float b1=vnoise(vec2(z/260.,y/180.-uTime*.05)), b2=vnoise(vec2(z/90.+3.,y/70.-uTime*.11));
  float lean=y/900.;
  float x=uFront+(b1-.5)*160.+(b2-.5)*50.+lean*lean*220.;
  float top=720.+280.*(vnoise(vec2(z/700.,uTime*.02))-.5)+120.*(b2-.5);
  vTop=top-y;
  vec3 w=vec3(x,y+landHeight(vec2(x,z))-8.,z);
  vShade=b1*.6+b2*.4;
  vWorld=w;
  vec3 p=w; p.y-=curveDrop(p);
  gl_Position=projectionMatrix*viewMatrix*vec4(p,1.);
}
`;
const wallFragment = /* glsl */ `
precision highp float;
${landGLSL}
${hazeGLSL}
uniform float uTime;
varying vec3 vWorld;
varying vec2 vUv;
varying float vShade;
varying float vTop;
void main(){
  vec2 w=vWorld.zy;
  float n=vnoise(w/40.+vec2(0.,-uTime*.25))*.5+vnoise(w/13.+vec2(uTime*.1,-uTime*.6))*.3+vnoise(w/4.)*.2;
  // Billows catch the low sun on their tops; the base is dark and dense.
  float h=clamp((vWorld.y+10.)/800.,0.,1.);
  vec3 base=mix(vec3(.09,.055,.03),vec3(.46,.31,.18),pow(h,.7)*.85+vShade*.2);
  base*=.55+.8*n;
  vec3 lit=base*(uAmb*1.4+uSunCol*.35*smoothstep(.3,.9,n+h*.4));
  // Fade the ragged top into the sky.
  float edge=smoothstep(0.,70.,vTop+90.*(n-.5));
  if(edge<=0.) discard;
  vec3 toCam=vWorld-cameraPosition;
  float dist=length(toCam);
  vec3 col=mix(lit,hazeColor(toCam/dist),1.-exp(-dist/(uFogDist*1.6+2000.)));
  gl_FragColor=vec4(col,edge);
}
`;

/**
 * A haboob: a kilometre-high wall of dust rolling across the plains from the west.
 * `front` is the x of its leading edge; behind it the world is inside the storm.
 */
export class Storm {
  readonly group = new THREE.Group();
  private wall: THREE.Mesh;
  private grit: THREE.Points;
  private gritPos: Float32Array;
  private uniforms;
  front = -1e5;
  /** Blowing grit around the camera: 0 none, 1 full storm. */
  strength = 0;
  constructor(u: EarthUniforms) {
    this.uniforms = { ...u, uFront: { value: this.front } };
    const geo = new THREE.PlaneGeometry(16000, 1000, 180, 24);
    geo.translate(0, 500, 0);
    this.wall = new THREE.Mesh(
      geo,
      new THREE.ShaderMaterial({
        uniforms: this.uniforms,
        vertexShader: wallVertex,
        fragmentShader: wallFragment,
        transparent: true,
        side: THREE.DoubleSide,
        depthWrite: true,
      }),
    );
    this.wall.frustumCulled = false;
    this.wall.visible = false;
    // Grit: a box of streaks that wraps around the camera and races past on the wind.
    const n = 2600;
    this.gritPos = new Float32Array(n * 3);
    for (let i = 0; i < n * 3; i++) this.gritPos[i] = Math.random();
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(this.gritPos, 3));
    this.grit = new THREE.Points(
      g,
      new THREE.ShaderMaterial({
        uniforms: { ...u, uCam: { value: new THREE.Vector3() }, uStrength: { value: 0 } },
        vertexShader: /* glsl */ `
          uniform vec3 uCam; uniform float uTime; uniform float uStrength; varying float vA;
          void main(){
            vec3 box=vec3(36.,18.,36.);
            vec3 p=position*box;
            p.x+=uTime*26.*(.7+position.y*.6);
            p.y+=sin(uTime*1.3+position.z*40.)*1.5;
            p=mod(p-uCam+box*.5,box)-box*.5+uCam;
            vec4 mv=viewMatrix*vec4(p,1.);
            gl_Position=projectionMatrix*mv;
            float d=-mv.z;
            vA=uStrength*smoothstep(0.,2.,d)*(1.-smoothstep(10.,18.,d));
            gl_PointSize=vA>0.?clamp(60./d,1.,4.):0.;
          }`,
        fragmentShader: /* glsl */ `
          uniform vec3 uHaze; uniform vec3 uAmb; varying float vA;
          void main(){ vec2 c=gl_PointCoord-.5; if(dot(c,c)>.25) discard; gl_FragColor=vec4(uHaze*1.3+uAmb*.3,vA*.5); }`,
        transparent: true,
        depthWrite: false,
      }),
    );
    this.grit.frustumCulled = false;
    this.group.add(this.wall, this.grit);
  }
  /** How deep in the storm a point is: 0 well ahead of the wall, 1 inside it. */
  inside(x: number) {
    return THREE.MathUtils.smoothstep(this.front - x, -60, 40);
  }
  update(camera: THREE.Camera) {
    this.uniforms.uFront.value = this.front;
    this.wall.visible = this.front > -5e4 && camera.position.x > this.front - 30;
    const m = this.grit.material as THREE.ShaderMaterial;
    m.uniforms.uCam.value.copy(camera.position);
    m.uniforms.uStrength.value = this.strength;
    this.grit.visible = this.strength > 0.01;
  }
}
