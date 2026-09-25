import * as THREE from "three";
import { Colliders } from "./collide";
import { planks, wallpaper, quilt, drawing, rng, tileBox } from "./textures";
import { mergeStatic } from "./merge";
import { DustLines, type Stripe } from "./dust";
import { Watch } from "./watch";

/**
 * Murph's bedroom: upstairs at the west end of the farmhouse. The open window on the west
 * wall is where the storm gets in; the bookshelf on the east wall is where the "ghost" is.
 * Coordinates are world metres (the house is centred on the origin, facing +z).
 */
export const ROOM = {
  x0: -4.85,
  x1: -0.96,
  z0: -3.85,
  z1: 0.84,
  floor: 3.6,
  ceil: 6.15,
  /** The open west window (the lower sash is raised). */
  window: { z: -2, y0: 4.175, y1: 5.625, w: 0.95 },
};

/** The coordinates in the dust: degrees and minutes, one row each, read from the window side. */
export const MESSAGE = [40, 3, 99, 33];
export const BITS = 7;
/** Where Cooper leaves the watch: lying on the bookshelf at eye height. */
export const WATCH_SPOT = new THREE.Vector3(ROOM.x1 - 0.18, ROOM.floor + 1.3125, -1.84);

const std = (o: THREE.MeshStandardMaterialParameters) => new THREE.MeshStandardMaterial({ roughness: 0.85, ...o });

export class MurphRoom {
  readonly group = new THREE.Group();
  readonly colliders = new Colliders(false);
  readonly dust: DustLines;
  readonly lamp: THREE.PointLight;
  readonly lander = new THREE.Group();
  /** Books the ghost pushes off the shelf, in the order it pushes them. */
  readonly ghostBooks: THREE.Mesh[] = [];
  readonly shelfFront = new THREE.Vector3();
  /** The watch Cooper leaves for Murph (hidden until he does). */
  readonly watch = new Watch();
  private curtains: { mesh: THREE.Mesh; base: Float32Array; side: number }[] = [];
  private lampShade: THREE.MeshStandardMaterial;
  /** The lower sash of the west window: slides up to open. */
  private sash = new THREE.Group();
  wind = 0;
  constructor() {
    const g = this.group;
    const R = ROOM;
    const wood = std({ map: planks(), color: 0xb89a78 });
    const trim = std({ color: 0xe6e0d2 });
    const paper = std({ map: wallpaper() });
    const add = (m: THREE.Mesh, cast = true) => {
      m.castShadow = cast;
      m.receiveShadow = true;
      g.add(m);
      return m;
    };
    const box = (w: number, h: number, d: number, m: THREE.Material, x: number, y: number, z: number, tile = 0) => {
      const geo = new THREE.BoxGeometry(w, h, d);
      if (tile) tileBox(geo, tile);
      const mesh = add(new THREE.Mesh(geo, m));
      mesh.position.set(x, y, z);
      return mesh;
    };
    const F = R.floor,
      H = R.ceil - R.floor,
      cx = (R.x0 + R.x1) / 2,
      cz = (R.z0 + R.z1) / 2,
      W = R.x1 - R.x0,
      D = R.z1 - R.z0;

    // --- Shell -------------------------------------------------------------
    // Floorboards (the plaster slab underneath is the house's).
    const floorGeo = new THREE.PlaneGeometry(W, D).rotateX(-Math.PI / 2);
    const uv = floorGeo.attributes.uv as THREE.BufferAttribute;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, (uv.getX(i) * W) / 1.2, (uv.getY(i) * D) / 1.2);
    const floor = add(new THREE.Mesh(floorGeo, wood), false);
    floor.position.set(cx, F + 0.002, cz);
    // Partition walls (wallpapered on the room side) with the door in the south one.
    box(0.12, H, D + 0.12, paper, R.x1 + 0.06, F + H / 2, cz, 0.8);
    const doorX = -1.75;
    box(doorX - 0.45 - R.x0, H, 0.12, paper, (R.x0 + doorX - 0.45) / 2, F + H / 2, R.z1 + 0.06, 0.8);
    box(R.x1 - (doorX + 0.45), H, 0.12, paper, (doorX + 0.45 + R.x1) / 2, F + H / 2, R.z1 + 0.06, 0.8);
    box(0.9, H - 2.1, 0.12, paper, doorX, F + 2.1 + (H - 2.1) / 2, R.z1 + 0.06, 0.8);
    const door = box(0.84, 2.06, 0.05, std({ color: 0x8c7358, roughness: 0.7 }), doorX, F + 1.03, R.z1 + 0.04);
    door.rotation.y = 0;
    box(0.06, 0.06, 0.06, std({ color: 0xb09050, metalness: 0.8, roughness: 0.3 }), doorX + 0.32, F + 1.0, R.z1 - 0.01);
    for (const s of [-1, 1]) box(0.08, 2.14, 0.03, trim, doorX + s * 0.46, F + 1.07, R.z1 - 0.005);
    box(1.0, 0.08, 0.03, trim, doorX, F + 2.12, R.z1 - 0.005);
    // Wallpaper on the outer walls, in panels around the windows.
    const outer = [
      // west wall (x = x0), window at z = -2
      { face: "x" as const, at: R.x0 + 0.004, from: R.z0, to: R.z1, holes: [{ u: R.window.z, v0: R.window.y0, v1: R.window.y1, w: 0.95 }] },
      // north wall (z = z0), window at x = -3.2
      { face: "z" as const, at: R.z0 + 0.004, from: R.x0, to: R.x1, holes: [{ u: -3.2, v0: 4.175, v1: 5.625, w: 0.95 }] },
    ];
    for (const wall of outer) {
      const cuts = [wall.from, ...wall.holes.flatMap((h) => [h.u - h.w / 2, h.u + h.w / 2]), wall.to].sort((a, b) => a - b);
      for (let i = 0; i < cuts.length - 1; i++) {
        const a = cuts[i],
          b = cuts[i + 1],
          mid = (a + b) / 2;
        const hole = wall.holes.find((h) => Math.abs(mid - h.u) < h.w / 2);
        const spans = hole ? [[F, hole.v0], [hole.v1, R.ceil]] : [[F, R.ceil]];
        for (const [v0, v1] of spans) {
          const geo = new THREE.PlaneGeometry(b - a, v1 - v0);
          const u2 = geo.attributes.uv as THREE.BufferAttribute;
          for (let k = 0; k < u2.count; k++) u2.setXY(k, (a + u2.getX(k) * (b - a)) / 0.8, (v0 + u2.getY(k) * (v1 - v0)) / 0.8);
          const m = add(new THREE.Mesh(geo, paper), false);
          if (wall.face === "x") {
            m.rotation.y = Math.PI / 2;
            m.position.set(wall.at, (v0 + v1) / 2, mid);
          } else m.position.set(mid, (v0 + v1) / 2, wall.at);
        }
      }
    }
    // Ceiling, skirting boards, window casings.
    const ceiling = add(new THREE.Mesh(new THREE.PlaneGeometry(W, D).rotateX(Math.PI / 2), std({ color: 0xe4ddcf, roughness: 1 })), false);
    ceiling.position.set(cx, R.ceil - 0.002, cz);
    box(W, 0.14, 0.02, trim, cx, F + 0.07, R.z0 + 0.01);
    box(0.02, 0.14, D, trim, R.x0 + 0.01, F + 0.07, cz);
    box(0.02, 0.14, D, trim, R.x1 - 0.01, F + 0.07, cz);
    const casing = (face: "x" | "z", at: number, u: number, s: number) => {
      const w = 0.95,
        y = 4.9,
        h = 1.45;
      const put = (du: number, dv: number, uu: number, vv: number, depth = 0.03) =>
        face === "x" ? box(depth, dv, du, trim, at + (s * depth) / 2, vv, uu) : box(du, dv, depth, trim, uu, vv, at + (s * depth) / 2);
      put(0.08, h + 0.16, u - w / 2 - 0.04, y);
      put(0.08, h + 0.16, u + w / 2 + 0.04, y);
      put(w + 0.16, 0.08, u, y + h / 2 + 0.04);
      put(w + 0.22, 0.04, u, y - h / 2 - 0.02, 0.16);
      // Reveal: the wall's thickness around the opening.
      for (const k of [-1, 1]) put(0.012, h, u + (k * w) / 2, y, -0.2);
      put(w, 0.012, u, y + h / 2, -0.2);
    };
    casing("x", R.x0, R.window.z, 1);
    casing("z", R.z0, -3.2, 1);
    // Curtains either side of the open window: they blow in with the storm.
    const cloth = std({ color: 0xc9b48e, roughness: 1, side: THREE.DoubleSide, transparent: true, opacity: 0.92 });
    for (const side of [-1, 1]) {
      const geo = new THREE.PlaneGeometry(0.42, 1.7, 8, 16);
      geo.rotateY(Math.PI / 2);
      const mesh = add(new THREE.Mesh(geo, cloth), false);
      mesh.position.set(R.x0 + 0.08, 4.95, R.window.z + side * 0.62);
      this.curtains.push({ mesh, base: (geo.attributes.position.array as Float32Array).slice(), side });
    }
    box(0.03, 0.03, 1.8, std({ color: 0x6a5a48 }), R.x0 + 0.08, 5.82, R.window.z);
    {
      const pane = new THREE.Mesh(
        new THREE.BoxGeometry(0.02, 0.66, 0.9),
        std({ color: 0xa9b8c0, roughness: 0.05, metalness: 0, transparent: true, opacity: 0.16, depthWrite: false }),
      );
      this.sash.add(pane);
      for (const [dy, dz, h, w] of [
        [0.345, 0, 0.05, 0.95],
        [-0.345, 0, 0.05, 0.95],
        [0, 0.45, 0.72, 0.05],
        [0, -0.45, 0.72, 0.05],
      ]) {
        const bar = new THREE.Mesh(new THREE.BoxGeometry(0.04, h, w), trim);
        bar.position.set(0, dy, dz);
        this.sash.add(bar);
      }
      this.sash.position.set(R.x0 - 0.09, 0, R.window.z);
      g.add(this.sash);
      this.setSash(1);
    }

    // --- Bookshelf (east wall, facing west) -------------------------------------
    const shelfWood = std({ color: 0x5e4630, roughness: 0.75 });
    const sx = R.x1 - 0.18,
      sz0 = -3.1,
      sz1 = -1.7,
      sH = 2.1;
    const shelfZ = (sz0 + sz1) / 2;
    box(0.34, sH, 0.03, shelfWood, sx, F + sH / 2, sz0);
    box(0.34, sH, 0.03, shelfWood, sx, F + sH / 2, sz1);
    box(0.02, sH, sz1 - sz0, shelfWood, sx + 0.16, F + sH / 2, shelfZ);
    const levels = [0.08, 0.5, 0.9, 1.3, 1.7, 2.08];
    for (const y of levels) box(0.34, 0.025, sz1 - sz0, shelfWood, sx, F + y, shelfZ);
    this.shelfFront.set(sx - 0.17, F + 1.1, shelfZ);
    const r = rng(77);
    const spines = [0x6d2f28, 0x2f4a5c, 0x7a6a3a, 0x3d5a3a, 0x8a7a64, 0x5a3a5a, 0x9a5a2a, 0x2a2a2e, 0xa89878, 0x44506a];
    const bookMats = spines.map((c) => std({ color: c, roughness: 0.8 }));
    // The gaps the ghost leaves, per shelf level (z of the missing books).
    const gaps: { level: number; z: number }[] = [
      { level: 2, z: -2.62 },
      { level: 2, z: -2.3 },
      { level: 3, z: -2.08 },
      { level: 1, z: -2.9 },
    ];
    const ghostAt = new Map<number, number>();
    for (let li = 0; li < levels.length - 1; li++) {
      let z = sz0 + 0.03;
      const topY = levels[li + 1] - levels[li] - 0.05;
      while (z < sz1 - 0.06) {
        const t = 0.025 + r() * 0.035,
          h = Math.min(topY, 0.2 + r() * 0.14),
          d = 0.17 + r() * 0.08;
        if (z + t > sz1 - 0.03) break;
        // Leave a space at the end of the fourth shelf, at eye height: the watch goes there.
        if (li === 3 && z + t > WATCH_SPOT.z - 0.13) break;
        const gap = gaps.find((q) => q.level === li && Math.abs(q.z - (z + t / 2)) < 0.03);
        const mat = bookMats[Math.floor(r() * bookMats.length)];
        const b = new THREE.Mesh(new THREE.BoxGeometry(d, h, t), mat);
        b.position.set(sx - 0.17 + d / 2 + 0.01, F + levels[li] + 0.0125 + h / 2, z + t / 2);
        if (r() < 0.08 && !gap) b.rotation.x = 0.12;
        b.castShadow = b.receiveShadow = true;
        if (gap && !ghostAt.has(gaps.indexOf(gap))) {
          ghostAt.set(gaps.indexOf(gap), 1);
          this.ghostBooks[gaps.indexOf(gap)] = b;
          b.userData.home = b.position.clone();
          b.userData.homeRot = b.rotation.clone();
        }
        g.add(b);
        z += t + 0.002;
      }
    }
    this.ghostBooks.splice(0, this.ghostBooks.length, ...this.ghostBooks.filter(Boolean));

    // --- Bed (south wall, head to the west) --------------------------------------
    const bedFrame = std({ color: 0x4a3526, roughness: 0.7 });
    const bx0 = R.x0 + 0.05,
      bx1 = bx0 + 2.0,
      bz = R.z1 - 0.52;
    box(bx1 - bx0, 0.28, 1.0, bedFrame, (bx0 + bx1) / 2, F + 0.24, bz);
    box(bx1 - bx0 - 0.06, 0.2, 0.94, std({ color: 0xd8d0c0, roughness: 1 }), (bx0 + bx1) / 2, F + 0.48, bz);
    const q = box(bx1 - bx0 - 0.3, 0.06, 1.02, std({ map: quilt(), roughness: 1 }), (bx0 + bx1) / 2 + 0.14, F + 0.6, bz);
    tileBox(q.geometry as THREE.BoxGeometry, 0.5);
    box(0.4, 0.12, 0.62, std({ color: 0xece6da, roughness: 1 }), bx0 + 0.28, F + 0.64, bz);
    box(0.06, 1.0, 1.04, bedFrame, bx0, F + 0.5, bz);
    box(0.06, 0.7, 1.04, bedFrame, bx1, F + 0.35, bz);
    // Nightstand and lamp.
    const nz = bz - 0.78;
    box(0.42, 0.55, 0.4, bedFrame, bx0 + 0.24, F + 0.275, nz);
    box(0.06, 0.28, 0.06, std({ color: 0x9a8a70, metalness: 0.4 }), bx0 + 0.24, F + 0.69, nz);
    this.lampShade = std({ color: 0xf2e2c0, emissive: 0xffc070, emissiveIntensity: 0, side: THREE.DoubleSide, roughness: 1 });
    add(new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.16, 0.2, 16, 1, true), this.lampShade), false).position.set(bx0 + 0.24, F + 0.9, nz);
    this.lamp = new THREE.PointLight(0xffc27a, 0, 7, 1.6);
    this.lamp.position.set(bx0 + 0.24, F + 0.92, nz);
    g.add(this.lamp);

    // --- Desk and chair under the north window -----------------------------------
    const dx = -3.2,
      dz = R.z0 + 0.32;
    const deskWood = std({ color: 0x7a5c40, roughness: 0.7 });
    box(1.2, 0.04, 0.58, deskWood, dx, F + 0.74, dz);
    for (const [ox, oz] of [
      [-0.56, -0.25],
      [0.56, -0.25],
      [-0.56, 0.25],
      [0.56, 0.25],
    ])
      box(0.04, 0.72, 0.04, deskWood, dx + ox, F + 0.36, dz + oz);
    // The chair is tucked in, clear of where the dust will fall.
    box(0.42, 0.03, 0.4, deskWood, dx + 0.1, F + 0.45, dz + 0.35);
    box(0.42, 0.5, 0.03, deskWood, dx + 0.1, F + 0.72, dz + 0.55);
    for (const [ox, oz] of [
      [-0.09, 0.17],
      [0.29, 0.17],
      [-0.09, 0.53],
      [0.29, 0.53],
    ])
      box(0.03, 0.45, 0.03, deskWood, dx + ox, F + 0.225, dz + oz);
    // Things on the desk: a stack of notebooks, a jar of pencils, a globe.
    box(0.22, 0.05, 0.3, std({ color: 0x7c3a30 }), dx - 0.35, F + 0.785, dz + 0.02);
    box(0.2, 0.03, 0.28, std({ color: 0x2f4a5c }), dx - 0.34, F + 0.825, dz + 0.02).rotation.y = 0.2;
    add(new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.11, 10), std({ color: 0xa0b0b0, roughness: 0.2, transparent: true, opacity: 0.6 }))).position.set(dx + 0.42, F + 0.815, dz - 0.12);
    const globe = add(new THREE.Mesh(new THREE.SphereGeometry(0.12, 24, 16), std({ color: 0x4a6a80, roughness: 0.6 })));
    globe.position.set(dx + 0.2, F + 0.92, dz - 0.05);
    box(0.02, 0.14, 0.02, std({ color: 0x8a7a50, metalness: 0.6 }), dx + 0.2, F + 0.8, dz - 0.05);
    // Drawings pinned up by the desk.
    for (const [i, x] of [
      [1, -4.35],
      [2, -2.1],
    ] as [number, number][]) {
      const d = add(new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.3), std({ map: drawing(i), roughness: 1 })), false);
      d.position.set(x, F + 1.45 + i * 0.05, R.z0 + 0.008);
      d.rotation.z = (i - 1.5) * 0.08;
    }

    // --- The lunar lander model -----------------------------------------------
    // Murph's model of a lunar lander: gold-foil descent stage, grey ascent stage, four legs.
    const foil = std({ color: 0xc09a40, metalness: 0.85, roughness: 0.35 });
    const grey = std({ color: 0xb8b8b0, metalness: 0.3, roughness: 0.6 });
    const dark = std({ color: 0x3a3a3a, roughness: 0.7 });
    const L = this.lander;
    const stage = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.08, 8), foil);
    stage.position.y = 0.1;
    const cab = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.085, 0.09, 6), grey);
    cab.position.y = 0.185;
    const hatch = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.035, 0.02), dark);
    hatch.position.set(0, 0.19, 0.08);
    const dish = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.015, 10), grey);
    dish.position.set(0.05, 0.25, -0.03);
    L.add(stage, cab, hatch, dish);
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.13, 5), grey);
      leg.position.set(Math.cos(a) * 0.12, 0.06, Math.sin(a) * 0.12);
      leg.rotation.set(Math.sin(a) * 0.5, 0, -Math.cos(a) * 0.5);
      const pad = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.006, 10), grey);
      pad.position.set(Math.cos(a) * 0.15, 0.003, Math.sin(a) * 0.15);
      L.add(leg, pad);
    }
    L.traverse((o) => ((o as THREE.Mesh).isMesh ? ((o.castShadow = true), (o.receiveShadow = true)) : 0));
    g.add(L);
    this.landerOnShelf(true);

    // --- Collision ----------------------------------------------------------------
    const c = this.colliders;
    c.box(R.x0 - 1, R.x1 + 1, R.z0 - 1, R.z1 + 1, F);
    c.box(R.x0 - 1, R.x0, R.z0 - 1, R.z1 + 1, 99, F - 1);
    c.box(R.x1, R.x1 + 1, R.z0 - 1, R.z1 + 1, 99, F - 1);
    c.box(R.x0 - 1, R.x1 + 1, R.z0 - 1, R.z0, 99, F - 1);
    c.box(R.x0 - 1, R.x1 + 1, R.z1, R.z1 + 1, 99, F - 1);
    c.box(sx - 0.2, R.x1, sz0 - 0.03, sz1 + 0.03, F + sH);
    c.box(bx0, bx1 + 0.04, bz - 0.52, R.z1, F + 0.62);
    c.box(bx0, bx0 + 0.46, nz - 0.22, nz + 0.22, F + 0.55);
    c.box(dx - 0.62, dx + 0.62, R.z0, dz + 0.3, F + 0.76);
    c.box(dx - 0.12, dx + 0.32, dz + 0.3, dz + 0.58, F + 0.47);

    this.watch.group.visible = false;
    g.add(this.watch.group);

    mergeStatic(g, [L, this.watch.group, this.sash, ...this.ghostBooks, ...this.curtains.map((c) => c.mesh)]);

    // --- The dust ----------------------------------------------------------------
    this.dust = new DustLines({
      x0: R.x0,
      x1: R.x1,
      z0: R.z0,
      z1: R.z1,
      floor: F,
      source: {
        min: new THREE.Vector3(R.x0 - 0.05, R.window.y0 + 0.02, R.window.z - 0.44),
        max: new THREE.Vector3(R.x0 + 0.05, R.window.y0 + 0.7, R.window.z + 0.44),
        wind: new THREE.Vector3(3.2, 0.3, 0),
      },
    });
    this.dust.setStripes(MurphRoom.stripes(MESSAGE));
    g.add(this.dust.group);
  }

  /** Four rows of seven bands: wide = 1, narrow = 0, read from the window (west) side. */
  static stripes(message: number[]): Stripe[] {
    const out: Stripe[] = [];
    const rows = [-2.62, -1.98, -1.34, -0.7];
    message.forEach((value, row) => {
      for (let b = 0; b < BITS; b++) {
        const bit = (value >> (BITS - 1 - b)) & 1;
        const x = -4.2 + b * 0.36,
          w = bit ? 0.14 : 0.045;
        out.push({ x0: x - w / 2, x1: x + w / 2, z0: rows[row] - 0.21, z1: rows[row] + 0.21 });
      }
    });
    return out;
  }
  /** Where the kid put it (on top of the bookshelf), or where it landed (on the floor). */
  landerOnShelf(on: boolean) {
    if (on) {
      this.lander.position.set(ROOM.x1 - 0.2, ROOM.floor + 2.11, -2.2);
      this.lander.rotation.set(0, 0.6, 0);
    } else {
      this.lander.position.set(-1.7, ROOM.floor + 0.01, -2.35);
      this.lander.rotation.set(0.35, 2.1, 1.35);
    }
  }
  /** Put the watch on the shelf (or take it away). */
  watchOnShelf(on: boolean) {
    const w = this.watch.group;
    w.visible = on;
    w.position.copy(WATCH_SPOT);
    w.rotation.set(0, Math.PI / 2 + 0.2, 0);
  }
  /** Put the ghost's books back (on = true) or scatter them on the floor. */
  booksHome(on: boolean) {
    this.ghostBooks.forEach((b, i) => {
      const home = b.userData.home as THREE.Vector3;
      if (on) {
        b.position.copy(home);
        b.rotation.copy(b.userData.homeRot as THREE.Euler);
      } else {
        b.position.set(home.x - 0.45 - i * 0.12, ROOM.floor + 0.02, home.z + (i % 2 ? 0.1 : -0.15));
        b.rotation.set(0, 0.4 + i * 0.7, Math.PI / 2);
      }
    });
  }
  /**
   * The ghost at work: book `i` slides out, tips and drops. `u` runs 0..1 over the fall.
   */
  pushBook(i: number, u: number) {
    const b = this.ghostBooks[i];
    if (!b) return;
    const home = b.userData.home as THREE.Vector3;
    const slide = Math.min(1, u / 0.35),
      fall = Math.max(0, (u - 0.35) / 0.65);
    const floorY = ROOM.floor + 0.02;
    b.position.set(home.x - 0.2 * slide - 0.35 * fall, THREE.MathUtils.lerp(home.y, floorY, fall * fall), home.z + 0.04 * fall);
    b.rotation.set(0, fall * 0.5, (Math.PI / 2) * Math.min(1, fall * 1.3));
  }
  /** 1 = lower sash raised (open), 0 = shut. */
  setSash(open: number) {
    const y0 = ROOM.window.y0 + 0.3625;
    this.sash.position.y = y0 + open * 0.7;
  }
  lampOn(level: number) {
    this.lamp.intensity = level * 2.2;
    this.lampShade.emissiveIntensity = level * 1.4;
  }
  update(t: number) {
    // Curtains: a gentle breath normally, snapping inward when the storm is blowing.
    for (const c of this.curtains) {
      const pos = c.mesh.geometry.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < pos.count; i++) {
        const by = c.base[i * 3 + 1],
          bz = c.base[i * 3 + 2];
        const hang = THREE.MathUtils.clamp((0.85 - by) / 1.7, 0, 1);
        const flap = Math.sin(t * (2 + this.wind * 9) + by * 3 + bz * 8 + c.side) * (0.02 + this.wind * 0.12);
        pos.setX(i, c.base[i * 3] + hang * (flap + this.wind * 0.55 * hang));
        pos.setZ(i, bz + c.side * hang * this.wind * 0.25);
      }
      pos.needsUpdate = true;
      c.mesh.geometry.computeVertexNormals();
    }
  }
}
