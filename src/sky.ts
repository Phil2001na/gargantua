import * as THREE from "three";

// Seeded, seamless diffuse galactic light. Point stars are procedural in the
// shaders (see shaders/stars.glsl) so they stay sharp and lens correctly.
export function createSky(): THREE.CanvasTexture {
  const w = 1024,
    h = 512,
    canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const sc = canvas.getContext("2d")!,
    pixels = sc.createImageData(w, h);
  const hash = (x: number, y: number) => {
    const a = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
    return a - Math.floor(a);
  };
  const noise = (x: number, y: number) => {
    const ix = Math.floor(x),
      iy = Math.floor(y);
    let a = x - ix,
      b = y - iy;
    a = a * a * (3 - 2 * a);
    b = b * b * (3 - 2 * b);
    return (
      (hash(ix, iy) * (1 - a) + hash(ix + 1, iy) * a) * (1 - b) +
      (hash(ix, iy + 1) * (1 - a) + hash(ix + 1, iy + 1) * a) * b
    );
  };
  const fbm = (x: number, y: number) =>
    noise(x, y) * 0.54 +
    noise(x * 2, y * 2) * 0.27 +
    noise(x * 4, y * 4) * 0.13 +
    noise(x * 8, y * 8) * 0.06;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const u = x / w,
        v = y / h,
        theta = u * Math.PI * 2;
      const bandY = 0.5 + 0.18 * Math.sin(theta - 1.15);
      const warp = fbm(Math.cos(theta) * 5 + 20, Math.sin(theta) * 5 + v * 8);
      const band = Math.exp(
        -Math.pow((v - bandY + (warp - 0.5) * 0.13) / 0.115, 2),
      );
      const cloud = fbm(
        Math.cos(theta) * 10 + v * 3 + 30,
        Math.sin(theta) * 10 + v * 21,
      );
      const dust = Math.pow(
        fbm(Math.cos(theta) * 19 + 40, Math.sin(theta) * 19 + v * 40),
        2,
      );
      const brightness =
        band * (0.1 + cloud * 0.85) * Math.max(0.05, 1 - dust * 2.7);
      const purple = fbm(Math.cos(theta) * 3 + 80, Math.sin(theta) * 3 + v * 5);
      const idx = (y * w + x) * 4;
      pixels.data[idx] = 1 + brightness * (purple > 0.52 ? 100 : 74);
      pixels.data[idx + 1] = 2 + brightness * 72;
      pixels.data[idx + 2] = 4 + brightness * (purple > 0.52 ? 104 : 112);
      pixels.data[idx + 3] = 255;
    }
  sc.putImageData(pixels, 0, 0);
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  return tex;
}

/** Uniforms consumed by shaders/stars.glsl. */
export function skyUniforms(sky: THREE.Texture, gargantua: boolean) {
  const rot = new THREE.Matrix3();
  if (!gargantua)
    rot.setFromMatrix4(
      new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(0.9, 2.1, 0.35)),
    );
  return {
    uSky: { value: sky },
    uPix: { value: 0.001 },
    uSkySeed: { value: gargantua ? 1 : 0 },
    uSkyRot: { value: rot },
    uNebula: {
      value: gargantua
        ? new THREE.Color(1.15, 0.95, 0.9)
        : new THREE.Color(0.8, 0.88, 1.1),
    },
  };
}
