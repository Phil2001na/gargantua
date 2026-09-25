/**
 * The Cooper farm and its surroundings, in true-scale metres (y up, +x east, +z south).
 * Everything that decides where things are (terrain height, roads, corn, the reservoir
 * canyon) is written twice, in JS for physics and GLSL for drawing, with the same
 * integer hash so both sides agree.
 *
 *   house at the origin · main road along z = ROAD_Z · reservoir cliff ~1.5 km east
 */

export const ROAD_Z = 60;
export const WATER_Y = -40;
export const CANYON_DEPTH = 48;
export const CANYON_WIDTH = 900;
export const ROW_X = 0.76; // corn row spacing (30 inches)
export const ROW_Z = 0.22; // plant spacing along a row
export const DRIVE_X = 11; // driveway from the yard to the road
/** The fenced compound at the coordinates: 5.4 km up the section road at x = 380. */
export const COMPOUND = { x: 380, z: -5310, hw: 90, hd: 80 };
/** The launch pad, 10 km west of the compound: a cleared square of concrete and gravel. */
export const PAD = { x: -9620, z: -5310, hw: 170, hd: 170 };

function ihash(x: number, y: number) {
  let h = (Math.imul(x | 0, 1597334677) ^ Math.imul(y | 0, 3812015801 | 0)) >>> 0;
  h = (h ^ (h >>> 16)) >>> 0;
  h = Math.imul(h, 2246822519 | 0) >>> 0;
  h = (h ^ (h >>> 13)) >>> 0;
  h = Math.imul(h, 3266489917 | 0) >>> 0;
  h = (h ^ (h >>> 16)) >>> 0;
  return h * 2.3283064e-10;
}
export function vnoise(x: number, y: number) {
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
const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
const fmod = (a: number, b: number) => a - b * Math.floor(a / b);

export function canyonEdge(z: number) {
  return 1500 + 70 * Math.sin(z / 210) + 30 * Math.sin(z / 67 + 1.3);
}
/** Distance to the nearest road centreline (section roads every 800 m, plus the driveway). */
export function roadDist(x: number, z: number) {
  let d = Math.min(Math.abs(fmod(z - ROAD_Z + 400, 800) - 400), Math.abs(fmod(x + 420 + 400, 800) - 400));
  if (x > canyonEdge(z) - 12) d = 1e4;
  if (z > 4 && z < ROAD_Z) d = Math.min(d, Math.abs(x - DRIVE_X) + 1.6);
  return d;
}
/** Distance outside the compound's fence (negative inside). */
export function compoundDist(x: number, z: number) {
  return Math.max(Math.abs(x - COMPOUND.x) - COMPOUND.hw, Math.abs(z - COMPOUND.z) - COMPOUND.hd);
}
/** Distance outside the launch site's clearing (negative inside). */
export function padDist(x: number, z: number) {
  return Math.max(Math.abs(x - PAD.x) - PAD.hw, Math.abs(z - PAD.z) - PAD.hd);
}
function yardDist(x: number, z: number) {
  return Math.hypot(x + 6, (z + 6) * 0.85);
}
export function height(x: number, z: number) {
  let h =
    3 * (vnoise(x / 700, z / 700) - 0.5) +
    1.2 * (vnoise(x / 180 + 7, z / 180 + 3) - 0.5) +
    0.25 * (vnoise(x / 30, z / 30) - 0.5);
  h *= smooth(55, 120, yardDist(x, z)) * smooth(10, 90, compoundDist(x, z)) * smooth(0, 160, padDist(x, z));
  const e = canyonEdge(z),
    d = x - e;
  const rim = 1 + 0.25 * (vnoise(z / 40, 3.1) - 0.5);
  h -= CANYON_DEPTH * rim * smooth(0, 24, d);
  h += CANYON_DEPTH * smooth(0, 70, d - CANYON_WIDTH);
  h += 2.5 * (vnoise(x / 60, z / 60) - 0.5) * smooth(20, 60, d) * (1 - smooth(0, 70, d - CANYON_WIDTH));
  return h;
}
/** 1 where corn grows, 0 elsewhere. */
export function cornAt(x: number, z: number) {
  if (x > canyonEdge(z) - 16) return 0;
  if (roadDist(x, z) < 6) return 0;
  if (yardDist(x, z) < 52) return 0;
  if (compoundDist(x, z) < 30) return 0;
  if (padDist(x, z) < 60) return 0;
  if (x > -40 && x < 1700 && z > -900 && z < 520) return 1;
  const cx = Math.floor((x + 420) / 400),
    cz = Math.floor((z - ROAD_Z) / 400);
  return ihash(cx + 100, cz + 100) < 0.72 ? 1 : 0;
}

/** The same functions in GLSL (ES 3.0). */
export const landGLSL = /* glsl */ `
float ihash(vec2 p){
  uint h=(uint(int(p.x))*1597334677u)^(uint(int(p.y))*3812015801u);
  h^=h>>16u; h*=2246822519u; h^=h>>13u; h*=3266489917u; h^=h>>16u;
  return float(h)*2.3283064e-10;
}
float vnoise(vec2 p){
  vec2 i=floor(p), f=p-i, u=f*f*(3.-2.*f);
  float a=ihash(i), b=ihash(i+vec2(1,0)), c=ihash(i+vec2(0,1)), d=ihash(i+vec2(1,1));
  return mix(mix(a,b,u.x),mix(c,d,u.x),u.y);
}
float canyonEdge(float z){ return 1500.+70.*sin(z/210.)+30.*sin(z/67.+1.3); }
float fmod2(float a,float b){ return a-b*floor(a/b); }
float roadDist(vec2 w){
  float d=min(abs(fmod2(w.y-${ROAD_Z.toFixed(1)}+400.,800.)-400.),abs(fmod2(w.x+820.,800.)-400.));
  if(w.x>canyonEdge(w.y)-12.) d=1e4;
  if(w.y>4.&&w.y<${ROAD_Z.toFixed(1)}) d=min(d,abs(w.x-${DRIVE_X.toFixed(1)})+1.6);
  return d;
}
float yardDist(vec2 w){ return length(vec2(w.x+6.,(w.y+6.)*.85)); }
float compoundDist(vec2 w){ return max(abs(w.x-${COMPOUND.x.toFixed(1)})-${COMPOUND.hw.toFixed(1)},abs(w.y-(${COMPOUND.z.toFixed(1)}))-${COMPOUND.hd.toFixed(1)}); }
float padDist(vec2 w){ return max(abs(w.x-(${PAD.x.toFixed(1)}))-${PAD.hw.toFixed(1)},abs(w.y-(${PAD.z.toFixed(1)}))-${PAD.hd.toFixed(1)}); }
float landHeight(vec2 w){
  float h=3.*(vnoise(w/700.)-.5)+1.2*(vnoise(w/180.+vec2(7,3))-.5)+.25*(vnoise(w/30.)-.5);
  h*=smoothstep(55.,120.,yardDist(w))*smoothstep(10.,90.,compoundDist(w))*smoothstep(0.,160.,padDist(w));
  float e=canyonEdge(w.y), d=w.x-e;
  float rim=1.+.25*(vnoise(vec2(w.y/40.,3.1))-.5);
  h-=${CANYON_DEPTH.toFixed(1)}*rim*smoothstep(0.,24.,d);
  h+=${CANYON_DEPTH.toFixed(1)}*smoothstep(0.,70.,d-${CANYON_WIDTH.toFixed(1)});
  h+=2.5*(vnoise(w/60.)-.5)*smoothstep(20.,60.,d)*(1.-smoothstep(0.,70.,d-${CANYON_WIDTH.toFixed(1)}));
  return h;
}
float cornAt(vec2 w){
  if(w.x>canyonEdge(w.y)-16.) return 0.;
  if(roadDist(w)<6.) return 0.;
  if(yardDist(w)<52.) return 0.;
  if(compoundDist(w)<30.) return 0.;
  if(padDist(w)<60.) return 0.;
  if(w.x>-40.&&w.x<1700.&&w.y>-900.&&w.y<520.) return 1.;
  vec2 c=floor(vec2(w.x+420.,w.y-${ROAD_Z.toFixed(1)})/400.);
  return ihash(c+100.)<.72?1.:0.;
}
`;

/** Shared lighting and dust haze (all custom Earth shaders use it). */
export const hazeGLSL = /* glsl */ `
uniform vec3 uSunDir;
uniform vec3 uSunCol;
uniform vec3 uAmb;
uniform vec3 uHaze;
uniform vec3 uGlow;
uniform float uFogDist;
uniform float uPlanetR;
uniform vec3 uZenith;
// Truck headlights: two lamps (xyz, w = strength) sharing one aim.
uniform vec4 uLampA;
uniform vec4 uLampB;
uniform vec3 uLampDir;
uniform vec3 uLampDirB;
vec3 lampOne(vec4 L,vec3 aim,vec3 wp,vec3 n){
  vec3 d=wp-L.xyz; float r2=max(dot(d,d),.25); vec3 l=d*inversesqrt(r2);
  float cone=smoothstep(.86,.97,dot(l,aim));
  float face=max(dot(n,-l),0.)*.8+.2;
  return vec3(1.,.9,.72)*L.w*cone*face*60./r2;
}
vec3 lamps(vec3 wp,vec3 n){
  vec3 c=vec3(0.);
  if(uLampA.w>0.) c+=lampOne(uLampA,uLampDir,wp,n);
  if(uLampB.w>0.) c+=lampOne(uLampB,uLampDirB,wp,n);
  return c;
}
vec3 hazeColor(vec3 d){
  float s=max(dot(d,uSunDir),0.);
  return uHaze+uGlow*(pow(s,5.)*.55+pow(s,48.)*1.4);
}
vec3 applyHaze(vec3 col,vec3 wp){
  vec3 d=wp-cameraPosition; float dist=length(d);
  float f=1.-exp(-dist/uFogDist*(.55+.45*exp(-max(wp.y+20.,0.)/300.)));
  return mix(col,hazeColor(d/dist),f);
}
// Earth's curvature: the ground falls away as d²/2R from the viewer.
float curveDrop(vec3 wp){ vec2 d=wp.xz-cameraPosition.xz; return dot(d,d)/(2.*uPlanetR); }
`;
