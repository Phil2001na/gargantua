precision highp float;
// Requires shaders/stars.glsl prepended (configured for our solar sky).
// Null geodesics through the Double Negative wormhole metric. Every pixel's ray is
// integrated in its own plane using the conserved impact parameter b:
//   dℓ/dλ = p,  dp/dλ = b² r′(ℓ) / r³,  dφ/dλ = b / r²
// Rays that reach ℓ → +L2 escape back to this side; ℓ → −L2 emerge on the other.
#define PI 3.14159265359
varying vec3 vWorld;
uniform vec3 uMouth;
uniform float uInside;
uniform vec3 uCamN;
uniform float uCamL;
uniform float uCamR;
uniform samplerCube uLocal;
uniform samplerCube uRemote;
uniform samplerCube uGargSky;
uniform vec3 uGargCam;
uniform float uLocalSolar;
uniform float uRemoteSolar;
uniform mat3 uMirror;
uniform float uRho;
uniform float uA;
uniform float uM;
uniform float uL1;
uniform float uL2;
uniform float uRz;
// Cinematic mode (0 = physical, 1 = the film's look), time, and "their" ripple (0..1).
uniform float uCine;
uniform float uTime;
uniform float uThey;
// How far their wavefront has swept past the camera (0 = ahead, 1 = gone behind).
uniform float uTheyP;
// Cinematic passage: the entry flash (0 = none, then 0..1 as it runs), how far the exit
// has come up ahead (0..1), and which way along the throat normal is ahead (+1 or -1).
uniform float uFlash;
uniform float uExit;
uniform float uAhead;

float drdl(float l) {
  float L = abs(l);
  if (L <= uA) return 0.;
  float x = 2. * (L - uA) / (PI * uM);
  float d = (2. / PI) * atan(x);
  return sign(l) * mix(d, 1., smoothstep(uL1, uL2, L));
}
// Captured worlds over the sky: ours is procedural, Gargantua's comes from its own
// ray-traced cache (sampled directly, so its stars are not resampled twice).
// Gargantua's weak-field bend for rays that pass clear of it (as in blackhole.frag).
vec3 weakBend(vec3 p, vec3 v) {
  float s = dot(p, v);
  vec3 c = p - s * v;
  float b = max(length(c), 1e-4), r = length(p);
  float alpha = (1. - s * (2. * s * s + 3. * b * b) / (2. * r * r * r)) / b;
  return normalize(v - alpha * c / b);
}
vec3 environment(samplerCube map, float solar, vec3 dir) {
  vec4 o = textureCube(map, dir);
  vec3 sky;
  if (solar > .5) sky = skyColor(dir);
  else {
    vec4 g = textureCube(uGargSky, dir);
    vec3 bent = weakBend(uGargCam, dir);
    st_frame = mat3(1.);
    sky = g.rgb + g.a * st_stars(bent, 1., st_band(bent));
  }
  return o.rgb + sky * (1. - o.a);
}
// --- The film's passage (cinematic look only) ---------------------------------------
// Lanes of light made from the real skies at either end of the throat: each azimuth around
// the tunnel reads one great circle of that sky, stretched along the tunnel and scrolling
// toward the camera, so the far galaxy's stars and glow stream past as motion-blurred lanes.
// Diffuse light only (worlds and glow), for a lane sample.
vec3 laneGlow(samplerCube map, float solar, vec3 dir) {
  vec4 o = textureCube(map, dir);
  vec3 sky = solar > .5 ? skyBand(dir) : textureCube(uGargSky, dir).rgb;
  return o.rgb + sky * (1. - o.a);
}
// One of the sky's star layers (same cells and hash as starLayer, so the same stars),
// drawn as streaks along `td`, red leading and blue trailing: the spectral fringe.
vec3 streakLayer(vec3 d, vec3 td, float cells, float seed, float gain, float sp, float sa) {
  vec3 a = abs(d);
  vec2 uv;
  float face;
  if (a.x >= a.y && a.x >= a.z) { uv = d.yz / a.x; face = d.x > 0. ? 0. : 1.; }
  else if (a.y >= a.z) { uv = d.xz / a.y; face = d.y > 0. ? 2. : 3.; }
  else { uv = d.xy / a.z; face = d.z > 0. ? 4. : 5.; }
  vec2 id = floor((uv * .5 + .5) * cells);
  vec3 h = st_hash3(vec3(id + seed * 131.7, face * 17. + seed * 3.1));
  vec2 uc = (id + .15 + .7 * h.xy) / cells * 2. - 1.;
  float sg = face == 0. || face == 2. || face == 4. ? 1. : -1.;
  vec3 dc = face < 2. ? vec3(sg, uc) : face < 4. ? vec3(uc.x, sg, uc.y) : vec3(uc, sg);
  vec3 delta = normalize(dc) - d;
  float x = dot(delta, td);
  float across = exp(-max(dot(delta, delta) - x * x, 0.) / (2. * sp * sp));
  float k = -.5 / (sa * sa), o = sa * .7;
  vec3 I = vec3(exp(k * (x - o) * (x - o)), exp(k * x * x), exp(k * (x + o) * (x + o)));
  float temp = fract(h.z * 37.1 + h.x * 11.3);
  vec3 tint = temp < .22 ? vec3(.66, .76, 1.) : temp > .8 ? vec3(1., .8, .58) : vec3(.96, .95, 1.);
  return tint * I * across * pow(h.z, 5.) * gain;
}
vec3 lanes(vec3 d, vec3 n) {
  float al = dot(d, n);
  // Looking down the tunnel toward the far side (al < 0) you see that side's sky; back
  // toward the mouth you came in by, your own.
  bool far = al < 0.;
  vec3 ax = far ? -n : n;
  vec3 e1 = normalize(cross(ax, abs(ax.y) < .9 ? vec3(0, 1, 0) : vec3(1, 0, 0)));
  vec3 e2 = cross(ax, e1);
  float az = atan(dot(d, e2), dot(d, e1)) + uTime * .04;
  float depth = abs(al) / max(1. - abs(al), .002);
  // Position along each lane: log depth, so the stream speeds up toward the walls.
  float w = .12 * log(depth + .05) + uTime * .22;
  // The lanes ripple a little as they stream, like light through moving water.
  az += .03 * sin(w * 38. + az * 3. + uTime * 1.7);
  vec3 u = cos(az) * e1 + sin(az) * e2;
  vec3 v = ax * .88 + (cos(az) * e2 - sin(az) * e1) * .475;
  vec3 q = cos(w) * u + sin(w) * v;
  vec3 td = cos(w) * v - sin(w) * u;
  float sp = max(length(fwidth(q)) * .6, 2e-4);
  // Into the other side's frame through the bridge's pairing of directions.
  float solar = far ? uRemoteSolar : uLocalSolar;
  vec3 glow;
  if (far) {
    q = uMirror * q;
    td = uMirror * td;
    glow = laneGlow(uRemote, solar, q);
  } else glow = laneGlow(uLocal, solar, q);
  mat3 fr = solar > .5 ? uSkyRot : mat3(1.);
  vec3 sq = normalize(fr * q), st = fr * td;
  float seed = solar > .5 ? uSkySeed : 1.;
  vec3 stars = streakLayer(sq, st, 24., seed, 7., sp, .017) + streakLayer(sq, st, 64., seed + 7., 1.3, sp, .006);
  float wall = 1. - smoothstep(.55, .985, abs(al));
  return (glow * 2.2 + stars) * wall;
}
void main() {
  vec3 d = normalize(vWorld - cameraPosition);
  // Their touch: a wavefront that sweeps through the ship from ahead to behind, bending
  // the view where it passes (in both looks; the film's is stronger).
  float front = 0.;
  if (uThey > 0.) {
    vec3 fwd = -vec3(viewMatrix[0][2], viewMatrix[1][2], viewMatrix[2][2]);
    float x = dot(d, fwd) - (1. - 2.4 * uTheyP);
    front = exp(-x * x / .025) * uThey;
    float w = uThey * (.012 + .03 * uCine) * (.3 + 2. * front / max(uThey, 1e-3));
    d = normalize(d + w * vec3(sin(dot(d, vec3(31., 17., 23.)) + uTime * 5.), sin(dot(d, vec3(19., 37., 11.)) - uTime * 4.), sin(dot(d, vec3(13., 29., 41.)) + uTime * 6.)));
  }
  vec3 n;
  float l, r;
  if (uInside > .5) { n = uCamN; l = uCamL; r = uCamR; }
  else { n = normalize(vWorld - uMouth); l = uL2; r = uRz; }
  float p = dot(d, n);
  vec3 t = d - p * n;
  float tl = length(t);
  vec3 e2 = tl > 1e-6 ? t / tl : normalize(cross(n, abs(n.y) < .9 ? vec3(0, 1, 0) : vec3(1, 0, 0)));
  float b = r * tl, phi = 0.;
  int status = 0;
  for (int i = 0; i < 280; i++) {
    // Step grows with radius; the flare scale M is still resolved by ~4 steps.
    float h = .055 * r + .012 * uRho;
    float s1 = drdl(l);
    float lm = l + p * h * .5;
    float rm = max(r + s1 * p * h * .5, uRho);
    float pm = p + b * b * s1 / (r * r * r) * h * .5;
    float s2 = drdl(lm);
    l += pm * h;
    r = max(r + s2 * pm * h, uRho);
    p += b * b * s2 / (rm * rm * rm) * h;
    phi += b / (rm * rm) * h;
    if (abs(l) >= uL2 && p * l > 0.) { status = l > 0. ? 1 : 2; break; }
  }
  vec3 er = cos(phi) * n + sin(phi) * e2;
  vec3 ephi = -sin(phi) * n + cos(phi) * e2;
  vec3 v = normalize(p * er + (b / r) * ephi);
  vec3 remote = normalize(uMirror * (v - 2. * dot(v, er) * er));
  // The lens map at this pixel, for the star renderer (derivatives taken in uniform flow).
  vec3 sd = status == 2 ? remote : v;
  st_jx = dFdx(sd); st_jy = dFdy(sd);
  st_mu = length(cross(dFdx(d), dFdy(d))) / max(length(cross(st_jx, st_jy)), 1e-24);
  st_lensed = true;
  if (status == 0) gl_FragColor = vec4(0., 0., 0., 1.);
  else if (status == 1) {
    // Back on this side. Nearly straight rays let the ordinary 3D scene show through.
    float bend = acos(clamp(dot(d, v), -1., 1.));
    float alpha = smoothstep(.0015, .007, bend);
    gl_FragColor = vec4(environment(uLocal, uLocalSolar, v), alpha);
  } else {
    gl_FragColor = vec4(environment(uRemote, uRemoteSolar, remote), 1.);
  }
  if (uCine > 0.) {
    // A brighter, sharper crystal ball: the far galaxy lifted, and a glowing Einstein ring
    // where rays graze the throat and wrap around it.
    if (status == 2) gl_FragColor.rgb *= 1. + .45 * uCine;
    // Rays whose impact parameter is just the throat's radius graze it: a thin bright ring.
    float g = (b - uRho) / uRho;
    float ring = exp(-g * g / .0004) + .35 * exp(-g * g / .004);
    gl_FragColor.rgb += vec3(.75, .85, 1.) * ring * uCine * 1.1;
    gl_FragColor.a = max(gl_FragColor.a, ring * uCine);
    // Inside, near the throat: the long passage of light lanes.
    if (uInside > .5) {
      float tunnel = 1. - smoothstep(uA, uL1, abs(uCamL));
      float t = tunnel * uCine;
      // The exit: a disc of the new sky ahead that grows and brightens as it nears.
      float ahead = acos(clamp(dot(d, uCamN * uAhead), -1., 1.));
      float rad = mix(.1, .5, uExit);
      float disc = (1. - smoothstep(rad * .6, rad, ahead)) * uExit;
      gl_FragColor.rgb *= 1. + disc * uCine * .7;
      if (t > 0.) gl_FragColor.rgb = mix(gl_FragColor.rgb, gl_FragColor.rgb * .4 + lanes(d, uCamN), t * .92 * (1. - disc));
    }
    // Entry splash: the sphere's surface sweeps over the frame as a bright expanding ring.
    if (uFlash > 0.) {
      vec3 fw = -vec3(viewMatrix[0][2], viewMatrix[1][2], viewMatrix[2][2]);
      float ang = acos(clamp(dot(d, fw), -1., 1.));
      float fade = 1. - uFlash;
      float fx = ang - uFlash * 1.5;
      float ring = exp(-fx * fx / .006) * fade * fade;
      gl_FragColor.rgb += vec3(.8, .88, 1.) * (ring * 1.1 + .12 * fade * fade * fade) * uCine;
    }
  }
  // The front itself glows faintly, like a heat shimmer catching the light.
  gl_FragColor.rgb += vec3(.55, .65, .9) * front * (.06 + .14 * uCine);
  gl_FragColor.a = max(gl_FragColor.a, front * .5);
  // One bad pixel would be smeared across the whole frame by the bloom: never emit one.
  float sum = gl_FragColor.r + gl_FragColor.g + gl_FragColor.b;
  if (!(sum >= 0. && sum < 1e4)) gl_FragColor.rgb = vec3(0.);
}
