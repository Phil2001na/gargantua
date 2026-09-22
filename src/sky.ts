import * as THREE from "three";

// Seeded, seamless celestial sphere: the stars are fixed in world space.
export function createSky(): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 4096;
  canvas.height = 2048;
  const ctx = canvas.getContext("2d")!;
  const w = 1024,
    h = 512,
    small = document.createElement("canvas");
  small.width = w;
  small.height = h;
  const sc = small.getContext("2d")!,
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
        band * (0.12 + cloud * 0.9) * Math.max(0.07, 1 - dust * 2.7);
      const purple = fbm(Math.cos(theta) * 3 + 80, Math.sin(theta) * 3 + v * 5);
      const idx = (y * w + x) * 4;
      pixels.data[idx] = 3 + brightness * (purple > 0.52 ? 105 : 78);
      pixels.data[idx + 1] = 4 + brightness * 77;
      pixels.data[idx + 2] = 7 + brightness * (purple > 0.52 ? 110 : 119);
      pixels.data[idx + 3] = 255;
    }
  sc.putImageData(pixels, 0, 0);
  ctx.drawImage(small, 0, 0, canvas.width, canvas.height);
  let seed = 89273;
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  for (let i = 0; i < 24000; i++) {
    const x = rand() * canvas.width,
      y = (Math.asin(rand() * 2 - 1) / Math.PI + 0.5) * canvas.height;
    const lum = Math.pow(rand(), 6),
      radius = 0.24 + lum * 1.3;
    const tint = rand();
    const rgb =
      tint < 0.2 ? "164,192,255" : tint > 0.78 ? "255,217,172" : "227,231,240";
    if (lum > 0.8) {
      const g = ctx.createRadialGradient(x, y, 0, x, y, radius * 5);
      g.addColorStop(0, `rgba(${rgb},${lum * 0.42})`);
      g.addColorStop(1, `rgba(${rgb},0)`);
      ctx.fillStyle = g;
      ctx.fillRect(x - radius * 5, y - radius * 5, radius * 10, radius * 10);
    }
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(${rgb},${0.23 + lum * 0.76})`;
    ctx.fill();
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  return tex;
}
