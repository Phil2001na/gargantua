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
float lh(float n) { return fract(sin(n) * 43758.5453); }
float ln1(float x) { float i = floor(x), f = fract(x); f = f * f * (3. - 2. * f); return mix(lh(i), lh(i + 1.), f); }
// The film's passage: lanes of light streaming past along the throat, rippling.
vec3 lanes(vec3 d, vec3 n) {
  vec3 e1 = normalize(cross(n, abs(n.y) < .9 ? vec3(0, 1, 0) : vec3(1, 0, 0)));
  vec3 e2 = cross(n, e1);
  float along = dot(d, n);
  float az = atan(dot(d, e2), dot(d, e1));
  // Depth along the tunnel: rushes toward the camera, faster near the walls.
  float depth = abs(along) / max(1. - abs(along), .02);
  float s = depth * 1.5 - uTime * 9.;
  az += .08 * sin(s * .7 + uTime * 1.3) + .03 * sin(az * 9. + uTime * 2.);
  float k = az * 44. / PI;
  float lane = ln1(k) * ln1(k * 2.3 + 7.);
  lane = pow(lane, 2.5) * 3.;
  // Each lane is a train of long dashes rushing past.
  float streak = smoothstep(.15, 1., .5 + .5 * sin(s * 1.3 + lh(floor(k)) * 40.));
  float wall = 1. - smoothstep(.6, .99, abs(along));
  vec3 warm = vec3(1., .8, .52), cool = vec3(.55, .75, 1.);
  return mix(cool, warm, lh(floor(k) + 3.)) * lane * streak * wall * 1.8;
}
void main() {
  vec3 d = normalize(vWorld - cameraPosition);
  // Their touch: a slow ripple through the whole view (cinematic mode only).
  if (uThey > 0.) {
    float w = uThey * uCine * .035;
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
      gl_FragColor.rgb = mix(gl_FragColor.rgb, gl_FragColor.rgb * .35 + lanes(d, uCamN), t * .9);
    }
  }
  // One bad pixel would be smeared across the whole frame by the bloom: never emit one.
  float sum = gl_FragColor.r + gl_FragColor.g + gl_FragColor.b;
  if (!(sum >= 0. && sum < 1e4)) gl_FragColor.rgb = vec3(0.);
}
