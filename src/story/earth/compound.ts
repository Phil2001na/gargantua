import * as THREE from "three";
import { Colliders } from "./collide";
import { COMPOUND, height } from "./land";
import { concrete, chainLink, sign, tileBox } from "./textures";
import { mergeStatic } from "./merge";
import { buildRanger } from "../../endurance";

/**
 * The place at the coordinates. On the surface: a fenced yard of low concrete buildings
 * that looks abandoned. Underneath, sixty metres down: what's left of NASA.
 *
 * Underground layout (floor at y = FLOOR), west to east along z = COMPOUND.z:
 *   interrogation room → corridor → centrifuge hall (the half-built station ring) → briefing room
 */
export const FLOOR = -60;
const CZ = COMPOUND.z;
export const SPOTS = {
  gate: new THREE.Vector3(COMPOUND.x, 0, COMPOUND.z + COMPOUND.hd),
  /** Interrogation room: table centre, Cooper's chair, Murph's chair, the door. */
  table: new THREE.Vector3(333, FLOOR, CZ),
  cooperSeat: new THREE.Vector3(331.9, FLOOR, CZ),
  murphSeat: new THREE.Vector3(333.9, FLOOR, CZ + 1.05),
  interDoor: new THREE.Vector3(336, FLOOR, CZ),
  hall: new THREE.Vector3(420, FLOOR, CZ),
  hallR: 30,
  briefDoor: new THREE.Vector3(460, FLOOR, CZ),
  holo: new THREE.Vector3(466, FLOOR, CZ),
};

const std = (o: THREE.MeshStandardMaterialParameters) => new THREE.MeshStandardMaterial({ roughness: 0.85, ...o });

export class Compound {
  readonly surface = new THREE.Group();
  readonly below = new THREE.Group();
  /** Collision for the underground floors (not on the terrain). */
  readonly colliders = new Colliders(false);
  readonly floods: THREE.MeshStandardMaterial;
  readonly holo = new THREE.Group();
  private ring = new THREE.Group();
  private holoMats: THREE.Material[] = [];
  private lights: THREE.PointLight[] = [];
  readonly interLamp: THREE.PointLight;
  constructor(surfaceColliders: Colliders) {
    const conc = std({ map: concrete(), color: 0xb8b4ac, roughness: 0.95 });
    const dark = std({ color: 0x1a1c1f, roughness: 0.5, metalness: 0.4 });
    const steel = std({ color: 0x7c8084, metalness: 0.7, roughness: 0.45 });
    this.floods = std({ color: 0xdde6ff, emissive: 0xdde6ff, emissiveIntensity: 0 });

    // --- Surface ----------------------------------------------------------------
    {
      const g = this.surface;
      const box = (w: number, h: number, d: number, m: THREE.Material, x: number, z: number, y = 0, tile = 2) => {
        const mesh = new THREE.Mesh(tileBox(new THREE.BoxGeometry(w, h, d), tile), m);
        mesh.position.set(x, height(x, z) + y + h / 2, z);
        mesh.castShadow = mesh.receiveShadow = true;
        g.add(mesh);
        return mesh;
      };
      const x0 = COMPOUND.x - COMPOUND.hw,
        x1 = COMPOUND.x + COMPOUND.hw,
        z0 = CZ - COMPOUND.hd,
        z1 = CZ + COMPOUND.hd;
      const gateHalf = 4;
      // Chain-link runs, posts every 3 m, barbed wire on top.
      const mesh = std({ map: chainLink(), alphaTest: 0.5, side: THREE.DoubleSide, metalness: 0.6, roughness: 0.5 });
      const posts: THREE.Vector3[] = [];
      const run = (ax: number, az: number, bx: number, bz: number) => {
        const len = Math.hypot(bx - ax, bz - az);
        const geo = new THREE.PlaneGeometry(len, 2.4);
        const uv = geo.attributes.uv as THREE.BufferAttribute;
        for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * len, uv.getY(i) * 2.4);
        const m = new THREE.Mesh(geo, mesh);
        m.position.set((ax + bx) / 2, height((ax + bx) / 2, (az + bz) / 2) + 1.2, (az + bz) / 2);
        m.rotation.y = -Math.atan2(bz - az, bx - ax);
        g.add(m);
        for (let s = 0; s <= len; s += 3) posts.push(new THREE.Vector3(ax + ((bx - ax) * s) / len, 0, az + ((bz - az) * s) / len));
        for (const y of [2.5, 2.7]) {
          const wire = new THREE.Mesh(new THREE.BoxGeometry(len, 0.015, 0.015), steel);
          wire.position.set(m.position.x, m.position.y - 1.2 + y, m.position.z);
          wire.rotation.y = m.rotation.y;
          g.add(wire);
        }
        const t = 0.15;
        surfaceColliders.box(Math.min(ax, bx) - t, Math.max(ax, bx) + t, Math.min(az, bz) - t, Math.max(az, bz) + t, 3);
      };
      run(x0, z1, COMPOUND.x - gateHalf, z1);
      run(COMPOUND.x + gateHalf, z1, x1, z1);
      run(x1, z1, x1, z0);
      run(x1, z0, x0, z0);
      run(x0, z0, x0, z1);
      const post = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.04, 0.04, 2.9, 6), steel, posts.length);
      posts.forEach((p, i) => post.setMatrixAt(i, new THREE.Matrix4().makeTranslation(p.x, height(p.x, p.z) + 1.45, p.z)));
      post.castShadow = true;
      g.add(post);
      // The gate: two leaves, chained shut, and the signs.
      for (const s of [-1, 1]) {
        const leaf = new THREE.Mesh(new THREE.PlaneGeometry(gateHalf, 2.3), mesh);
        leaf.position.set(COMPOUND.x + (s * gateHalf) / 2, height(COMPOUND.x, z1) + 1.2, z1);
        g.add(leaf);
        box(0.12, 2.6, 0.12, steel, COMPOUND.x + s * gateHalf, z1, 0, 1);
        box(gateHalf, 0.06, 0.06, steel, COMPOUND.x + (s * gateHalf) / 2, z1, 2.3, 1);
        box(gateHalf, 0.06, 0.06, steel, COMPOUND.x + (s * gateHalf) / 2, z1, 0.1, 1);
      }
      surfaceColliders.box(COMPOUND.x - gateHalf, COMPOUND.x + gateHalf, z1 - 0.15, z1 + 0.15, 3);
      const plate = (x: number, z: number, lines: string[], yaw = 0) => {
        const m = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.9), std({ map: sign(lines), roughness: 0.7 }));
        m.position.set(x, height(x, z) + 1.4, z);
        m.rotation.y = yaw;
        g.add(m);
      };
      plate(COMPOUND.x - 2, z1 + 0.05, ["RESTRICTED", "GOVERNMENT", "PROPERTY", "NO ENTRY"]);
      plate(COMPOUND.x + 2, z1 + 0.05, ["WARNING", "USE OF FORCE", "AUTHORIZED"]);
      // Guard hut, dark.
      box(2.6, 2.6, 2.6, conc, COMPOUND.x + 9, z1 - 4);
      box(1.6, 0.8, 0.05, dark, COMPOUND.x + 9, z1 - 2.68, 1.3, 1);
      surfaceColliders.box(COMPOUND.x + 7.6, COMPOUND.x + 10.4, z1 - 5.4, z1 - 2.6, 3);
      // Low concrete buildings, a vehicle shed, a mast.
      const block = (x: number, z: number, w: number, d: number, h: number) => {
        box(w, h, d, conc, x, z, 0, 2);
        surfaceColliders.box(x - w / 2, x + w / 2, z - d / 2, z + d / 2, h);
      };
      block(COMPOUND.x, CZ - 10, 56, 30, 5.5);
      block(COMPOUND.x - 55, CZ + 25, 18, 12, 4);
      block(COMPOUND.x + 50, CZ + 30, 24, 14, 6);
      block(COMPOUND.x + 55, CZ - 40, 14, 20, 3.5);
      // The big doors on the main block, and a ramp down.
      box(14, 5, 0.1, dark, COMPOUND.x, CZ + 5.05, 0, 1);
      const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.25, 30, 8), steel);
      mast.position.set(COMPOUND.x - 20, height(COMPOUND.x - 20, CZ - 10) + 5.5 + 15, CZ - 10);
      g.add(mast);
      const dish = new THREE.Mesh(new THREE.SphereGeometry(3, 20, 10, 0, Math.PI * 2, 0, 0.9), std({ color: 0xd8d8d4, side: THREE.DoubleSide }));
      dish.position.set(COMPOUND.x + 18, height(COMPOUND.x, CZ) + 8, CZ - 14);
      dish.rotation.set(-0.9, 0.4, 0);
      g.add(dish);
      // Floodlight poles (dark until the compound wakes up).
      for (const [x, z] of [
        [x0 + 2, z1 - 2],
        [x1 - 2, z1 - 2],
        [COMPOUND.x - 14, z1 - 2],
        [COMPOUND.x + 14, z1 - 2],
        [x0 + 2, z0 + 2],
        [x1 - 2, z0 + 2],
      ]) {
        box(0.2, 9, 0.2, steel, x, z, 0, 1);
        const head = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.5, 0.4), this.floods);
        head.position.set(x, height(x, z) + 9, z);
        head.lookAt(COMPOUND.x, 0, z1 + 20);
        g.add(head);
      }
      mergeStatic(g, []);
    }

    // --- Underground ------------------------------------------------------------
    {
      const g = this.below;
      const c = this.colliders;
      const F = FLOOR;
      const add = (m: THREE.Mesh) => {
        m.castShadow = false;
        m.receiveShadow = true;
        g.add(m);
        return m;
      };
      const box = (w: number, h: number, d: number, m: THREE.Material, x: number, y: number, z: number, tile = 2) => {
        const mesh = add(new THREE.Mesh(tileBox(new THREE.BoxGeometry(w, h, d), tile), m));
        mesh.position.set(x, y, z);
        return mesh;
      };
      const wall = std({ map: concrete(), color: 0x8a8780 });
      const floorMat = std({ map: concrete(), color: 0x55534f, roughness: 0.6 });
      const strip = std({ color: 0xffffff, emissive: 0xfff4e0, emissiveIntensity: 1.6 });
      // A room is a hollow box: floor, ceiling and four walls, with optional door gaps.
      const room = (xa: number, xb: number, za: number, zb: number, h: number, doors: { side: "w" | "e"; z: number; w: number }[] = []) => {
        const t = 0.3,
          cx = (xa + xb) / 2,
          cz = (za + zb) / 2;
        box(xb - xa, t, zb - za, floorMat, cx, F - t / 2, cz);
        box(xb - xa, t, zb - za, wall, cx, F + h + t / 2, cz);
        box(xb - xa + 2 * t, h, t, wall, cx, F + h / 2, za - t / 2);
        box(xb - xa + 2 * t, h, t, wall, cx, F + h / 2, zb + t / 2);
        c.box(xa - 1, xb + 1, za - 1, za, 99, F - 1);
        c.box(xa - 1, xb + 1, zb, zb + 1, 99, F - 1);
        for (const [side, x] of [
          ["w", xa - t / 2],
          ["e", xb + t / 2],
        ] as ["w" | "e", number][]) {
          const door = doors.find((d) => d.side === side);
          const cxl = side === "w" ? xa - 1 : xb,
            cxr = side === "w" ? xa : xb + 1;
          if (!door) {
            box(t, h, zb - za, wall, x, F + h / 2, cz);
            c.box(cxl, cxr, za - 1, zb + 1, 99, F - 1);
            continue;
          }
          const d0 = door.z - door.w / 2,
            d1 = door.z + door.w / 2;
          box(t, h, d0 - za, wall, x, F + h / 2, (za + d0) / 2);
          box(t, h, zb - d1, wall, x, F + h / 2, (d1 + zb) / 2);
          if (h > 2.4) box(t, h - 2.4, door.w, wall, x, F + 2.4 + (h - 2.4) / 2, door.z);
          c.box(cxl, cxr, za - 1, d0, 99, F - 1);
          c.box(cxl, cxr, d1, zb + 1, 99, F - 1);
        }
        c.box(xa - 0.5, xb + 0.5, za - 0.5, zb + 0.5, F);
      };
      // Interrogation room: bare concrete, one lamp, a steel table and two chairs.
      room(330, 336, CZ - 2, CZ + 2, 3, [{ side: "e", z: CZ, w: 1.2 }]);
      box(1.4, 0.05, 0.9, steel, SPOTS.table.x, F + 0.76, CZ, 1);
      for (const [ox, oz] of [
        [-0.65, -0.4],
        [0.65, -0.4],
        [-0.65, 0.4],
        [0.65, 0.4],
      ])
        box(0.04, 0.74, 0.04, steel, SPOTS.table.x + ox, F + 0.37, CZ + oz, 1);
      c.box(SPOTS.table.x - 0.72, SPOTS.table.x + 0.72, CZ - 0.47, CZ + 0.47, F + 0.8);
      const chair = (x: number, z: number, yaw: number) => {
        const grp = new THREE.Group();
        const seat = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.04, 0.45), steel);
        seat.position.y = 0.46;
        const back = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.45, 0.04), steel);
        back.position.set(0, 0.7, -0.22);
        grp.add(seat, back);
        for (const [a, b] of [
          [-0.2, -0.2],
          [0.2, -0.2],
          [-0.2, 0.2],
          [0.2, 0.2],
        ]) {
          const leg = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.46, 0.03), steel);
          leg.position.set(a, 0.23, b);
          grp.add(leg);
        }
        grp.position.set(x, F, z);
        grp.rotation.y = yaw;
        g.add(grp);
      };
      chair(SPOTS.cooperSeat.x - 0.1, CZ, Math.PI / 2);
      chair(SPOTS.murphSeat.x, SPOTS.murphSeat.z + 0.1, Math.PI);
      chair(SPOTS.table.x + 1.0, CZ, -Math.PI / 2);
      const shade = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.25, 16, 1, true), std({ color: 0x2a2c2e, side: THREE.DoubleSide }));
      shade.position.set(SPOTS.table.x, F + 2.35, CZ);
      g.add(shade);
      box(0.2, 0.05, 0.2, strip, SPOTS.table.x, F + 2.24, CZ, 1);
      box(0.01, 0.6, 0.01, dark, SPOTS.table.x, F + 2.7, CZ, 1);
      this.interLamp = new THREE.PointLight(0xfff0d8, 9, 9, 1.5);
      this.interLamp.position.set(SPOTS.table.x, F + 2.15, CZ);
      g.add(this.interLamp);
      this.lights.push(this.interLamp);
      // A one-way mirror on the north wall.
      box(2.2, 1.1, 0.02, std({ color: 0x0a0c0e, roughness: 0.05, metalness: 0.9 }), SPOTS.table.x, F + 1.6, CZ - 1.99, 1);

      // Corridor to the hall, lit by ceiling strips.
      room(336, 390.5, CZ - 1.5, CZ + 1.5, 3.2, [
        { side: "w", z: CZ, w: 1.2 },
        { side: "e", z: CZ, w: 3 },
      ]);
      for (let x = 340; x < 390; x += 6) box(1.6, 0.04, 0.2, strip, x, F + 3.16, CZ, 1);
      const cl = new THREE.PointLight(0xfff0e0, 6, 30, 1.2);
      cl.position.set(363, F + 2.8, CZ);
      g.add(cl);
      this.lights.push(cl);

      // --- The hall: a concrete drum 60 m across and 45 m tall ------------------
      const H = SPOTS.hall,
        R = SPOTS.hallR,
        HH = 45,
        sides = 48;
      const floorDisc = add(new THREE.Mesh(new THREE.CircleGeometry(R + 0.5, 64).rotateX(-Math.PI / 2), floorMat));
      floorDisc.position.set(H.x, F, H.z);
      const uvF = floorDisc.geometry.attributes.uv as THREE.BufferAttribute;
      for (let i = 0; i < uvF.count; i++) uvF.setXY(i, uvF.getX(i) * 20, uvF.getY(i) * 20);
      const ceil = add(new THREE.Mesh(new THREE.CircleGeometry(R + 0.5, 64).rotateX(Math.PI / 2), wall));
      ceil.position.set(H.x, F + HH, H.z);
      const panelW = 2 * R * Math.tan(Math.PI / sides) + 0.05;
      for (let i = 0; i < sides; i++) {
        const a = (i / sides) * Math.PI * 2;
        const px = H.x + Math.cos(a) * (R + 0.25),
          pz = H.z + Math.sin(a) * (R + 0.25);
        const door = Math.abs(Math.sin(a)) < 0.05; // the panels facing east and west
        const y0 = door ? 3.2 : 0;
        const p = box(panelW, HH - y0, 0.5, wall, px, F + y0 + (HH - y0) / 2, pz, 4);
        p.rotation.y = -a + Math.PI / 2;
        if (!door) c.circle(H.x + Math.cos(a) * (R + 1.9), H.z + Math.sin(a) * (R + 1.9), 2.1, 99);
        // Ribs and gantry lights up the wall.
        if (i % 4 === 0) {
          const rib = box(0.6, HH, 0.6, steel, H.x + Math.cos(a) * (R - 0.1), F + HH / 2, H.z + Math.sin(a) * (R - 0.1), 1);
          rib.rotation.y = -a;
          for (const y of [8, 20, 32]) box(0.5, 0.3, 0.5, strip, H.x + Math.cos(a) * (R - 0.5), F + y, H.z + Math.sin(a) * (R - 0.5), 1);
        }
      }
      c.box(H.x - R - 1, H.x + R + 1, H.z - R - 1, H.z + R + 1, F);
      // Galleries at two levels.
      for (const y of [12, 24]) {
        const gal = add(new THREE.Mesh(new THREE.RingGeometry(R - 3, R, 64).rotateX(-Math.PI / 2), steel));
        gal.position.set(H.x, F + y, H.z);
        (gal.material as THREE.Material).side = THREE.DoubleSide;
        const rail = add(new THREE.Mesh(new THREE.TorusGeometry(R - 3, 0.04, 4, 96).rotateX(Math.PI / 2), steel));
        rail.position.set(H.x, F + y + 1.1, H.z);
      }
      // The half-built station: a ring of habitat sections hung under the roof, turning slowly.
      const clad = std({ color: 0xc9c7c0, metalness: 0.35, roughness: 0.5, side: THREE.DoubleSide });
      const glow = std({ color: 0x222, emissive: 0xffd9a0, emissiveIntensity: 1.2 });
      const frame = new THREE.Mesh(new THREE.TorusGeometry(19, 0.35, 8, 120), steel);
      frame.rotation.x = Math.PI / 2;
      this.ring.add(frame);
      const frame2 = frame.clone();
      frame2.scale.setScalar(1.22);
      this.ring.add(frame2);
      for (let i = 0; i < 36; i++) {
        const a = (i / 36) * Math.PI * 2;
        const rib = new THREE.Mesh(new THREE.BoxGeometry(0.25, 5, 4.6), steel);
        rib.position.set(Math.cos(a) * 21.1, 0, Math.sin(a) * 21.1);
        rib.rotation.y = -a;
        this.ring.add(rib);
        if (i < 22) {
          // Clad sections, with lit windows.
          const shell = new THREE.Mesh(new THREE.CylinderGeometry(23.2, 23.2, 5, 4, 1, true, -a - Math.PI / 36 + Math.PI / 2, Math.PI / 18), clad);
          this.ring.add(shell);
          if (i % 2 === 0) {
            const win = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.5, 2), glow);
            win.position.set(Math.cos(a) * 23.25, 0.8, Math.sin(a) * 23.25);
            win.rotation.y = -a;
            this.ring.add(win);
          }
        }
      }
      for (let i = 0; i < 6; i++) {
        const spoke = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 19, 6), steel);
        const a = (i / 6) * Math.PI * 2;
        spoke.rotation.z = Math.PI / 2;
        spoke.rotation.y = -a;
        spoke.position.set(Math.cos(a) * 9.5, 0, Math.sin(a) * 9.5);
        this.ring.add(spoke);
      }
      const hub = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.2, 6, 20), clad);
      this.ring.add(hub);
      const cable = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 10, 8), steel);
      cable.position.y = 8;
      this.ring.add(cable);
      this.ring.position.set(H.x, F + 32, H.z);
      g.add(this.ring);
      // A Ranger on the floor, surrounded by work stands.
      const ranger = buildRanger().group;
      ranger.position.set(H.x + 2, F + 1.6, H.z + 8);
      ranger.rotation.y = 2.2;
      g.add(ranger);
      c.circle(H.x + 2, H.z + 8, 8.5, 99);
      for (const [dx, dz] of [
        [-9, 2],
        [10, 14],
        [4, -2],
      ]) {
        box(2, 3, 2, steel, H.x + dx, F + 1.5, H.z + dz, 1);
        c.box(H.x + dx - 1, H.x + dx + 1, H.z + dz - 1, H.z + dz + 1, F + 3);
      }
      for (const [x, y, z, i] of [
        [H.x, F + 26, H.z, 22],
        [H.x - 18, F + 6, H.z, 10],
        [H.x + 18, F + 6, H.z, 10],
      ]) {
        const l = new THREE.PointLight(0xffe2c0, i * 9, 60, 1.6);
        l.position.set(x, y, z);
        g.add(l);
        this.lights.push(l);
      }

      // Corridor from the hall to the briefing room.
      room(449.5, 460, CZ - 1.5, CZ + 1.5, 3.2, [
        { side: "w", z: CZ, w: 3 },
        { side: "e", z: CZ, w: 1.4 },
      ]);
      for (let x = 452; x < 460; x += 4) box(1.6, 0.04, 0.2, strip, x, F + 3.16, CZ, 1);
      // Briefing room: dark, with a round table and the hologram.
      room(460, 472, CZ - 6, CZ + 6, 3.6, [{ side: "w", z: CZ, w: 1.4 }]);
      const holo = SPOTS.holo;
      const table = add(new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.5, 0.9, 40), dark));
      table.position.set(holo.x, F + 0.45, holo.z);
      const top = add(new THREE.Mesh(new THREE.CylinderGeometry(1.45, 1.45, 0.02, 40), std({ color: 0x0c141c, emissive: 0x2a5a88, emissiveIntensity: 0.22 })));
      top.position.set(holo.x, F + 0.91, holo.z);
      c.circle(holo.x, holo.z, 1.6, 99);
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2 + 0.3;
        if (Math.cos(a) < -0.7) continue; // leave the side facing the door open
        chair(holo.x + Math.cos(a) * 2.3, holo.z + Math.sin(a) * 2.3, -a - Math.PI / 2);
      }
      const bl = new THREE.PointLight(0x9fc8ff, 7, 12, 1.4);
      bl.position.set(holo.x, F + 2.6, holo.z);
      g.add(bl);
      this.lights.push(bl);
      for (let x = 462; x < 472; x += 3) box(0.2, 0.04, 8, strip, x, F + 3.56, CZ, 1);
      // Screens along the walls.
      for (const s of [-1, 1]) box(4, 1.6, 0.05, std({ color: 0x0c1116, emissive: 0x1f4460, emissiveIntensity: 0.5 }), holo.x, F + 1.8, CZ + s * 5.95, 1);

      // The hologram: Saturn, the wormhole, and the Lazarus worlds beyond it.
      const hm = (color: number, opacity: number) => {
        const m = new THREE.MeshBasicMaterial({ color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false });
        this.holoMats.push(m);
        return m;
      };
      const saturn = new THREE.Mesh(new THREE.SphereGeometry(0.22, 24, 16), hm(0xe8c890, 0.55));
      saturn.position.set(-0.55, 0, 0);
      const rings = new THREE.Mesh(new THREE.RingGeometry(0.3, 0.46, 48).rotateX(-Math.PI / 2 + 0.35), hm(0xd8c0a0, 0.35));
      rings.position.copy(saturn.position);
      (rings.material as THREE.Material).side = THREE.DoubleSide;
      const worm = new THREE.Mesh(new THREE.SphereGeometry(0.13, 24, 16), hm(0x9fd0ff, 0.6));
      worm.position.set(0.25, 0.12, 0.2);
      const halo = new THREE.Mesh(new THREE.RingGeometry(0.15, 0.2, 40), hm(0xcfe6ff, 0.5));
      halo.position.copy(worm.position);
      halo.userData.face = true;
      this.holo.add(saturn, rings, worm, halo);
      // Twelve beacons: most dim, three brighter.
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2;
        const bright = i === 2 || i === 6 || i === 9;
        const dot = new THREE.Mesh(new THREE.SphereGeometry(bright ? 0.035 : 0.02, 10, 8), hm(bright ? 0x9fffcf : 0x6a8aa8, bright ? 0.9 : 0.5));
        dot.position.set(0.85 + Math.cos(a) * 0.32, 0.25 + Math.sin(a * 2) * 0.08, Math.sin(a) * 0.32);
        dot.userData.beacon = i;
        this.holo.add(dot);
      }
      const path = new THREE.Mesh(new THREE.TorusGeometry(0.32, 0.004, 4, 64).rotateX(Math.PI / 2), hm(0x6a8aa8, 0.4));
      path.position.set(0.85, 0.25, 0);
      this.holo.add(path);
      this.holo.scale.setScalar(1.7);
      this.holo.position.set(holo.x - 0.2, F + 1.2, holo.z);
      g.add(this.holo);

      mergeStatic(g, [this.ring, this.holo, ranger]);
    }
    this.lightsOn(false);
    this.holoLevel(0);
  }
  /** Lights cost every material a little, so they're only on while you're down here. */
  lightsOn(on: boolean) {
    for (const l of this.lights) l.visible = on;
    this.below.visible = on;
  }
  holoLevel(k: number) {
    this.holo.visible = k > 0;
    this.holoMats.forEach((m) => ((m as THREE.MeshBasicMaterial).userData.base ??= (m as THREE.MeshBasicMaterial).opacity));
    this.holoMats.forEach((m) => ((m as THREE.MeshBasicMaterial).opacity = (m.userData.base as number) * k));
  }
  update(t: number, camera: THREE.Camera) {
    this.ring.rotation.y = t * 0.02;
    this.holo.rotation.y = t * 0.15;
    for (const c of this.holo.children) if (c.userData.face) c.lookAt(camera.position);
  }
}
