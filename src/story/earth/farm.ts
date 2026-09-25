import * as THREE from "three";
import { clapboard, shingles, barnBoards, tin, planks, brick, tileBox } from "./textures";
import { Colliders } from "./collide";
import { height, DRIVE_X, ROAD_Z } from "./land";
import { person, CAST, type Person } from "./people";
import { mergeStatic } from "./merge";

/**
 * The Cooper farmstead: a two-storey clapboard house with a deep porch, a weathered barn,
 * grain bins, a windmill pump and a fence along the road. The house faces south (+z).
 */

const std = (o: THREE.MeshStandardMaterialParameters) => new THREE.MeshStandardMaterial({ roughness: 0.85, ...o });
function tex(t: THREE.Texture, o: THREE.MeshStandardMaterialParameters = {}) {
  return std({ map: t, ...o });
}

export class Farm {
  readonly group = new THREE.Group();
  readonly colliders = new Colliders();
  readonly donald: Person;
  private fan: THREE.Object3D;
  constructor() {
    const g = this.group;
    const siding = tex(clapboard()),
      trim = std({ color: 0xe8e4da }),
      roof = tex(shingles(), { roughness: 0.95 }),
      glass = std({ color: 0x141b22, roughness: 0.15, metalness: 0.4 }),
      wood = tex(planks()),
      stone = std({ color: 0x7c7468, roughness: 1 });
    const add = (m: THREE.Mesh, cast = true) => {
      m.castShadow = cast;
      m.receiveShadow = true;
      g.add(m);
      return m;
    };
    const box = (w: number, h: number, d: number, m: THREE.Material, x: number, y: number, z: number, tile = 1.6) =>
      add(new THREE.Mesh(tileBox(new THREE.BoxGeometry(w, h, d), tile), m)).translateX(x).translateY(y).translateZ(z) as THREE.Mesh;

    // --- House -------------------------------------------------------------
    const found = 0.6,
      wallTop = 6.3;
    box(10.4, found + 0.3, 8.4, stone, 0, (found - 0.3) / 2, 0);
    box(10, wallTop - found, 8, siding.clone(), 0, (wallTop + found) / 2, 0).castShadow = false;
    // Gable roof, ridge along x.
    const run = 4.6,
      rise = 2.7,
      slope = Math.hypot(run, rise),
      pitch = Math.atan2(rise, run);
    for (const s of [1, -1]) {
      const r = box(11.2, 0.16, slope, roof, 0, wallTop + rise / 2, (s * run) / 2, 2.4);
      r.rotation.x = s * pitch;
    }
    const gable = new THREE.Shape([new THREE.Vector2(-4, 0), new THREE.Vector2(4, 0), new THREE.Vector2(0, rise - 0.08)]);
    for (const s of [1, -1]) {
      const geo = new THREE.ExtrudeGeometry(gable, { depth: 0.1, bevelEnabled: false });
      const uv = geo.getAttribute("uv") as THREE.BufferAttribute;
      for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) / 1.6, uv.getY(i) / 1.6);
      const m = add(new THREE.Mesh(geo, siding));
      m.rotation.y = Math.PI / 2;
      m.position.set(s * 4.95 - 0.05, wallTop, 0);
    }
    // Fascia boards and corner trim.
    for (const s of [1, -1]) box(10.1, 0.25, 0.08, trim, 0, wallTop - 0.1, s * 4.05);
    for (const [x, z] of [
      [5, 4],
      [-5, 4],
      [5, -4],
      [-5, -4],
    ])
      box(0.16, wallTop - found, 0.16, trim, x, (wallTop + found) / 2, z);
    // Windows: a frame of four trim bars, glass, a cross mullion and a sill. "see" windows
    // have clear glass (Murph's room); "open" ones have the lower sash raised.
    const clear = std({ color: 0xa9b8c0, roughness: 0.05, metalness: 0, transparent: true, opacity: 0.16, depthWrite: false });
    const window = (x: number, y: number, z: number, face: "z" | "x", s: number, kind: "solid" | "see" | "open" = "solid") => {
      const w = 0.95,
        h = 1.45;
      // Everything is laid out in the wall plane: u along the wall, n out of it.
      const at = (u: number, v: number, n: number, du: number, dv: number, dn: number, m: THREE.Material) =>
        face === "z" ? box(du, dv, dn, m, x + u, y + v, z + s * n) : box(dn, dv, du, m, x + s * n, y + v, z + u);
      const f = 0.1;
      at(0, (h + f) / 2, 0, w + 2 * f, f, 0.1, trim);
      at(0, -(h + f) / 2, 0, w + 2 * f, f, 0.1, trim);
      at((w + f) / 2, 0, 0, f, h, 0.1, trim);
      at(-(w + f) / 2, 0, 0, f, h, 0.1, trim);
      if (kind === "solid") at(0, 0, 0.01, w, h, 0.06, glass);
      // Clear glass lets the sun through (no shadow).
      else if (kind === "see") at(0, 0, 0.01, w, h, 0.02, clear).castShadow = false;
      else at(0, h / 4, 0.01, w, h / 2, 0.02, clear).castShadow = false;
      at(0, 0, 0.04, w, 0.05, 0.05, trim);
      at(0, kind === "open" ? h / 4 : 0, 0.04, 0.05, kind === "open" ? h / 2 : h, 0.05, trim);
      at(0, -h / 2 - 0.1, 0.08, w + 0.35, 0.08, 0.2, trim);
      holes.push({ face, s, u: face === "z" ? x : z, y, w, h });
    };
    const holes: { face: "z" | "x"; s: number; u: number; y: number; w: number; h: number }[] = [];
    for (const x of [-3.4, -1.6, 1.6, 3.4]) window(x, 2.3, 4.02, "z", 1);
    for (const x of [-3.2, 0, 3.2]) window(x, 4.9, 4.02, "z", 1);
    window(-3.2, 4.9, -4.02, "z", -1, "see");
    for (const x of [0, 3.2]) window(x, 4.9, -4.02, "z", -1);
    for (const x of [-2.5, 2.5]) window(x, 2.3, -4.02, "z", -1);
    for (const z of [-2, 2]) {
      window(-5.02, 2.3, z, "x", -1);
      window(-5.02, 4.9, z, "x", -1, z < 0 ? "open" : "solid");
      window(5.02, 4.9, z, "x", 1);
    }
    holes.push({ face: "z", s: 1, u: 0, y: found + 1.15, w: 1.2, h: 2.3 });
    // The siding is a solid block for looks only; shadows come from an inner shell that
    // has real window openings, so evening sun can reach the floor of Murph's room.
    this.shell(g, holes, found, wallTop);
    // Front door with screen door.
    box(1.2, 2.3, 0.1, trim, 0, found + 1.15, 4.02);
    box(0.95, 2.15, 0.08, std({ color: 0x3f4a44 }), 0, found + 1.08, 4.06);
    // Chimney.
    box(0.9, 5.2, 0.9, tex(brick()), 3.2, wallTop + 1.4, -1.2, 1);
    // Porch across the front.
    box(10.6, found, 2.8, wood, 0, found / 2, 5.4, 1.6);
    for (const x of [-5.1, -2.6, 2.6, 5.1]) {
      box(0.18, 2.8, 0.18, trim, x, found + 1.4, 6.6);
    }
    const porchRoof = box(11, 0.12, 3.2, roof, 0, 3.55, 5.55, 2.4);
    porchRoof.rotation.x = 0.16;
    for (const x of [-3.85, 3.85]) box(2.3, 0.08, 0.08, trim, x, found + 0.9, 6.6);
    for (const x of [-3.85, 3.85]) for (let i = -5; i <= 5; i++) box(0.04, 0.9, 0.04, trim, x + i * 0.2, found + 0.45, 6.6);
    // Steps.
    box(2.2, 0.4, 0.45, wood, 0, 0.2, 7.0);
    box(2.2, 0.2, 0.45, wood, 0, 0.1, 7.45);
    // Kitchen wing (one storey) to the east.
    box(4.6, 3.1, 5.5, siding, 7.3, found + 1.55, -1.25);
    for (const s of [1, -1]) {
      const r = box(6.2, 0.14, 3.2, roof, 7.4, found + 3.1 + 0.9, -1.25 + s * 1.45, 2.4);
      r.rotation.x = s * 0.55;
    }
    window(9.62, 2.2, -1.2, "x", 1);
    window(7.3, 2.2, 1.52, "z", 1);
    // Rocking chair and Grandpa on the porch.
    const chair = new THREE.Group();
    const seat = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.06, 0.5), wood);
    seat.position.y = 0.45;
    const back = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.7, 0.05), wood);
    back.position.set(0, 0.8, -0.24);
    back.rotation.x = -0.15;
    chair.add(seat, back);
    chair.position.set(-3.1, found, 5.2);
    chair.rotation.y = 0.35;
    g.add(chair);
    this.donald = person(CAST.donald, true);
    this.donald.root.position.set(-3.1, found + 0.03, 5.18);
    this.donald.root.rotation.y = 0.35;
    g.add(this.donald.root);

    const c = this.colliders;
    c.box(-5.1, 5.1, -4.1, 4.1, 20); // house walls
    c.box(5, 9.7, -4.05, 1.6, 20); // kitchen wing
    c.box(-5.3, 5.3, 4, 6.8, found); // porch floor
    c.box(-1.1, 1.1, 6.8, 7.25, 0.4);
    c.box(-1.1, 1.1, 7.25, 7.7, 0.2);
    for (const x of [-5.1, -2.6, 2.6, 5.1]) c.circle(x, 6.6, 0.15, 4);
    c.box(-5.1, -2.7, 6.55, 6.65, found + 1); // railings
    c.box(2.7, 5.1, 6.55, 6.65, found + 1);
    c.circle(-3.1, 5.2, 0.35, 2);

    // --- Barn --------------------------------------------------------------
    const bx = -38,
      bz = -30,
      bh = height(bx, bz);
    const boards = tex(barnBoards());
    box(14, 5.2, 20, boards, bx, bh + 2.6, bz, 3);
    const bRun = 7.4,
      bRise = 4.2;
    for (const s of [1, -1]) {
      const r = box(Math.hypot(bRun, bRise), 0.16, 21, tex(tin(), { metalness: 0.4, roughness: 0.6 }), bx + (s * bRun) / 2, bh + 5.2 + bRise / 2, bz, 3);
      r.rotation.z = -s * Math.atan2(bRise, bRun);
    }
    const bGable = new THREE.Shape([new THREE.Vector2(-7, 0), new THREE.Vector2(7, 0), new THREE.Vector2(0, bRise - 0.1)]);
    for (const s of [1, -1]) {
      const geo = new THREE.ExtrudeGeometry(bGable, { depth: 0.1, bevelEnabled: false });
      const uv = geo.getAttribute("uv") as THREE.BufferAttribute;
      for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) / 3, uv.getY(i) / 3);
      const m = add(new THREE.Mesh(geo, boards));
      m.position.set(bx, bh + 5.2, bz + s * 10 - 0.05);
    }
    // Big sliding door facing the yard (east), open a crack.
    box(0.2, 4.2, 5, std({ color: 0x0c0a09 }), bx + 7.02, bh + 2.1, bz + 2);
    box(0.25, 4.4, 3.2, boards, bx + 7.15, bh + 2.2, bz + 3.6, 3);
    c.box(bx - 7, bx + 7, bz - 10, bz + 10, 20);

    // --- Grain bins --------------------------------------------------------
    for (const [x, z, r] of [
      [26, -32, 4],
      [36, -29, 3.4],
    ]) {
      const y = height(x, z);
      const shell = add(
        new THREE.Mesh(new THREE.CylinderGeometry(r, r, 7, 28, 1, true), tex(tin(), { metalness: 0.55, roughness: 0.45, side: THREE.DoubleSide })),
      );
      shell.position.set(x, y + 3.5, z);
      const map = (shell.material as THREE.MeshStandardMaterial).map!;
      map.repeat.set(3, 1);
      const cap = add(new THREE.Mesh(new THREE.ConeGeometry(r + 0.25, 2.4, 28), std({ color: 0x9da2a6, metalness: 0.6, roughness: 0.45 })));
      cap.position.set(x, y + 8.2, z);
      c.circle(x, z, r, 20);
    }

    // --- Windmill pump -----------------------------------------------------
    const wx = -16,
      wz = -14,
      wy = height(wx, wz);
    const steel = std({ color: 0x6f6c66, metalness: 0.5, roughness: 0.6 });
    for (const [dx, dz] of [
      [1, 1],
      [1, -1],
      [-1, 1],
      [-1, -1],
    ]) {
      const leg = add(new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 11, 6), steel));
      leg.position.set(wx + dx * 0.8, wy + 5.5, wz + dz * 0.8);
      leg.rotation.set(dz * -0.075, 0, dx * 0.075);
      c.circle(wx + dx * 1.2, wz + dz * 1.2, 0.12, 20);
    }
    for (let i = 1; i < 5; i++) {
      const h = i * 2.2,
        half = 1.21 - 0.075 * h;
      for (const s of [1, -1]) {
        box(half * 2, 0.05, 0.05, steel, wx, wy + h, wz + s * half);
        box(0.05, 0.05, half * 2, steel, wx + s * half, wy + h, wz);
      }
    }
    this.fan = new THREE.Group();
    this.fan.position.set(wx, wy + 11.2, wz + 0.6);
    const vane = std({ color: 0xb7b2a6, metalness: 0.3, roughness: 0.6, side: THREE.DoubleSide });
    for (let i = 0; i < 18; i++) {
      const blade = new THREE.Mesh(new THREE.PlaneGeometry(0.28, 1.25), vane);
      blade.position.y = 0.95;
      blade.rotation.y = 0.5;
      const arm = new THREE.Group();
      arm.rotation.z = (i / 18) * Math.PI * 2;
      arm.add(blade);
      this.fan.add(arm);
    }
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.3, 12).rotateX(Math.PI / 2), steel);
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.9, 1.6), vane);
    tail.position.set(0, 0, -1.3);
    this.fan.add(hub);
    const head = new THREE.Group();
    head.position.copy(this.fan.position);
    tail.position.set(0, 0.1, -1.6);
    head.add(tail);
    g.add(this.fan, head);

    // --- Dead cottonwood ---------------------------------------------------
    const bark = std({ color: 0x5a4f45, roughness: 1 });
    const tree = (x: number, z: number, s: number) => {
      const y = height(x, z);
      const trunk = add(new THREE.Mesh(new THREE.CylinderGeometry(0.22 * s, 0.4 * s, 6 * s, 8), bark));
      trunk.position.set(x, y + 3 * s, z);
      const rand = (i: number) => Math.abs(Math.sin(i * 91.7 + x * 3.1));
      for (let i = 0; i < 7; i++) {
        const len = (2 + rand(i) * 2.5) * s;
        const br = add(new THREE.Mesh(new THREE.CylinderGeometry(0.04 * s, 0.14 * s, len, 5), bark));
        const a = (i / 7) * Math.PI * 2 + rand(i + 3);
        const tilt = 0.5 + rand(i + 5) * 0.5;
        br.position.set(x + Math.cos(a) * Math.sin(tilt) * len * 0.5, y + (3.5 + rand(i + 1) * 2.5) * s + Math.cos(tilt) * len * 0.5, z + Math.sin(a) * Math.sin(tilt) * len * 0.5);
        br.rotation.set(Math.sin(a) * tilt, 0, -Math.cos(a) * tilt);
      }
      c.circle(x, z, 0.45 * s, 20);
    };
    tree(-17, 20, 1.2);
    tree(46, 4, 0.9);

    // --- Fence along the road, gap at the driveway -------------------------
    const post = new THREE.CylinderGeometry(0.06, 0.07, 1.3, 5);
    const postMat = std({ color: 0x6b5c4b, roughness: 1 });
    const posts: THREE.Vector3[] = [];
    for (let x = -120; x <= 120; x += 3.2) if (Math.abs(x - DRIVE_X) > 4) posts.push(new THREE.Vector3(x, height(x, ROAD_Z - 6) + 0.6, ROAD_Z - 6));
    const fence = new THREE.InstancedMesh(post, postMat, posts.length);
    posts.forEach((p, i) => fence.setMatrixAt(i, new THREE.Matrix4().makeTranslation(p.x, p.y, p.z)));
    fence.castShadow = true;
    g.add(fence);
    const wire = std({ color: 0x3a3632, metalness: 0.6 });
    for (const [a, b] of [
      [-120, DRIVE_X - 4],
      [DRIVE_X + 4, 120],
    ]) {
      for (const y of [0.5, 0.95]) {
        const w = new THREE.Mesh(new THREE.BoxGeometry(b - a, 0.012, 0.012), wire);
        w.position.set((a + b) / 2, y, ROAD_Z - 6);
        g.add(w);
      }
      c.box(a, b, ROAD_Z - 6.1, ROAD_Z - 5.9, 1.2);
    }
    // Mailbox.
    const mail = add(new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.5, 12, 1, false, 0, Math.PI).rotateZ(Math.PI / 2).rotateY(Math.PI / 2), std({ color: 0x8b8e90, metalness: 0.5 })));
    mail.position.set(DRIVE_X + 3, 1.15, ROAD_Z - 5);
    box(0.08, 1.05, 0.08, postMat, DRIVE_X + 3, 0.5, ROAD_Z - 5);
    c.circle(DRIVE_X + 3, ROAD_Z - 5, 0.2, 2);

    // Yard clutter: an old tractor tyre, a hay bale.
    const bale = add(new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.8, 1.2, 18).rotateZ(Math.PI / 2), std({ color: 0xa08c5a, roughness: 1 })));
    bale.position.set(-26, height(-26, -14) + 0.8, -14);
    c.circle(-26, -14, 0.9, 2);
    mergeStatic(g, [this.donald.root, this.fan, head]);
  }
  /**
   * Plaster walls just inside the siding, with holes where the windows are, plus the upper
   * floor and ceiling slabs. Seen from inside the house, and they cast the house's shadow.
   */
  private shell(g: THREE.Group, holes: { face: "z" | "x"; s: number; u: number; y: number; w: number; h: number }[], y0: number, y1: number) {
    const plaster = std({ color: 0xd9d0bf, roughness: 0.95 });
    const piece = (face: "z" | "x", s: number, u0: number, u1: number, v0: number, v1: number) => {
      if (u1 - u0 < 1e-3 || v1 - v0 < 1e-3) return;
      const t = 0.1,
        n = face === "z" ? 3.9 : 4.9;
      const m = new THREE.Mesh(new THREE.BoxGeometry(face === "z" ? u1 - u0 : t, v1 - v0, face === "z" ? t : u1 - u0), plaster);
      if (face === "z") m.position.set((u0 + u1) / 2, (v0 + v1) / 2, s * n);
      else m.position.set(s * n, (v0 + v1) / 2, (u0 + u1) / 2);
      m.castShadow = true;
      m.receiveShadow = true;
      g.add(m);
    };
    for (const [face, s] of [
      ["z", 1],
      ["z", -1],
      ["x", 1],
      ["x", -1],
    ] as ["z" | "x", number][]) {
      const half = face === "z" ? 4.95 : 3.85;
      const mine = holes.filter((h) => h.face === face && h.s === s);
      // Cut the wall into vertical strips at every hole edge, then fill each strip around its holes.
      const cuts = new Set([-half, half]);
      for (const h of mine) {
        cuts.add(h.u - h.w / 2);
        cuts.add(h.u + h.w / 2);
      }
      const us = [...cuts].sort((a, b) => a - b);
      for (let i = 0; i < us.length - 1; i++) {
        const a = us[i],
          b = us[i + 1],
          mid = (a + b) / 2;
        const inStrip = mine.filter((h) => Math.abs(mid - h.u) < h.w / 2).sort((p, q) => p.y - q.y);
        let v = y0;
        for (const h of inStrip) {
          piece(face, s, a, b, v, h.y - h.h / 2);
          v = h.y + h.h / 2;
        }
        piece(face, s, a, b, v, y1);
      }
    }
    // Upper floor and ceiling.
    for (const [yb, yt] of [
      [3.45, 3.6],
      [6.15, 6.28],
    ]) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(9.7, yt - yb, 7.7), plaster);
      m.position.set(0, (yb + yt) / 2, 0);
      m.castShadow = m.receiveShadow = true;
      g.add(m);
    }
  }
  update(t: number) {
    this.fan.rotation.z = t * 2.2;
  }
}
