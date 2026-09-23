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
float diskHalf(float r) { return .026+.0075*max(r-2.85,0.); }
// Volume of the disk at q: rgb = light emitted per unit optical depth, a = extinction.
// Bright billowing gas, darker dust lanes and hot clumps of debris.
vec4 diskMedium(vec3 q, vec3 direction) {
 float r=length(q.xz);
 if(r<2.7 || r>16.) return vec4(0.);
 float phi=atan(q.z,q.x);
 float swirl=phi-uTime*.22/pow(r/3.,1.5);
 vec2 Q=vec2(cos(swirl),sin(swirl))*r*2.2;
 float H=diskHalf(r);
 // The surface billows: local thickness varies with the turbulence.
 float billow=noise(Q*.55+vec2(q.y*3.,0.));
 float puff=H*(.5+1.3*billow*billow);
 float y=q.y/puff;
 float profile=exp(-y*y*1.6);
 if(profile<.02) return vec4(0.);
 float turbulence=fbm(Q+vec2(noise(Q*.5+q.y*4.)*2.5,r*.7));
 float filaments=pow(.5+.5*sin(r*34.+turbulence*18.+swirl*2.),3.)*(.3+.7*noise(Q*3.+q.y*9.));
 float fine=pow(.5+.5*sin(r*83.+swirl*7.+turbulence*16.),6.);
 float dust=smoothstep(.5,.78,noise(Q*1.35+vec2(turbulence*2.,q.y*6.)))*smoothstep(3.6,5.5,r);
 float knots=pow(noise(Q*5.5-vec2(q.y*14.)),9.)*4.;
 float edge=smoothstep(2.85,3.3,r)*(1.-smoothstep(9.,15.5,r));
 float heat=pow(3./max(r,3.),1.9);
 float structure=(.30+turbulence*.95+filaments*.8+fine*.18+knots);
 vec3 warm=mix(vec3(1.,.24,.035),vec3(1.,.73,.35),smoothstep(.05,.7,heat));
 warm=mix(warm,vec3(1.,.94,.80),pow(heat,2.)*.65);
 // Gas away from the midplane is cooler and redder.
 warm*=mix(vec3(1.),vec3(1.,.55,.3),smoothstep(.3,1.2,abs(y)));
 vec3 tangent=normalize(vec3(-q.z,0.,q.x));
 float shift=dot(tangent,-normalize(direction));
 float beaming=mix(1.,pow(1.+shift*.40,3.),uDoppler);
 vec3 source=warm*heat*structure*beaming*2.75*uDisk*(1.-.82*dust)*edge/.94;
 float density=profile*edge*edge*(.55+.9*turbulence)*(1.+2.2*dust*uDust)*min(uDisk,1.);
 return vec4(source,density*2.2/H);
}
vec3 acceleration(vec3 p,float h2) {
 float r2=dot(p,p);
 return -1.5*h2*p/(r2*r2*sqrt(r2))*uLensing;
}
// Weak-field deflection still ahead of a straight ray from p along unit v
// (Schwarzschild, r_s = 1): alpha = (1 - s(2s^2 + 3b^2) / (2r^3)) / b, toward the hole.
vec3 weakBend(vec3 p, vec3 v) {
 float s=dot(p,v);
 vec3 c=p-s*v;
 float b=max(length(c),1e-4), r=length(p);
 float alpha=(1.-s*(2.*s*s+3.*b*b)/(2.*r*r*r))/b*uLensing;
 return normalize(v-alpha*c/b);
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
 // Rays that never come within 19 radii miss the disk and its haze entirely:
 // bend them analytically instead of stepping (most of the sky, most of the time).
 if(h2>361.) velocity=weakBend(p,velocity);
 else for(int i=0;i<240;i++) {
   float r=length(p);
   if(r<1.015) {captured=true;break;}
   // Outbound beyond the haze: finish the remaining weak-field bend in closed form.
   if(r>19. && dot(p,velocity)>0.) {velocity=weakBend(p,normalize(velocity));break;}
   float stepSize=clamp(r*.075,.022,2.8);
   vec3 a=acceleration(p,h2);
   vec3 mid=p+velocity*stepSize*.5;
   vec3 next=p+velocity*stepSize+a*stepSize*stepSize*.5;
   vec3 nextVel=velocity+acceleration(mid,h2)*stepSize;
   // The disk is a flared, turbulent slab: integrate emission and absorption through
   // it wherever this step passes within reach of the midplane.
   float reach=max(diskHalf(max(length(p.xz),length(next.xz)))*1.9,.02);
   if((p.y*next.y<=0. || min(abs(p.y),abs(next.y))<reach) && transmittance>.01) {
     float dy=next.y-p.y, ta=0., tb=1.;
     if(abs(dy)>1e-6) {
       float t1=(-reach-p.y)/dy, t2=(reach-p.y)/dy;
       ta=clamp(min(t1,t2),0.,1.); tb=clamp(max(t1,t2),0.,1.);
     }
     float span=(tb-ta)*stepSize;
     if(span>1e-5) {
       float jitter=fract(52.9829189*fract(dot(gl_FragCoord.xy,vec2(.06711056,.00583715))));
       float samples=clamp(ceil(span/max(reach*.35,.01)),2.,7.);
       float ds=span/samples;
       for(int k=0;k<7;k++) {
         if(float(k)>=samples) break;
         vec3 q=mix(p,next,ta+(tb-ta)*(float(k)+jitter)/samples);
         vec4 m=diskMedium(q,velocity);
         if(m.a<=0.) continue;
         float absorb=1.-exp(-m.a*ds);
         light+=m.rgb*absorb*transmittance;
         transmittance*=1.-absorb;
       }
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
