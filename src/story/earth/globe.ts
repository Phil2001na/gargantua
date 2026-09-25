import * as THREE from "three";
import { EARTH_R, ATMOSPHERE } from "./geo";

/**
 * The whole Earth, ray traced per pixel behind the local map: an exact sphere (no mesh
 * to tessellate), lit through a single-scattering atmosphere (Rayleigh + Mie). It is the
 * sky and the planet at once. On the ground it hands over to the art-directed dust sky;
 * from a few kilometres up it takes over, and the local map dissolves into it.
 *
 * Frame: the camera sits at (0, R + alt, 0) above the planet's centre, axes as the world's.
 */
export function globeUniforms() {
  const load = (url: string) => {
    const t = new THREE.TextureLoader().load(url);
    t.colorSpace = THREE.SRGBColorSpace;
    t.wrapS = THREE.RepeatWrapping;
    t.anisotropy = 8;
    return t;
  };
  return {
    /** 0 on the ground (dust sky), 1 from high up (physical sky and globe). */
    uSpace: { value: 0 },
    /** Camera height above the ground, metres. */
    uAlt: { value: 1.7 },
    /** Camera-frame directions to Earth-centred coordinates. */
    uToEcef: { value: new THREE.Matrix3() },
    /** The farm's up direction in Earth-centred coordinates. */
    uFarmUp: { value: new THREE.Vector3(0, 1, 0) },
    /** Angle one pixel spans, radians. */
    uPix: { value: 0.001 },
    uEarthMap: { value: load("/textures/earth.jpg") },
    uCloudMap: { value: load("/textures/earth-clouds.png") },
  };
}
export type GlobeUniforms = ReturnType<typeof globeUniforms>;

export const globeGLSL = /* glsl */ `
uniform float uSpace;
uniform float uAlt;
uniform mat3 uToEcef;
uniform vec3 uFarmUp;
uniform float uPix;
uniform sampler2D uEarthMap;
uniform sampler2D uCloudMap;
const float PR=${EARTH_R.toFixed(1)};
const float PA=${ATMOSPHERE.toFixed(1)};
const vec3 BETA_R=vec3(5.8e-6,13.5e-6,33.1e-6);
const float BETA_M=21e-6;
const float H_R=8000., H_M=1200.;
const float PI_G=3.14159265;

// Ray against a sphere of radius R+above around the centre, from height alt, in a
// cancellation-free form (the radii are millions of metres; float has 7 digits).
vec2 shell(float alt,vec3 d,float above){
  float r0=PR+alt;
  float b=r0*d.y;
  float c=(alt-above)*(2.*PR+alt+above);
  float h=b*b-c;
  if(h<0.) return vec2(-1.);
  h=sqrt(h);
  return vec2(-b-h,-b+h);
}
float densR(float h){ return exp(-max(h,0.)/H_R); }
float densM(float h){ return exp(-max(h,0.)/H_M); }
// Optical depth from a point toward the sun, without a second loop: Schüler's
// approximation of the Chapman function (it also darkens the sun past the terminator).
// A nested loop here made the Direct3D shader compiler take most of a minute.
float chapman(float X,float h,float mu){
  float c=sqrt(X+h);
  if(mu>=0.) return c/(c*mu+1.)*exp(-h);
  float x0=sqrt(max(1.-mu*mu,0.))*(X+h);
  return 2.*sqrt(x0)*exp(min(X-x0,60.))-c/(1.-c*mu)*exp(-h);
}
vec2 sunDepth(vec3 p,vec3 s){
  float r=length(p), h=r-PR;
  float mu=dot(p/r,s);
  return vec2(H_R*chapman(PR/H_R,h/H_R,mu),H_M*chapman(PR/H_M,h/H_M,mu));
}
vec3 extinction(vec2 od){ return exp(-(BETA_R*od.x+BETA_M*1.1*od.y)); }

// Ground colour: the photo map, with a patchwork of fields and field-scale variation
// when you are close enough to resolve it.
float gHash(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
vec3 surfaceAlbedo(vec3 ecef,float footprint){
  float lat=asin(clamp(ecef.z,-1.,1.)), lon=atan(ecef.y,ecef.x);
  vec2 uv=vec2(lon/(2.*PI_G)+.5,lat/PI_G+.5);
  float texel=2.*PI_G*PR/2048.;
  float lod=clamp(log2(max(footprint,1.)/texel),0.,10.);
  vec3 c=textureLod(uEarthMap,uv,lod).rgb;
  float water=smoothstep(.02,.1,c.b-max(c.r,c.g)*.9);
  // Farmland: mile-square fields in the plains, fading in once a pixel is a few hundred metres.
  float fields=1.-smoothstep(120.,650.,footprint);
  if(fields>0.&&water<.5){
    vec2 m=vec2(lon*cos(lat),lat)*PR/1609.;
    vec2 cell=floor(m), f=fract(m);
    float k=gHash(cell);
    // Each field a little lighter, darker, greener or browner than the map says.
    vec3 tint=k<.4?vec3(1.05,.95,.85):k<.75?vec3(.85,1.02,.8):vec3(1.2,1.08,.9);
    tint*=.8+.4*gHash(cell+7.);
    float edge=smoothstep(0.,.02,f.x)*smoothstep(0.,.02,f.y);
    tint=mix(vec3(1.25),tint,edge);
    c=mix(c,c*tint,fields);
  }
  return c;
}

// The physical sky and the planet for one view ray. Returns colour; alpha is unused.
vec3 globe(vec3 d,vec3 sun,vec3 sunCol){
  float alt=max(uAlt,1.);
  vec3 o=vec3(0.,PR+alt,0.);
  vec2 atm=shell(alt,d,PA);
  vec2 ground=shell(alt,d,0.);
  bool hitGround=ground.x>0.;
  float tEnd=hitGround?ground.x:atm.y;
  float tStart=max(atm.x,0.);
  vec3 col=vec3(0.);
  vec3 trans=vec3(1.);
  if(atm.y>0.&&tEnd>tStart){
    // March the view ray, sampling densely near the camera where the air is thick.
    float mu=dot(d,sun);
    float phR=3./(16.*PI_G)*(1.+mu*mu);
    float g=.76, g2=g*g;
    float phM=3./(8.*PI_G)*((1.-g2)*(1.+mu*mu))/((2.+g2)*pow(1.+g2-2.*g*mu,1.5));
    vec3 sumR=vec3(0.), sumM=vec3(0.);
    vec2 od=vec2(0.);
    // From the ground, bunch samples near the camera; from space, fewer, spread evenly.
    bool low=alt<20000.;
    float n=low?12.:7.;
    float bunch=low?2.:1.;
    float span=tEnd-tStart;
    float tPrev=tStart;
    for(int i=0;i<12;i++){
      if(float(i)>=n) break;
      float u=(float(i)+1.)/n;
      float t=tStart+span*pow(u,bunch);
      float dt=t-tPrev;
      vec3 p=o+d*(t-dt*.5);
      tPrev=t;
      float h=length(p)-PR;
      vec2 dd=vec2(densR(h),densM(h))*dt;
      od+=dd;
      vec3 att=extinction(od+sunDepth(p,sun));
      sumR+=dd.x*att;
      sumM+=dd.y*att;
    }
    // Scaled to match the surface lighting below (which leaves out the 1/π).
    col=sunCol*(sumR*BETA_R*phR+sumM*BETA_M*phM)*2.1;
    trans=extinction(od);
  }
  if(hitGround){
    vec3 p=o+d*ground.x;
    vec3 n=normalize(p);
    vec3 e=normalize(uToEcef*n);
    float footprint=ground.x*uPix/max(-dot(n,d),.08);
    vec3 alb=surfaceAlbedo(e,footprint);
    float lit=max(dot(n,sun),0.);
    vec3 sunAtP=sunCol*extinction(sunDepth(p+n*50.,sun));
    // Clouds, kept away from the farm (a clear day over the plains).
    float farm=acos(clamp(dot(e,uFarmUp),-1.,1.));
    float cl=texture(uCloudMap,vec2(atan(e.y,e.x)/(2.*PI_G)+.5,asin(clamp(e.z,-1.,1.))/PI_G+.5)).a;
    cl=smoothstep(.15,.9,cl)*smoothstep(.02,.07,farm);
    vec3 surf=alb*(sunAtP*lit*1.8+vec3(.03,.045,.07)*(.4+.6*lit));
    // Glint off the oceans.
    float water=smoothstep(.02,.1,alb.b-max(alb.r,alb.g)*.9);
    surf+=sunAtP*water*pow(max(dot(reflect(d,n),sun),0.),120.)*.8*lit;
    surf=mix(surf,sunAtP*(.75*lit+.05)+vec3(.02,.03,.05),cl*.9);
    col+=surf*trans;
  } else {
    // Space: the sun's disc, and stars where the sky is dark enough.
    float s=dot(d,sun);
    col+=sunCol*trans*smoothstep(.99985,.99992,s)*40.;
    vec3 q=d*520.; vec3 cc=floor(q);
    float r=fract(sin(dot(cc,vec3(12.9898,78.233,37.719)))*43758.5453);
    float star=smoothstep(.14,0.,length(q-cc-.5))*step(.993,r)*(r-.993)*140.;
    float dark=1.-smoothstep(.02,.25,dot(col,vec3(.3,.5,.2)));
    col+=vec3(.9,.93,1.)*star*dark;
  }
  return col;
}
`;
