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
uniform float uLocalSolar;
uniform float uRemoteSolar;
uniform mat3 uMirror;
uniform float uRho;
uniform float uA;
uniform float uM;
uniform float uL1;
uniform float uL2;
uniform float uRz;

float drdl(float l) {
  float L = abs(l);
  if (L <= uA) return 0.;
  float x = 2. * (L - uA) / (PI * uM);
  float d = (2. / PI) * atan(x);
  return sign(l) * mix(d, 1., smoothstep(uL1, uL2, L));
}
vec3 environment(samplerCube map, float solar, vec3 dir) {
  vec4 o = textureCube(map, dir);
  return solar > .5 ? o.rgb + skyColor(dir) * (1. - o.a) : o.rgb;
}
void main() {
  vec3 d = normalize(vWorld - cameraPosition);
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
  for (int i = 0; i < 360; i++) {
    float h = .04 * r + .01 * uRho;
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
  if (status == 0) { gl_FragColor = vec4(0., 0., 0., 1.); return; }
  vec3 er = cos(phi) * n + sin(phi) * e2;
  vec3 ephi = -sin(phi) * n + cos(phi) * e2;
  vec3 v = normalize(p * er + (b / r) * ephi);
  if (status == 1) {
    // Back on this side. Nearly straight rays let the ordinary 3D scene show through.
    float bend = acos(clamp(dot(d, v), -1., 1.));
    float alpha = smoothstep(.0015, .007, bend);
    gl_FragColor = vec4(environment(uLocal, uLocalSolar, v), alpha);
  } else {
    vec3 out_ = uMirror * (v - 2. * dot(v, er) * er);
    gl_FragColor = vec4(environment(uRemote, uRemoteSolar, normalize(out_)), 1.);
  }
}
