import { height } from "./land";

/** Axis-aligned solid with a flat top (a wall block, a porch, a step). */
export type Box = { minX: number; maxX: number; minZ: number; maxZ: number; top: number; bottom?: number };
/** Upright cylinder (a post, a grain bin, a tree trunk). */
export type Circle = { x: number; z: number; r: number; top: number };

/**
 * Static world collision for walking and driving. Anything whose top is within a step
 * of your feet can be stood on; anything taller pushes you out sideways.
 */
export class Colliders {
  boxes: Box[] = [];
  circles: Circle[] = [];
  /** Moving solids (the truck) refreshed every frame. */
  dynamic: Circle[] = [];
  /** False for interiors below or detached from the terrain: only boxes count as floor. */
  constructor(public terrain = true) {}
  box(minX: number, maxX: number, minZ: number, maxZ: number, top: number, bottom = -10) {
    this.boxes.push({ minX, maxX, minZ, maxZ, top, bottom });
  }
  circle(x: number, z: number, r: number, top: number) {
    this.circles.push({ x, z, r, top });
  }
  /** Highest surface under (x,z) that is at most `step` above `feet`. */
  floorAt(x: number, z: number, feet: number, step = 0.45) {
    let y = this.terrain ? height(x, z) : -1e4;
    for (const b of this.boxes)
      if (x > b.minX && x < b.maxX && z > b.minZ && z < b.maxZ && b.top <= feet + step && b.top > y) y = b.top;
    return y;
  }
  /** Push a circle of radius r out of every solid taller than a step. Returns the push normal if hit. */
  resolve(p: { x: number; z: number }, r: number, feet: number, step = 0.45, skipDynamic = false) {
    let hit: { nx: number; nz: number } | null = null;
    for (const b of this.boxes) {
      if (b.top <= feet + step || (b.bottom ?? -10) > feet + 1.7) continue;
      const cx = Math.max(b.minX, Math.min(p.x, b.maxX)),
        cz = Math.max(b.minZ, Math.min(p.z, b.maxZ));
      let dx = p.x - cx,
        dz = p.z - cz;
      const d2 = dx * dx + dz * dz;
      if (d2 >= r * r) continue;
      if (d2 < 1e-8) {
        // Centre is inside the box: leave by the nearest face.
        const faces = [p.x - b.minX, b.maxX - p.x, p.z - b.minZ, b.maxZ - p.z];
        const i = faces.indexOf(Math.min(...faces));
        dx = i === 0 ? -1 : i === 1 ? 1 : 0;
        dz = i === 2 ? -1 : i === 3 ? 1 : 0;
        const push = faces[i] + r;
        p.x += dx * push;
        p.z += dz * push;
        hit = { nx: dx, nz: dz };
        continue;
      }
      const d = Math.sqrt(d2);
      p.x += (dx / d) * (r - d);
      p.z += (dz / d) * (r - d);
      hit = { nx: dx / d, nz: dz / d };
    }
    for (const c of skipDynamic ? this.circles : [...this.circles, ...this.dynamic]) {
      if (c.top <= feet + step) continue;
      const dx = p.x - c.x,
        dz = p.z - c.z,
        d = Math.hypot(dx, dz),
        min = r + c.r;
      if (d >= min || d < 1e-6) continue;
      p.x += (dx / d) * (min - d);
      p.z += (dz / d) * (min - d);
      hit = { nx: dx / d, nz: dz / d };
    }
    return hit;
  }
}
