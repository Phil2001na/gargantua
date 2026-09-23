// Procedural celestial sphere shared by every renderer.
// Point stars are generated per pixel from the final ray direction, so they stay
// pin-sharp at any resolution and are displaced correctly by gravitational lensing.
uniform sampler2D uSky;   // diffuse galactic light only (no baked stars)
uniform float uPix;       // angular size of one pixel, radians
uniform float uSkySeed;   // 0 = our sky, 1 = Gargantua's sky
uniform mat3 uSkyRot;     // orientation of the galactic plane
uniform vec3 uNebula;     // tint of the diffuse band
// Set by a lensing renderer: the screen-space derivatives of the sky direction (per
// pixel, world frame), and the magnification relative to an unlensed pixel.
bool st_lensed = false;
vec3 st_jx = vec3(0.), st_jy = vec3(0.);
float st_mu = 1.;
// Frame the star directions are in, relative to the world frame st_jx/st_jy use.
mat3 st_frame = mat3(1.);

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
  float b = pow(h.z, 16.) * gain;
  float px = max(uPix, 1e-7);
  float I;
  if (st_lensed) {
    // A point source stays a point however lensing stretches the sky. Measure the offset
    // from the star in screen pixels through the local lens map, so every star is a round
    // dot about a pixel wide (no arcs, no smears). Magnified stars brighten; squeezed ones
    // dim, more gently than their flux would, so a crowded field stays visible.
    vec2 uc = (id + c) / cells * 2. - 1.;
    float sg = face == 0. || face == 2. || face == 4. ? 1. : -1.;
    vec3 dc = face < 2. ? vec3(sg, uc) : face < 4. ? vec3(uc.x, sg, uc.y) : vec3(uc, sg);
    vec3 delta = normalize(dc) - d;
    vec3 ja = st_frame * st_jx, jb = st_frame * st_jy;
    // Where the sky is squeezed hard, cap each pixel's reach at six unlensed pixels so a
    // star never outgrows its cell (it would show as a square).
    float k = min(1., 6. * px / sqrt(max(max(dot(ja, ja), dot(jb, jb)), 1e-30)));
    ja *= k; jb *= k;
    float aa = dot(ja, ja), ab = dot(ja, jb), bb = dot(jb, jb);
    float det = max(aa * bb - ab * ab, 1e-30);
    float ra = dot(ja, delta), rb = dot(jb, delta);
    vec2 s = vec2(bb * ra - ab * rb, aa * rb - ab * ra) / det;
    float sp = .7 * sizeMul;
    float gainMu = st_mu >= 1. ? min(st_mu, 4.) : sqrt(st_mu);
    I = b * gainMu * exp(-dot(s, s) / (2. * sp * sp));
  } else {
    float sigma = max(px * .7 * sizeMul, 1e-7);
    I = b * exp(-dist * dist / (2. * sigma * sigma));
  }
  float temp = fract(h.z * 37.1 + h.x * 11.3);
  vec3 tint = temp < .22 ? vec3(.66, .76, 1.) : temp > .8 ? vec3(1., .8, .58) : vec3(.96, .95, 1.);
  return tint * I;
}
vec3 st_band(vec3 d) {
  vec2 uv = vec2(atan(d.z, d.x) / 6.28318531 + .5, asin(clamp(d.y, -1., 1.)) / 3.14159265 + .5);
  return texture2D(uSky, uv).rgb;
}
// Point stars for a direction already in the sky's galactic frame; denser along the band.
vec3 st_stars(vec3 d, float seed, vec3 band) {
  float density = clamp(dot(band, vec3(.3, .5, .2)) * 9., 0., 1.);
  vec3 c = starLayer(d, 24., seed, 16., 1.25);
  c += starLayer(d, 64., seed + 7., 2.1, 1.) * (.4 + density * 1.3);
  c += starLayer(d, 170., seed + 13., .5, 1.) * (.2 + density * 2.2);
  return c;
}
vec3 skyColor(vec3 dir) {
  vec3 d = normalize(uSkyRot * dir);
  vec3 band = st_band(d);
  st_frame = uSkyRot;
  return band * uNebula + st_stars(d, uSkySeed, band);
}
/** The diffuse light alone, for skies whose stars are drawn later. */
vec3 skyBand(vec3 dir) {
  return st_band(normalize(uSkyRot * dir)) * uNebula;
}
