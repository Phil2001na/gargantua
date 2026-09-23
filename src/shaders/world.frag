precision highp float;
varying vec3 vNormal;
varying vec3 vWorld;
varying vec3 vLocal;
varying vec2 vUv;
varying vec3 vRx;
varying vec3 vRy;
varying vec3 vRz;
uniform float uTime;
uniform float uKind;
uniform vec3 uColor;
uniform vec3 uLight;
uniform sampler2D uEarth;
uniform float uStorm;
uniform float uSeed;
// Rocky: 1 Mercury, 2 Mars, else a moon. Gas: 1 Jupiter, 2 Saturn, 3 Uranus, 4 Neptune, 5 Venus.
uniform float uVariant;

// Angular size of one pixel on the unit sphere. Every noise octave finer than this
// fades to its mean, so detail keeps appearing as you close in and never shimmers.
float FP;

// Small-magnitude arithmetic so the lattice stays random thousands of cells out.
float hash(vec3 p) {
  p = fract(p * .1031 + uSeed * .0917);
  p += dot(p, p.zyx + 31.32);
  return fract((p.x + p.y) * p.z);
}
vec3 hash3(vec3 p) {
  p = fract(p * vec3(.1031, .1030, .0973) + uSeed * .173);
  p += dot(p, p.yxz + 33.33);
  return fract((p.xxy + p.yxx) * p.zyx);
}
float noise(vec3 p) {
  vec3 i = floor(p), f = fract(p);
  f = f * f * (3. - 2. * f);
  return mix(mix(mix(hash(i), hash(i + vec3(1, 0, 0)), f.x), mix(hash(i + vec3(0, 1, 0)), hash(i + vec3(1, 1, 0)), f.x), f.y),
             mix(mix(hash(i + vec3(0, 0, 1)), hash(i + vec3(1, 0, 1)), f.x), mix(hash(i + vec3(0, 1, 1)), hash(i + vec3(1, 1, 1)), f.x), f.y), f.z);
}
float lod(float freq) { return 1. - smoothstep(.25, .8, freq * FP); }
// Fractal noise starting at frequency f, up to n octaves, each faded by pixel size.
float fbm(vec3 p, float f, int n) {
  float s = 0., a = .5;
  for (int i = 0; i < 14; i++) {
    if (i >= n) break;
    float k = lod(f);
    if (k <= 0.) { s += a; break; }
    s += a * mix(.5, noise(p * f), k);
    p += vec3(7.1, 3.7, 1.3);
    f *= 2.03;
    a *= .5;
  }
  return s;
}
// Sharp-crested noise for ridges, crevasses and dunes.
float ridged(vec3 p, float f, int n) {
  float s = 0., a = .5;
  for (int i = 0; i < 12; i++) {
    if (i >= n) break;
    float k = lod(f);
    if (k <= 0.) { s += a * .45; break; }
    float r = 1. - abs(2. * noise(p * f) - 1.);
    s += a * mix(.45, r * r, k);
    p += vec3(3.3, 9.1, 5.7);
    f *= 2.07;
    a *= .5;
  }
  return s;
}
// One population of impact craters: a bowl, a raised rim, and bright rays on the youngest.
// Returns (height in unit-sphere units, ray brightness).
vec2 craters(vec3 p, float f, float density) {
  float k = lod(f * 3.);
  if (k <= 0.) return vec2(0.);
  vec3 g = p * f, id = floor(g), fr = fract(g);
  float h = 0., ray = 0.;
  for (int x = -1; x <= 1; x++)
    for (int y = -1; y <= 1; y++)
      for (int z = -1; z <= 1; z++) {
        vec3 o = vec3(float(x), float(y), float(z));
        vec3 r = hash3(id + o);
        if (r.z > density) continue;
        // Mostly small craters, a few large ones, as on real surfaces.
        float rad = .1 + .32 * pow(fract(r.x * 13.7 + r.y * 7.1), 2.5);
        vec3 rel = fr - (o + .2 + .6 * r);
        float d = length(rel) / rad;
        if (d > 3.) continue;
        float bowl = d < 1. ? (d * d - 1.) * .32 : 0.;
        float rim = .12 * exp(-(d - 1.) * (d - 1.) * 9.);
        float apron = .035 * exp(-max(d - 1., 0.) * 2.5);
        h += (bowl + rim + apron) * rad;
        if (r.y > .82) ray += exp(-max(d - 1., 0.) * 1.3) * smoothstep(.45, .8, noise(normalize(rel) * 9. + r * 17.)) * .6;
      }
  return vec2(h / f, ray) * k;
}
// Relief lighting from a height field, in the body's own frame (Mikkelsen 2010).
vec3 bump(vec3 n, float h) {
  vec3 dpdx = dFdx(vLocal), dpdy = dFdy(vLocal);
  float dhx = dFdx(h), dhy = dFdy(h);
  vec3 r1 = cross(dpdy, n), r2 = cross(n, dpdx);
  float det = dot(dpdx, r1);
  vec3 grad = sign(det) * (dhx * r1 + dhy * r2);
  return normalize(abs(det) * n - grad);
}

void main() {
  vec3 P = normalize(vLocal);
  float R = length(vLocal);
  FP = max(length(fwidth(P)), 1e-7);
  mat3 rot = mat3(normalize(vRx), normalize(vRy), normalize(vRz));
  vec3 L = normalize(uLight - vWorld), E = normalize(cameraPosition - vWorld);
  vec3 ng = normalize(vNormal);
  vec3 nl = P;           // shading normal in the body frame, bumped below
  vec3 color;
  float height = 0.;     // unit-sphere units
  float spec = 0.;       // wet or icy fraction
  float haze = 0.;       // limb scattering strength
  vec3 hazeColor = vec3(.6, .75, 1.);
  vec3 glow = vec3(0.);  // light of its own (night-side cities)

  if (uKind == 0.) {
    // Airless or thin-aired rock: old terrain, maria, three generations of craters.
    float mare = smoothstep(.48, .62, fbm(P, 2.2, 4));
    float rough = fbm(P, 9., 12);
    float mercury = step(.5, uVariant) * step(uVariant, 1.5), mars = step(1.5, uVariant) * step(uVariant, 2.5);
    float dens = mars > .5 ? .2 : .7;
    vec2 c1 = craters(P, 5., dens * .7), c2 = craters(P, 17., dens), c3 = craters(P, 61., dens);
    vec2 c4 = craters(P, 230., dens);
    height = (rough - .5) * .012 + c1.x * .5 + c2.x * .6 + c3.x * .7 + c4.x * .8 - mare * .004;
    float rays = (c1.y + c2.y + c3.y) * (1. - mars);
    color = uColor * (.62 + rough * .55 - mare * .28 + rays * .45);
    if (mars > .5) {
      // Dark basaltic regions, dust, and water-ice polar caps.
      float dark = smoothstep(.5, .66, fbm(P + 4., 3., 6));
      color = mix(color, uColor * vec3(.45, .38, .36), dark * .7);
      color *= .85 + .3 * fbm(P, 40., 8);
      float cap = smoothstep(.86, .9, abs(P.y) + (fbm(P, 12., 5) - .5) * .08);
      color = mix(color, vec3(.93, .92, .9), cap);
      haze = .25;
      hazeColor = vec3(.9, .62, .45);
    }
    if (mercury > .5) color *= vec3(1.02, 1., .98);
    nl = bump(P, height * R * 1.3);
  } else if (uKind == 1.) {
    // Gas giants and Venus: bands sheared by latitude-dependent winds, with eddies at the edges.
    float lat = P.y;
    float shear = uTime * .012 * sin(lat * 23. + uSeed);
    float cs = cos(shear), sn = sin(shear);
    vec3 q = vec3(P.x * cs - P.z * sn, P.y, P.x * sn + P.z * cs);
    float warp = (fbm(q * vec3(1., 4.4, 1.), 2.5, 4) - .5) * .07 + (fbm(q * vec3(1., 4.4, 1.) + 5., 9., 9) - .5) * .018;
    float y = lat + warp;
    float b1 = sin(y * 34.), b2 = sin((lat + warp * 1.3) * 83. + 1.3), b3 = sin((lat + warp * .7) * 11. + .4);
    float edge = pow(abs(cos(y * 34.)), 3.);
    float eddy = fbm(q * vec3(1., 2.8, 1.) + 11., 22., 10) - .5;
    float fine = fbm(q * vec3(1., 3.5, 1.) + 23., 90., 8) - .5;
    if (uVariant > 4.5) {
      // Venus: a single deck of sulphuric cloud, faint dark Y-shaped streaks.
      float v = fbm(q * vec3(1.4, 3., 1.4), 3., 10);
      color = uColor * (.9 + .12 * (v - .5) + .05 * b3);
      haze = .5;
      hazeColor = vec3(1., .92, .75);
    } else {
      float contrast = uVariant < 1.5 ? 1.25 : uVariant < 2.5 ? .7 : uVariant < 3.5 ? .22 : .8;
      color = uColor * (.84 + contrast * (.09 * b1 + .045 * b2 + .07 * b3) + contrast * (.1 * eddy * (.35 + edge) + .05 * fine));
      if (uVariant < 1.5) {
        // Jupiter: cream zones, rust-brown belts, festoons and white ovals.
        float belt = smoothstep(-.2, .6, b1);
        color = mix(color, color * vec3(.78, .62, .5), belt * .45);
        vec3 oc = hash3(floor(q * 9.));
        float oval = smoothstep(.12, .0, length(fract(q * 9.) - (.3 + .4 * oc)) - .06) * step(.93, oc.z);
        color = mix(color, vec3(.97, .95, .9), oval * .6);
      }
      if (uVariant > 2.5 && uVariant < 3.5) color = mix(color, color * 1.12, smoothstep(.55, .9, lat)); // Uranus' bright polar hood
      if (uVariant > 3.5) {
        // Neptune: a dark storm and bright methane cirrus riding above it.
        vec3 sp = q - normalize(vec3(.4, -.35, .85));
        float dark = exp(-dot(sp * vec3(7., 12., 7.), sp * vec3(7., 12., 7.)));
        color = mix(color, color * .45, dark * .8);
        float cirrus = smoothstep(.62, .8, fbm(q * vec3(.6, 6., .6) + 31., 6., 8)) * smoothstep(.3, .0, abs(abs(lat) - .35));
        color = mix(color, vec3(.92, .95, 1.), cirrus * .7);
      }
      color *= mix(vec3(1.), vec3(.92, .94, 1.02), smoothstep(.55, .95, abs(lat)));
      haze = .45;
      hazeColor = uColor * 1.2 + .08;
    }
    // The Great Red Spot: an oval vortex spun up out of the surrounding bands.
    if (uStorm > .5) {
      vec3 c = normalize(vec3(.55, -.23, .8));
      vec3 d = P - c;
      float r = length(d * vec3(8., 16., 6.));
      float ang = atan(d.y * 16., d.x * 8. + d.z * 6.) + r * 1.6 - uTime * .08;
      float swirl = .5 + .5 * sin(ang * 3. + fbm(P * 3., 12., 6) * 4.);
      float spot = exp(-r * r * .9);
      color = mix(color, mix(vec3(.62, .3, .18), vec3(.78, .45, .3), swirl), spot * .8);
    }
  } else if (uKind == 2.) {
    // Mann: a crust of glacial plates split by crevasses, pale snow in the hollows.
    float plates = fbm(P, 6., 10);
    float crev = ridged(P + 2., 14., 11);
    float cracks = smoothstep(.72, .92, crev);
    height = (plates - .5) * .03 - cracks * .006 + (fbm(P, 60., 9) - .5) * .003;
    color = mix(uColor * .4, vec3(.88, .94, 1.), smoothstep(.32, .68, plates + (fbm(P, 70., 8) - .5) * .16));
    color = mix(color, vec3(.2, .34, .45), cracks * .55);
    spec = .35 * (1. - cracks);
    haze = .35;
    hazeColor = vec3(.8, .9, 1.);
    nl = bump(P, height * R * 3.);
    // Frozen clouds drifting over the ice.
    float cl = smoothstep(.55, .8, fbm(P + vec3(uTime * .004, 0., 0.), 5., 9));
    color = mix(color, vec3(.93, .96, 1.), cl * .55);
  } else if (uKind == 3.) {
    // Miller: shallow ocean, long swells, and the tidal wall circling the planet.
    float swell = sin(P.y * 180. + fbm(P, 3., 5) * 20. + uTime * .4);
    float chop = fbm(P + vec3(0., uTime * .01, 0.), 40., 10);
    height = swell * .0006 * lod(30.) + (chop - .5) * .0008;
    float waves = pow(.5 + .5 * swell, 12.);
    color = mix(vec3(.018, .075, .11), vec3(.17, .3, .34), fbm(P, 7., 6)) + waves * .075;
    // A single mountain-high crest sweeping round, bright where it breaks.
    float front = abs(fract(atan(P.z, P.x) / 6.2832 + uTime * .002) - .5);
    float wall = exp(-front * front * 3000.) * smoothstep(.95, .2, abs(P.y));
    color = mix(color, vec3(.55, .66, .7), wall * .6);
    spec = 1.;
    haze = .35;
    hazeColor = vec3(.7, .82, .9);
    nl = bump(P, height * R);
  } else if (uKind == 4.) {
    // Edmunds: ochre sand seas with dune fields, dark highlands and pale caps.
    float land = fbm(P, 3., 10);
    float dunes = ridged(P * vec3(1., 3.5, 1.) + 7., 30., 8);
    float high = smoothstep(.25, .62, land);
    height = (land - .5) * .02 + dunes * .0015 * high;
    color = mix(vec3(.095, .12, .08), vec3(.64, .41, .23), high);
    color *= .85 + .3 * dunes * high;
    color = mix(color, vec3(.9, .87, .74), smoothstep(.82, .99, abs(P.y) + (fbm(P, 16., 5) - .5) * .1));
    haze = .45;
    hazeColor = vec3(.95, .8, .62);
    nl = bump(P, height * R * 2.);
    float cl = smoothstep(.6, .82, fbm(P + vec3(uTime * .003, 0., 0.), 4., 9));
    color = mix(color, vec3(.95, .93, .88), cl * .5);
  } else if (uKind == 5.) {
    // The Sun: convection granules, dark spots in the activity belts, and limb darkening.
    float fire = fbm(P + vec3(0, uTime * .006, 0), 22., 5);
    float gran = fbm(P + uTime * .004, 160., 8);
    float belts = smoothstep(.05, .2, abs(P.y)) * smoothstep(.55, .35, abs(P.y));
    float spot = smoothstep(.7, .78, fbm(P + 9., 4., 6)) * belts;
    color = mix(vec3(1., .24, .025), vec3(1., .86, .4), fire) * (1.5 + (gran - .5) * 1.1);
    color *= 1. - spot * .85;
    float mu = max(dot(ng, E), 0.);
    color *= .45 + .55 * pow(mu, .5);
    gl_FragColor = vec4(color, 1.);
    return;
  } else {
    // Earth: the map, with finer relief on land, lit cities on the night side.
    vec3 tex = texture2D(uEarth, vUv).rgb;
    float land = smoothstep(.02, .08, max(tex.r, tex.g) - tex.b * .85);
    float detail = fbm(P, 60., 11);
    color = tex * mix(1., .78 + detail * .45, land);
    height = land * ((detail - .5) * .004 + dot(tex, vec3(.3, .5, .2)) * .002);
    spec = 1. - land;
    nl = bump(P, height * R);
    float towns = smoothstep(.6, .78, fbm(P, 30., 4)) * smoothstep(.55, .95, fbm(P + 3., 300., 6));
    glow = vec3(1., .72, .38) * towns * land * (1. - smoothstep(.62, .8, abs(P.y))) * .5;
  }

  vec3 n = normalize(rot * nl);
  float geo = dot(ng, L);
  float day = max(dot(n, L), 0.) * smoothstep(-.06, .12, geo);
  float mu = max(dot(ng, E), 0.);
  color *= mix(.55, 1., pow(mu, .35));
  float rim = pow(1. - mu, 3.);
  color = mix(color, hazeColor * max(max(uColor.r, uColor.g), uColor.b), haze * pow(1. - mu, 4.));
  color *= .025 + day * 1.25;
  color += glow * (1. - smoothstep(-.12, .05, geo));
  if (spec > 0.) color += vec3(.65, .8, 1.) * pow(max(dot(reflect(-L, n), E), 0.), 80.) * day * .7 * spec;
  if (uKind == 6.) color += vec3(.15, .44, 1.) * rim * max(geo + .2, 0.) * .45;
  if (haze > 0.) color += hazeColor * rim * max(geo + .15, 0.) * haze * .25;
  gl_FragColor = vec4(color, 1.);
}
