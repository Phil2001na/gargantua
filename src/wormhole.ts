import * as THREE from "three";

/**
 * Wormhole geometry after James, von Tunzelmann, Franklin & Thorne,
 * "Visualizing Interstellar's Wormhole" (Am. J. Phys. 83, 486, 2015).
 *
 * Metric: ds² = −dt² + dℓ² + r(ℓ)²(dθ² + sin²θ dφ²), with a cylindrical throat
 * of radius ρ and length 2a, flaring out with lensing length M:
 *   r = ρ                                  |ℓ| ≤ a
 *   r = ρ + M(x atan x − ½ ln(1 + x²))     x = 2(|ℓ| − a)/(πM)
 *
 * Beyond ℓ = L1 the flare is blended smoothly into exactly flat space (r′ = 1)
 * by ℓ = L2, so light bending falls to zero at the lens boundary and the
 * ray-traced region joins the ordinary 3D scene without a seam.
 *
 * Each side has its own Euclidean frame with the mouth at `mouth` and ℓ ≥ 0
 * meaning "on this side". Crossing ℓ = 0 maps position n → M n and vectors
 * v → M (I − 2nnᵀ) v, a proper rotation, so orientation stays right-handed.
 */
export const RHO = 2.5;
export const A = 0.7 * RHO;
export const LENS_M = 0.22 * RHO;
export const L1 = 2.6 * RHO;
export const L2 = 5.5 * RHO;

const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
/** dr/dℓ for ℓ ≥ 0 */
export function drdl(l: number) {
  const L = Math.abs(l);
  if (L <= A) return 0;
  const x = (2 * (L - A)) / (Math.PI * LENS_M);
  const d = (2 / Math.PI) * Math.atan(x);
  return d + (1 - d) * smooth(L1, L2, L);
}
const TABLE = 4096;
const table = new Float32Array(TABLE + 1);
{
  // Integrate r(ℓ) once so JS and GLSL (which integrates along the ray) agree.
  let r = RHO;
  const h = L2 / TABLE;
  table[0] = RHO;
  for (let i = 0; i < TABLE; i++) {
    const l = i * h;
    r += (h / 6) * (drdl(l) + 4 * drdl(l + h / 2) + drdl(l + h));
    table[i + 1] = r;
  }
}
/** Embedding radius at the lens boundary; beyond it space is flat. */
export const RZ = table[TABLE];
export function radiusAt(l: number) {
  const L = Math.abs(l);
  if (L >= L2) return RZ + (L - L2);
  const f = (L / L2) * TABLE,
    i = Math.floor(f);
  return table[i] + (table[i + 1] - table[i]) * (f - i);
}
/** Inverse for r ≥ radiusAt(A). Returns the ℓ ≥ A with radiusAt(ℓ) = r. */
export function ellAt(r: number) {
  if (r >= RZ) return L2 + (r - RZ);
  let lo = A,
    hi = L2;
  for (let i = 0; i < 40; i++) {
    const m = (lo + hi) / 2;
    if (radiusAt(m) < r) lo = m;
    else hi = m;
  }
  return (lo + hi) / 2;
}

export type Side = "solar" | "gargantua";
export const other = (s: Side): Side => (s === "solar" ? "gargantua" : "solar");

/** Point in the wormhole region: side, proper radial coordinate ℓ ≥ 0, and direction n from the mouth. */
export type ZonePoint = { side: Side; l: number; n: THREE.Vector3 };

export class Bridge {
  mouths: Record<Side, THREE.Vector3> = {
    solar: new THREE.Vector3(),
    gargantua: new THREE.Vector3(),
  };
  /** Reflection pairing directions on the two sides (symmetric, M = M⁻¹). */
  mirror = new THREE.Matrix3();
  setMirror(fromSolar: THREE.Vector3, toGargantua: THREE.Vector3) {
    // Householder reflection that sends one mouth's approach direction to the
    // other's exit direction: enter facing Saturn's side, emerge facing Gargantua.
    // Horizontal pairing keeps "up" up on both sides, so the horizon stays level.
    const a = fromSolar.clone().setY(0).normalize(),
      b = toGargantua.clone().setY(0).normalize();
    const w = a.sub(b);
    if (w.lengthSq() < 1e-8) w.set(0, 0, 1);
    w.normalize();
    const e = w.toArray();
    const m: number[] = [];
    for (let r = 0; r < 3; r++)
      for (let c = 0; c < 3; c++) m.push((r === c ? 1 : 0) - 2 * e[r] * e[c]);
    this.mirror.set(m[0], m[1], m[2], m[3], m[4], m[5], m[6], m[7], m[8]);
  }
  /** Proper rotation carrying vectors across the throat at direction n. */
  crossing(n: THREE.Vector3) {
    const h = new THREE.Matrix3();
    const e = n.toArray(),
      m: number[] = [];
    for (let r = 0; r < 3; r++)
      for (let c = 0; c < 3; c++) m.push((r === c ? 1 : 0) - 2 * e[r] * e[c]);
    h.set(m[0], m[1], m[2], m[3], m[4], m[5], m[6], m[7], m[8]);
    return this.mirror.clone().multiply(h);
  }
  crossingQuaternion(n: THREE.Vector3) {
    const m3 = this.crossing(n);
    const m4 = new THREE.Matrix4().setFromMatrix3(m3);
    return new THREE.Quaternion().setFromRotationMatrix(m4);
  }
  /** Euclidean position of a zone point on its own side. */
  position(p: ZonePoint, out = new THREE.Vector3()) {
    return out.copy(p.n).multiplyScalar(radiusAt(p.l)).add(this.mouths[p.side]);
  }
  /** Convert a Euclidean point to zone coordinates if it lies within the lens region. */
  toZone(side: Side, pos: THREE.Vector3): ZonePoint | null {
    const rel = pos.clone().sub(this.mouths[side]);
    const s = rel.length();
    if (s >= RZ) return null;
    return {
      side,
      l: ellAt(Math.max(s, radiusAt(A) + 1e-4)),
      n: s > 1e-6 ? rel.divideScalar(s) : new THREE.Vector3(0, 0, 1),
    };
  }
  /**
   * Move a zone point by a displacement expressed in its side's frame.
   * `carry` vectors/quaternions are rotated into the new frame if the throat is crossed.
   * Returns true when a crossing happened.
   */
  displace(
    p: ZonePoint,
    d: THREE.Vector3,
    carry: { vectors?: THREE.Vector3[]; quats?: THREE.Quaternion[] } = {},
  ) {
    const radial = d.dot(p.n);
    const tangent = d.clone().addScaledVector(p.n, -radial);
    const lNext = p.l + radial;
    const rMid = radiusAt((p.l + Math.max(lNext, 0)) / 2);
    const tl = tangent.length();
    if (tl > 1e-9) {
      const axis = p.n.clone().cross(tangent).normalize();
      p.n.applyAxisAngle(axis, tl / rMid).normalize();
    }
    if (lNext >= 0) {
      p.l = lNext;
      return false;
    }
    const m = this.crossing(p.n);
    const q = this.crossingQuaternion(p.n);
    for (const v of carry.vectors ?? []) v.applyMatrix3(m);
    for (const quat of carry.quats ?? []) quat.premultiply(q);
    p.n.applyMatrix3(this.mirror).normalize();
    p.l = -lNext;
    p.side = other(p.side);
    return true;
  }
}
