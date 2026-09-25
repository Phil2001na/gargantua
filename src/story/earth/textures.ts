import * as THREE from "three";

/** Small procedural canvas textures for the farm: painted boards, shingles, tin, solar cells. */

export function rng(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}
export function canvasTexture(size: number, draw: (g: CanvasRenderingContext2D, r: () => number) => void, seed = 1) {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const g = c.getContext("2d")!;
  draw(g, rng(seed));
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 4;
  return t;
}
export function grime(g: CanvasRenderingContext2D, r: () => number, size: number, colour: string, amount: number) {
  for (let i = 0; i < amount; i++) {
    g.fillStyle = colour;
    g.globalAlpha = r() * 0.06;
    const w = 4 + r() * 40;
    g.fillRect(r() * size, r() * size, w, 2 + r() * w * 2);
  }
  g.globalAlpha = 1;
}

const cache = new Map<string, THREE.Texture>();
export function once(key: string, make: () => THREE.Texture) {
  let t = cache.get(key);
  if (!t) cache.set(key, (t = make()));
  return t;
}

/** Painted clapboard siding: one tile is 1.6 m, eight boards. */
export const clapboard = () =>
  once("clapboard", () =>
    canvasTexture(256, (g, r) => {
      g.fillStyle = "#d8d2c3";
      g.fillRect(0, 0, 256, 256);
      for (let i = 0; i < 8; i++) {
        const y = i * 32;
        const grad = g.createLinearGradient(0, y, 0, y + 32);
        grad.addColorStop(0, "#c2baa8");
        grad.addColorStop(0.15, "#e2dccd");
        grad.addColorStop(1, "#cfc8b7");
        g.fillStyle = grad;
        g.fillRect(0, y, 256, 32);
        g.fillStyle = "#8d8472";
        g.fillRect(0, y + 30, 256, 2);
      }
      grime(g, r, 256, "#6d6250", 160);
      // Peeling paint showing grey wood.
      for (let i = 0; i < 26; i++) {
        g.fillStyle = "#9c9486";
        g.globalAlpha = 0.5;
        g.fillRect(r() * 256, Math.floor(r() * 8) * 32 + 6 + r() * 18, 3 + r() * 14, 1 + r() * 3);
      }
      g.globalAlpha = 1;
    }),
  );
export const shingles = () =>
  once("shingles", () =>
    canvasTexture(256, (g, r) => {
      g.fillStyle = "#3a3634";
      g.fillRect(0, 0, 256, 256);
      for (let row = 0; row < 16; row++) {
        const y = row * 16,
          off = row % 2 ? 16 : 0;
        for (let x = -32; x < 256; x += 32) {
          const v = 40 + r() * 28;
          g.fillStyle = `rgb(${v + 8},${v + 4},${v})`;
          g.fillRect(x + off + 1, y + 1, 30, 14);
        }
        g.fillStyle = "#1c1a19";
        g.fillRect(0, y + 14, 256, 2);
      }
      grime(g, r, 256, "#8a7a60", 120);
    }, 7),
  );
/** Weathered vertical barn boards. */
export const barnBoards = () =>
  once("barn", () =>
    canvasTexture(256, (g, r) => {
      for (let i = 0; i < 12; i++) {
        const v = 88 + r() * 40;
        g.fillStyle = `rgb(${v + 14},${v},${v - 12})`;
        g.fillRect((i * 256) / 12, 0, 256 / 12, 256);
        g.fillStyle = "#2c2622";
        g.fillRect((i * 256) / 12, 0, 2, 256);
      }
      for (let i = 0; i < 400; i++) {
        g.fillStyle = r() < 0.5 ? "#4c4038" : "#b0a595";
        g.globalAlpha = 0.18;
        g.fillRect(r() * 256, r() * 256, 1, 10 + r() * 50);
      }
      g.globalAlpha = 1;
      grime(g, r, 256, "#3d2f24", 80);
    }, 3),
  );
export const tin = () =>
  once("tin", () =>
    canvasTexture(256, (g, r) => {
      for (let x = 0; x < 256; x++) {
        const v = 150 + 50 * Math.sin((x / 256) * Math.PI * 2 * 16);
        g.fillStyle = `rgb(${v},${v + 3},${v + 6})`;
        g.fillRect(x, 0, 1, 256);
      }
      for (let i = 0; i < 26; i++) {
        g.fillStyle = "#7a4a2a";
        g.globalAlpha = 0.25;
        g.fillRect(r() * 256, r() * 256, 2 + r() * 10, 20 + r() * 80);
      }
      g.globalAlpha = 1;
      g.fillStyle = "#555";
      for (let y = 0; y < 256; y += 64) g.fillRect(0, y, 256, 2);
    }, 5),
  );
export const planks = () =>
  once("planks", () =>
    canvasTexture(256, (g, r) => {
      for (let i = 0; i < 8; i++) {
        const v = 110 + r() * 30;
        g.fillStyle = `rgb(${v},${v - 12},${v - 26})`;
        g.fillRect(0, i * 32, 256, 32);
        g.fillStyle = "#3b3027";
        g.fillRect(0, i * 32 + 30, 256, 2);
      }
      grime(g, r, 256, "#2a221b", 140);
    }, 9),
  );
export const solarCells = () =>
  once("solar", () =>
    canvasTexture(256, (g) => {
      g.fillStyle = "#c9ccd0";
      g.fillRect(0, 0, 256, 256);
      for (let y = 0; y < 8; y++)
        for (let x = 0; x < 8; x++) {
          const grad = g.createLinearGradient(x * 32, y * 32, x * 32 + 32, y * 32 + 32);
          grad.addColorStop(0, "#1b2f5a");
          grad.addColorStop(1, "#0c1630");
          g.fillStyle = grad;
          g.fillRect(x * 32 + 2, y * 32 + 2, 28, 28);
          g.fillStyle = "#3a5288";
          g.fillRect(x * 32 + 2, y * 32 + 15, 28, 1);
        }
    }),
  );
export const brick = () =>
  once("brick", () =>
    canvasTexture(128, (g, r) => {
      g.fillStyle = "#6a625a";
      g.fillRect(0, 0, 128, 128);
      for (let row = 0; row < 8; row++)
        for (let x = -16; x < 128; x += 32) {
          const v = 90 + r() * 40;
          g.fillStyle = `rgb(${v + 40},${v - 10},${v - 25})`;
          g.fillRect(x + (row % 2 ? 16 : 0) + 1, row * 16 + 1, 30, 14);
        }
    }, 11),
  );

/** Scale a BoxGeometry's UVs so textures tile every `tile` metres on every face. */
export function tileBox(g: THREE.BoxGeometry, tile: number) {
  const { width: w, height: h, depth: d } = g.parameters;
  const uv = g.getAttribute("uv") as THREE.BufferAttribute;
  const faces: [number, number][] = [
    [d, h],
    [d, h],
    [w, d],
    [w, d],
    [w, h],
    [w, h],
  ];
  for (let f = 0; f < 6; f++)
    for (let v = 0; v < 4; v++) {
      const i = f * 4 + v;
      uv.setXY(i, (uv.getX(i) * faces[f][0]) / tile, (uv.getY(i) * faces[f][1]) / tile);
    }
  return g;
}

/** Faded wallpaper: narrow stripes with small sprigs. One tile is 0.8 m. */
export const wallpaper = () =>
  once("wallpaper", () =>
    canvasTexture(256, (g, r) => {
      g.fillStyle = "#cdbf9f";
      g.fillRect(0, 0, 256, 256);
      for (let x = 0; x < 256; x += 32) {
        g.fillStyle = "rgba(120,95,70,.18)";
        g.fillRect(x, 0, 3, 256);
        g.fillStyle = "rgba(255,250,235,.2)";
        g.fillRect(x + 14, 0, 6, 256);
      }
      for (let y = 8; y < 256; y += 32)
        for (let x = 0; x < 256; x += 32) {
          const cx = x + 8 + ((y / 32) % 2) * 16,
            cy = y;
          g.fillStyle = "rgba(125,80,70,.35)";
          g.beginPath();
          g.arc(cx, cy, 2.5, 0, Math.PI * 2);
          g.fill();
          g.strokeStyle = "rgba(90,105,70,.35)";
          g.lineWidth = 1.2;
          g.beginPath();
          g.moveTo(cx, cy + 2);
          g.quadraticCurveTo(cx + 3, cy + 7, cx - 1, cy + 11);
          g.stroke();
        }
      grime(g, r, 256, "#6d5a40", 120);
    }, 21),
  );

/** Patchwork quilt, 0.5 m per tile. */
export const quilt = () =>
  once("quilt", () =>
    canvasTexture(256, (g, r) => {
      const cols = ["#8a4b3c", "#b7925a", "#546a78", "#7f8a5a", "#c8b89a", "#6b4f6a", "#a36a45"];
      for (let y = 0; y < 256; y += 32)
        for (let x = 0; x < 256; x += 32) {
          g.fillStyle = cols[Math.floor(r() * cols.length)];
          g.fillRect(x, y, 32, 32);
          if (r() < 0.4) {
            g.fillStyle = "rgba(255,245,220,.25)";
            g.beginPath();
            g.moveTo(x, y);
            g.lineTo(x + 32, y + 32);
            g.lineTo(x, y + 32);
            g.fill();
          }
          g.strokeStyle = "rgba(40,30,20,.35)";
          g.setLineDash([2, 2]);
          g.strokeRect(x + 1, y + 1, 30, 30);
        }
      g.setLineDash([]);
    }, 5),
  );

/** A child's pencil drawing of a rocket and planets on lined paper (not tiled). */
export const drawing = (seed: number) =>
  once("drawing" + seed, () => {
    const t = canvasTexture(
      128,
      (g, r) => {
        g.fillStyle = "#ece6d4";
        g.fillRect(0, 0, 128, 128);
        g.strokeStyle = "rgba(90,120,170,.35)";
        for (let y = 12; y < 128; y += 9) {
          g.beginPath();
          g.moveTo(0, y);
          g.lineTo(128, y);
          g.stroke();
        }
        g.strokeStyle = "#3b3a44";
        g.lineWidth = 1.6;
        if (seed % 2) {
          // Rocket.
          g.beginPath();
          g.moveTo(64, 14);
          g.quadraticCurveTo(80, 40, 76, 90);
          g.lineTo(52, 90);
          g.quadraticCurveTo(48, 40, 64, 14);
          g.stroke();
          g.strokeRect(58, 42, 12, 12);
          g.beginPath();
          g.moveTo(52, 80);
          g.lineTo(40, 100);
          g.lineTo(53, 92);
          g.moveTo(76, 80);
          g.lineTo(88, 100);
          g.lineTo(75, 92);
          g.stroke();
          g.strokeStyle = "#c46a2a";
          for (let i = 0; i < 6; i++) {
            g.beginPath();
            g.moveTo(56 + i * 3, 92);
            g.lineTo(52 + i * 4 + r() * 4, 112 + r() * 10);
            g.stroke();
          }
        } else {
          // Saturn and a moon.
          g.beginPath();
          g.arc(58, 62, 22, 0, Math.PI * 2);
          g.stroke();
          g.beginPath();
          g.ellipse(58, 62, 42, 10, -0.3, 0, Math.PI * 2);
          g.stroke();
          g.beginPath();
          g.arc(102, 26, 7, 0, Math.PI * 2);
          g.stroke();
          g.fillStyle = "#3b3a44";
          for (let i = 0; i < 14; i++) g.fillRect(r() * 128, r() * 128, 1.5, 1.5);
        }
      },
      seed,
    );
    t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
    return t;
  });

/** Poured concrete with form-tie holes and water stains, 2 m per tile. */
export const concrete = () =>
  once("concrete", () =>
    canvasTexture(256, (g, r) => {
      g.fillStyle = "#8d8a84";
      g.fillRect(0, 0, 256, 256);
      for (let i = 0; i < 2600; i++) {
        const v = 110 + r() * 60;
        g.fillStyle = `rgba(${v},${v - 2},${v - 6},.18)`;
        g.fillRect(r() * 256, r() * 256, 1 + r() * 3, 1 + r() * 3);
      }
      g.strokeStyle = "rgba(40,38,34,.35)";
      g.lineWidth = 1;
      g.strokeRect(0.5, 0.5, 255, 127);
      g.strokeRect(0.5, 128.5, 255, 127);
      g.fillStyle = "rgba(40,38,34,.5)";
      for (const [x, y] of [
        [32, 32],
        [224, 32],
        [32, 96],
        [224, 96],
        [96, 160],
        [160, 224],
      ]) {
        g.beginPath();
        g.arc(x, y, 3, 0, Math.PI * 2);
        g.fill();
      }
      for (let i = 0; i < 12; i++) {
        const x = r() * 256;
        const grad = g.createLinearGradient(x, 0, x, 256);
        grad.addColorStop(0, "rgba(60,55,45,.18)");
        grad.addColorStop(1, "rgba(60,55,45,0)");
        g.fillStyle = grad;
        g.fillRect(x, 0, 4 + r() * 10, 120 + r() * 136);
      }
    }, 33),
  );

/** Chain-link fence: a diamond mesh with transparent holes (use alphaTest). 1 m per tile. */
export const chainLink = () =>
  once("chainlink", () => {
    const t = canvasTexture(128, (g) => {
      g.clearRect(0, 0, 128, 128);
      g.strokeStyle = "#b9bcbf";
      g.lineWidth = 2.2;
      for (let i = -128; i < 256; i += 16) {
        g.beginPath();
        g.moveTo(i, 0);
        g.lineTo(i + 128, 128);
        g.moveTo(i + 128, 0);
        g.lineTo(i, 128);
        g.stroke();
      }
    });
    return t;
  });

/** A stencilled warning sign. */
export const sign = (lines: string[]) =>
  once("sign:" + lines.join("|"), () => {
    const t = canvasTexture(256, (g) => {
      g.fillStyle = "#e8e2d0";
      g.fillRect(0, 0, 256, 256);
      g.fillStyle = "#a02a20";
      g.fillRect(0, 0, 256, 70);
      g.fillStyle = "#fff";
      g.font = "bold 40px 'IBM Plex Mono', monospace";
      g.textAlign = "center";
      g.fillText(lines[0], 128, 50);
      g.fillStyle = "#1c1c1c";
      g.font = "bold 26px 'IBM Plex Mono', monospace";
      lines.slice(1).forEach((l, i) => g.fillText(l, 128, 120 + i * 40));
    });
    t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
    return t;
  });
