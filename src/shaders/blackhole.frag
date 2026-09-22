precision highp float;
// Requires shaders/stars.glsl to be prepended (provides uSky, uPix, skyColor).
#ifdef DOME
varying vec3 vDir;
#else
varying vec2 vUv;
uniform vec2 uResolution;
uniform mat3 uBasis;
uniform float uFov;
#endif
uniform vec3 uCamera;
uniform float uTime;
uniform float uExposure;
uniform float uDisk;
uniform float uLensing;
uniform float uDoppler;
uniform float uDust;

#define PI 3.14159265359
float hash(vec2 p) { return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
float noise(vec2 p) {
 vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f);
 return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);
}
float fbm(vec2 p) {
 return noise(p)*.53+noise(p*2.03)*.27+noise(p*4.07)*.13+noise(p*8.1)*.07;
}
vec3 sky(vec3 d) { return skyColor(d); }
vec3 diskColor(vec3 p, vec3 direction) {
 float r=length(p.xz);
 float phi=atan(p.z,p.x);
 float swirl=phi-uTime*.22/pow(r/3.,1.5);
 vec2 q=vec2(cos(swirl),sin(swirl))*r*2.2;
 float turbulence=fbm(q+vec2(fbm(q*.5)*2.5,r*.7));
 float filaments=pow(.5+.5*sin(r*34.+turbulence*18.+swirl*2.),3.)*(.3+.7*noise(q*3.));
 float fine=pow(.5+.5*sin(r*83.+swirl*7.+turbulence*16.),6.);
 float edge=smoothstep(2.85,3.3,r)*(1.-smoothstep(9.,15.,r));
 float heat=pow(3./max(r,3.),1.9);
 float structure=(.30+turbulence*.95+filaments*.8+fine*.18);
 vec3 warm=mix(vec3(1.,.24,.035),vec3(1.,.73,.35),smoothstep(.05,.7,heat));
 warm=mix(warm,vec3(1.,.94,.80),pow(heat,2.)*.65);
 vec3 tangent=normalize(vec3(-p.z,0.,p.x));
 float shift=dot(tangent,-normalize(direction));
 float beaming=mix(1.,pow(1.+shift*.40,3.),uDoppler);
 return warm*heat*structure*edge*beaming*2.6*uDisk;
}
vec3 acceleration(vec3 p,float h2) {
 float r2=dot(p,p);
 return -1.5*h2*p/(r2*r2*sqrt(r2))*uLensing;
}
void main() {
#ifdef DOME
 vec3 ray=normalize(vDir);
#else
 vec2 screen=(vUv-.5)*2.; screen.x*=uResolution.x/uResolution.y;
 vec3 ray=normalize(uBasis*vec3(screen*tan(uFov*.5),-1.));
#endif
 vec3 p=uCamera, velocity=ray;
 float h2=dot(cross(p,velocity),cross(p,velocity));
 vec3 light=vec3(0.); float transmittance=1.;
 bool captured=false;
 for(int i=0;i<240;i++) {
   float r=length(p);
   if(r<1.015) {captured=true;break;}
   if(r>max(65.,length(uCamera)+12.) && dot(p,velocity)>0.) break;
   float stepSize=clamp(r*.075,.022,2.8);
   vec3 a=acceleration(p,h2);
   vec3 mid=p+velocity*stepSize*.5;
   vec3 next=p+velocity*stepSize+a*stepSize*stepSize*.5;
   vec3 nextVel=velocity+acceleration(mid,h2)*stepSize;
   if(p.y*next.y<=0. && abs(p.y-next.y)>.000001) {
     vec3 hit=mix(p,next,clamp(p.y/(p.y-next.y),0.,1.));
     float radius=length(hit.xz);
     if(radius>2.85 && radius<15.) {
       vec3 emission=diskColor(hit,velocity);
       light+=emission*transmittance;
       transmittance*=1.-.88*smoothstep(2.85,3.4,radius)*(1.-smoothstep(10.,15.,radius))*min(uDisk,1.);
     }
   }
   // A finite atmosphere above the disk catches light in wisps and haze.
   float cylindrical=length(mid.xz);
   if(cylindrical>3. && cylindrical<18.) {
     float thickness=.11+cylindrical*.038;
     float density=exp(-abs(mid.y)/thickness*3.0);
     float edge=smoothstep(3.,4.,cylindrical)*(1.-smoothstep(10.,18.,cylindrical));
     if(density>.015) {
       float n=fbm(vec2(cylindrical*1.7,atan(mid.z,mid.x)*5.-uTime*.035));
       float haze=density*edge*stepSize*.14*(.3+n)*uDust*uDisk;
       light+=vec3(.65,.25,.065)*haze*transmittance;
     }
   }
   p=next; velocity=nextVel;
 }
 if(!captured) light+=sky(velocity)*transmittance;
#ifdef DOME
 gl_FragColor=vec4(light*uExposure,1.);
#else
 // Narrow, restrained optical bloom is applied in a separate HDR pass.
 float vignette=1.-.20*pow(length((vUv-.5)*1.25),2.);
 gl_FragColor=vec4(light*uExposure*vignette,1.);
#endif
}
