precision highp float;
varying vec3 vNormal;
varying vec3 vWorld;
varying vec3 vLocal;
varying vec2 vUv;
uniform float uTime;
uniform float uKind;
uniform vec3 uColor;
uniform vec3 uLight;
uniform sampler2D uEarth;
uniform float uStorm;
float hash(vec3 p){return fract(sin(dot(p,vec3(127.1,311.7,74.7)))*43758.5453);}
float noise(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(mix(hash(i),hash(i+vec3(1,0,0)),f.x),mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y),f.z);}
float fbm(vec3 p){float n=0.,a=.5;for(int i=0;i<5;i++){n+=a*noise(p);p=p*2.03+7.1;a*=.5;}return n;}
void main(){
 vec3 p=normalize(vLocal),n=normalize(vNormal),eye=normalize(cameraPosition-vWorld),light=normalize(uLight-vWorld);
 float terrain=fbm(p*7.),fine=fbm(p*70.);
 vec3 color=uColor*(.55+terrain*.8+fine*.2);
 if(uKind==1.){
  // Gas giants: soft latitude bands, gently sheared by turbulence.
  float lat=p.y;
  float warp=(fbm(p*vec3(2.5,11.,2.5))-.5)*.07+(fbm(p*vec3(9.,40.,9.))-.5)*.012;
  float b1=sin((lat+warp)*34.),b2=sin((lat+warp*1.3)*83.+1.3),b3=sin((lat+warp*.7)*11.+.4);
  color=uColor*(.84+.09*b1+.045*b2+.07*b3);
  color*=mix(vec3(1.),vec3(.92,.94,1.02),smoothstep(.55,.95,abs(lat)));
  float storm=exp(-pow((p.y+.23)*16.,2.)-pow((p.x-.55)*8.,2.)-pow((p.z-.8)*6.,2.));
  color=mix(color,vec3(.62,.3,.18),storm*.75*uStorm);
 }
 if(uKind==2.)color=mix(uColor*.4,vec3(.88,.94,1.),smoothstep(.32,.68,terrain+fine*.16));
 if(uKind==3.){float waves=pow(.5+.5*sin(p.y*180.+terrain*20.+uTime*.4),12.);color=mix(vec3(.018,.075,.11),vec3(.17,.3,.34),terrain)+waves*.075;}
 if(uKind==4.){color=mix(vec3(.095,.12,.08),vec3(.64,.41,.23),smoothstep(.25,.62,terrain));color=mix(color,vec3(.9,.87,.74),smoothstep(.82,.99,abs(p.y)));}
 if(uKind==6.)color=texture2D(uEarth,vUv).rgb;
 if(uKind==5.){float fire=fbm(p*22.+vec3(0,uTime*.06,0));float granule=noise(p*160.+uTime*.05);color=mix(vec3(1.,.24,.025),vec3(1.,.86,.4),fire)* (1.5+granule*.6);gl_FragColor=vec4(color,1.);return;}
 float day=max(dot(n,light),0.);
 color*=mix(.55,1.,pow(max(dot(n,eye),0.),.35));float rim=pow(1.-max(dot(n,eye),0.),3.);
 color*=.025+day*1.25;
 if(uKind==3.||uKind==6.)color+=vec3(.65,.8,1.)*pow(max(dot(reflect(-light,n),eye),0.),80.)*day*.7;
 if(uKind==6.)color+=vec3(.15,.44,1.)*rim*max(dot(n,light)+.2,0.)*.45;
 gl_FragColor=vec4(color,1.);
}
