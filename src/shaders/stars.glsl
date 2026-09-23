// Procedural celestial sphere shared by every renderer.
// Point stars are generated per pixel from the final ray direction, so they stay
// pin-sharp at any resolution and are displaced correctly by gravitational lensing.
uniform sampler2D uSky;   // diffuse galactic light only (no baked stars)
uniform float uPix;       // angular size of one pixel, radians
uniform float uSkySeed;   // 0 = our sky, 1 = Gargantua's sky
uniform mat3 uSkyRot;     // orientation of the galactic plane
uniform vec3 uNebula;     // tint of the diffuse band

vec3 st_hash3(vec3 p) {
  p = fract(p * vec3(.1031, .1030, .0973));
  p += dot(p, p.yxz + 33.33);
  return fract((p.xxy + p.yxx) * p.zyx);
}
vec3 starLayer(vec3 d, float cells, float seed, float gain, float sizeMul) {
  vec3 a = abs(d);
  vec2 uv;
  float face;
  if (a.x >= a.y && a.x >= a.z) { uv = d.yz / a.x; face = d.x > 0. ? 0. : 1.; }
  else if (a.y >= a.z) { uv = d.xz / a.y; face = d.y > 0. ? 2. : 3.; }
  else { uv = d.xy / a.z; face = d.z > 0. ? 4. : 5.; }
  vec2 g = (uv * .5 + .5) * cells, id = floor(g), f = fract(g);
  vec3 h = st_hash3(vec3(id + seed * 131.7, face * 17. + seed * 3.1));
  vec2 c = .15 + .7 * h.xy;
  float scale = 2. / cells / (1. + .5 * dot(uv, uv));
  float dist = length(f - c) * scale;
  float sigma = max(uPix * .7 * sizeMul, 1e-5);
  float b = pow(h.z, 16.) * gain;
  float I = b * exp(-dist * dist / (2. * sigma * sigma));
  float temp = fract(h.z * 37.1 + h.x * 11.3);
  vec3 tint = temp < .22 ? vec3(.66, .76, 1.) : temp > .8 ? vec3(1., .8, .58) : vec3(.96, .95, 1.);
  return tint * I;
}
vec3 skyColor(vec3 dir) {
  vec3 d = normalize(uSkyRot * dir);
  vec2 uv = vec2(atan(d.z, d.x) / 6.28318531 + .5, asin(clamp(d.y, -1., 1.)) / 3.14159265 + .5);
  vec3 band = texture2D(uSky, uv).rgb;
  float density = clamp(dot(band, vec3(.3, .5, .2)) * 9., 0., 1.);
  vec3 c = band * uNebula;
  c += starLayer(d, 24., uSkySeed, 16., 1.25);
  c += starLayer(d, 64., uSkySeed + 7., 2.1, 1.) * (.4 + density * 1.3);
  c += starLayer(d, 170., uSkySeed + 13., .5, 1.) * (.2 + density * 2.2);
  return c;
}
