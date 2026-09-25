import * as THREE from "three";

/** Stylised, faceless figures: readable silhouettes rather than likenesses. */
export type PersonStyle = {
  height: number;
  shirt: number;
  pants: number;
  skin: number;
  hair: number;
  longHair?: boolean;
  cap?: number;
  build?: number;
};
export type Person = {
  root: THREE.Group;
  head: THREE.Object3D;
  torso: THREE.Object3D;
  armL: THREE.Object3D;
  armR: THREE.Object3D;
  legL: THREE.Object3D;
  legR: THREE.Object3D;
  seated: boolean;
};

const mats = new Map<number, THREE.MeshStandardMaterial>();
const mat = (c: number) => {
  let m = mats.get(c);
  if (!m) mats.set(c, (m = new THREE.MeshStandardMaterial({ color: c, roughness: 0.9 })));
  return m;
};
function limb(r: number, len: number, colour: number) {
  // Pivot at the top so the limb can swing.
  const pivot = new THREE.Group();
  const m = new THREE.Mesh(new THREE.CapsuleGeometry(r, Math.max(0.01, len - 2 * r), 3, 8), mat(colour));
  m.position.y = -len / 2;
  m.castShadow = true;
  pivot.add(m);
  return pivot;
}

export function person(s: PersonStyle, seated = false): Person {
  const k = s.height / 1.8,
    b = s.build ?? 1;
  const root = new THREE.Group();
  const leg = 0.88 * k,
    hipY = seated ? 0.45 * k : leg;
  const torso = new THREE.Group();
  torso.position.y = hipY;
  root.add(torso);
  const chest = new THREE.Mesh(new THREE.CapsuleGeometry(0.16 * k * b, 0.34 * k, 4, 10), mat(s.shirt));
  chest.position.y = 0.3 * k;
  chest.scale.z = 0.72;
  chest.castShadow = true;
  const pelvis = new THREE.Mesh(new THREE.CapsuleGeometry(0.15 * k * b, 0.05, 3, 10), mat(s.pants));
  pelvis.position.y = 0.04 * k;
  pelvis.scale.z = 0.75;
  torso.add(chest, pelvis);
  const head = new THREE.Group();
  head.position.y = 0.66 * k;
  torso.add(head);
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.045 * k, 0.05 * k, 0.1 * k, 8), mat(s.skin));
  neck.position.y = -0.04 * k;
  const skull = new THREE.Mesh(new THREE.SphereGeometry(0.105 * k, 16, 12), mat(s.skin));
  skull.position.y = 0.1 * k;
  skull.scale.set(0.9, 1.08, 1);
  const hair = new THREE.Mesh(new THREE.SphereGeometry(0.112 * k, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.55), mat(s.hair));
  hair.position.set(0, 0.115 * k, -0.012 * k);
  hair.rotation.x = -0.25;
  head.add(neck, skull, hair);
  if (s.longHair) {
    const tail = new THREE.Mesh(new THREE.CapsuleGeometry(0.075 * k, 0.16 * k, 3, 8), mat(s.hair));
    tail.position.set(0, -0.02 * k, -0.07 * k);
    tail.scale.x = 1.4;
    head.add(tail);
  }
  if (s.cap !== undefined) {
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.115 * k, 16, 8, 0, Math.PI * 2, 0, Math.PI * 0.5), mat(s.cap));
    cap.position.y = 0.13 * k;
    const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.09 * k, 0.09 * k, 0.012, 12, 1, false, -Math.PI / 2, Math.PI), mat(s.cap));
    brim.position.set(0, 0.14 * k, 0.07 * k);
    brim.rotation.x = 0.12;
    head.add(cap, brim);
  }
  const armL = limb(0.05 * k, 0.62 * k, s.shirt),
    armR = limb(0.05 * k, 0.62 * k, s.shirt);
  armL.position.set(0.21 * k * b, 0.5 * k, 0);
  armR.position.set(-0.21 * k * b, 0.5 * k, 0);
  armL.rotation.z = 0.08;
  armR.rotation.z = -0.08;
  for (const arm of [armL, armR]) {
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.045 * k, 8, 6), mat(s.skin));
    hand.position.y = -0.64 * k;
    arm.add(hand);
  }
  torso.add(armL, armR);
  const legL = limb(0.075 * k, leg, s.pants),
    legR = limb(0.075 * k, leg, s.pants);
  legL.position.set(0.09 * k, hipY, 0);
  legR.position.set(-0.09 * k, hipY, 0);
  root.add(legL, legR);
  if (seated) {
    // Thighs forward along +z; the knee bend is faked by a second shin segment.
    for (const l of [legL, legR]) {
      l.rotation.x = -Math.PI / 2;
      const shin = limb(0.07 * k, 0.48 * k, s.pants);
      shin.position.y = -0.45 * k;
      shin.rotation.x = Math.PI / 2;
      l.children[0].scale.y = 0.5;
      l.children[0].position.y = -0.22 * k;
      l.add(shin);
    }
    armL.rotation.x = armR.rotation.x = -0.9;
  }
  return { root, head, torso, armL, armR, legL, legR, seated };
}

/** Idle life: breathing, small head turns, optional look target (world space). */
export function animatePerson(p: Person, t: number, seed: number, look?: THREE.Vector3) {
  p.torso.scale.y = 1 + Math.sin(t * 1.6 + seed) * 0.008;
  const want = new THREE.Euler(Math.sin(t * 0.3 + seed) * 0.05, Math.sin(t * 0.21 + seed * 3) * 0.25, 0);
  if (look) {
    const local = p.head.parent!.worldToLocal(look.clone()).sub(p.head.position);
    want.y = THREE.MathUtils.clamp(Math.atan2(local.x, local.z), -1.2, 1.2);
    want.x = THREE.MathUtils.clamp(-Math.atan2(local.y, Math.hypot(local.x, local.z)), -0.8, 0.5);
  }
  p.head.rotation.x += (want.x - p.head.rotation.x) * 0.06;
  p.head.rotation.y += (want.y - p.head.rotation.y) * 0.06;
}

export const CAST = {
  cooper: { height: 1.86, shirt: 0x5b6f86, pants: 0x3a4250, skin: 0xc49a7c, hair: 0x4a3a2c },
  tom: { height: 1.7, shirt: 0x8a5a3c, pants: 0x444a52, skin: 0xd6ab8c, hair: 0x6a4c30, build: 0.92 },
  murph: { height: 1.38, shirt: 0x9a8f6a, pants: 0x4c5a6e, skin: 0xd8b094, hair: 0x5a3a24, longHair: true, build: 0.85 },
  donald: { height: 1.78, shirt: 0x7d7a70, pants: 0x3b3a36, skin: 0xc7a086, hair: 0xb8b4ac, cap: 0x4f5a3f },
  professor: { height: 1.76, shirt: 0x55585e, pants: 0x3c3e44, skin: 0xd0a88e, hair: 0xd8d6d0, build: 1.05 },
  doyle: { height: 1.8, shirt: 0x9a9c98, pants: 0x8a8c88, skin: 0xc9a488, hair: 0x3a2c22 },
  romilly: { height: 1.75, shirt: 0x9a9c98, pants: 0x8a8c88, skin: 0x8a6448, hair: 0x1c1814 },
  romillyOld: { height: 1.74, shirt: 0x6f7270, pants: 0x55585a, skin: 0x8a6448, hair: 0xb8b6b0 },
  amelia: { height: 1.68, shirt: 0x2f3a4c, pants: 0x2a2f38, skin: 0xe0b89c, hair: 0x6a4a30, longHair: true, build: 0.88 },
} satisfies Record<string, PersonStyle>;
