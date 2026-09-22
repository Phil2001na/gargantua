import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

/**
 * A procedural, original model inspired by the Endurance: twelve modules on a
 * rotating ring, four spokes, a central docking hub, a docked Ranger at the bow
 * and two landers at the stern. Built in "ring units" (ring radius = 1) and
 * scaled by the caller. Forward is −Z; the ring spins about Z.
 */
function panelTexture(base: string, line: string, seed: number) {
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const g = c.getContext("2d")!;
  g.fillStyle = base;
  g.fillRect(0, 0, 256, 256);
  let s = seed;
  const rand = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  for (let i = 0; i < 70; i++) {
    const w = 16 + rand() * 70,
      h = 10 + rand() * 50,
      x = rand() * 256,
      y = rand() * 256,
      shade = 0.86 + rand() * 0.2;
    g.fillStyle = `rgba(${shade > 1 ? 255 : 0},${shade > 1 ? 255 : 0},${shade > 1 ? 255 : 0},${Math.abs(shade - 1) * 0.5})`;
    g.fillRect(x, y, w, h);
  }
  g.strokeStyle = line;
  g.lineWidth = 1.2;
  for (let i = 0; i <= 256; i += 32) {
    g.beginPath();
    g.moveTo(i, 0);
    g.lineTo(i, 256);
    g.stroke();
    g.beginPath();
    g.moveTo(0, i + 0.5);
    g.lineTo(256, i + 0.5);
    g.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}
/**
 * Bake every mesh under `root` into one mesh per material. The model is ~100
 * small parts; as separate draw calls it cost as much as the whole planet scene.
 */
function mergeByMaterial(root: THREE.Object3D, skip?: THREE.Object3D) {
  root.updateMatrixWorld(true);
  const inverse = root.matrixWorld.clone().invert();
  const buckets = new Map<THREE.Material, THREE.BufferGeometry[]>();
  const meshes: THREE.Mesh[] = [];
  const walk = (o: THREE.Object3D) => {
    if (o === skip) return;
    for (const child of o.children) walk(child);
    if (!(o instanceof THREE.Mesh)) return;
    meshes.push(o);
    const g = (o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone()).applyMatrix4(
      inverse.clone().multiply(o.matrixWorld),
    );
    g.clearGroups();
    for (const name of Object.keys(g.attributes)) if (!["position", "normal", "uv"].includes(name)) g.deleteAttribute(name);
    const m = o.material as THREE.Material;
    if (!buckets.has(m)) buckets.set(m, []);
    buckets.get(m)!.push(g);
  };
  walk(root);
  for (const o of meshes) o.removeFromParent();
  // Drop the now-empty helper groups.
  for (const child of [...root.children])
    if (child !== skip && child.type === "Group" && child.children.length === 0) child.removeFromParent();
  for (const [material, list] of buckets) root.add(new THREE.Mesh(mergeGeometries(list), material));
}
function glowTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const g = c.getContext("2d")!,
    grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, "rgba(255,255,255,1)");
  grad.addColorStop(0.25, "rgba(170,210,255,.55)");
  grad.addColorStop(1, "rgba(60,120,255,0)");
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

export class Endurance {
  group = new THREE.Group();
  private ring = new THREE.Group();
  private thrusters: THREE.Sprite[] = [];
  private rcs: THREE.Sprite[] = [];
  constructor() {
    const hull = new THREE.MeshStandardMaterial({
      map: panelTexture("#c9ccd0", "rgba(30,34,40,.45)", 11),
      roughness: 0.62,
      metalness: 0.25,
    });
    const hullDark = new THREE.MeshStandardMaterial({
      map: panelTexture("#8a8f96", "rgba(10,12,16,.5)", 29),
      roughness: 0.7,
      metalness: 0.3,
    });
    const foil = new THREE.MeshStandardMaterial({
      color: 0x9c7d45,
      roughness: 0.5,
      metalness: 0.7,
    });
    const black = new THREE.MeshStandardMaterial({
      color: 0x1b1e22,
      roughness: 0.5,
      metalness: 0.4,
    });
    const radiator = new THREE.MeshStandardMaterial({
      color: 0xe8eaec,
      roughness: 0.35,
      metalness: 0.1,
      side: THREE.DoubleSide,
    });
    const windowMat = new THREE.MeshStandardMaterial({
      color: 0x111418,
      emissive: new THREE.Color(1, 0.82, 0.55),
      emissiveIntensity: 0.9,
    });
    const box = (w: number, h: number, d: number, m: THREE.Material) =>
      new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
    const cyl = (r: number, len: number, m: THREE.Material, seg = 16) =>
      new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, seg), m);

    // Ring: 12 modules joined by pressurised tunnels.
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      const mod = new THREE.Group();
      mod.position.set(Math.cos(a), Math.sin(a), 0);
      mod.rotation.z = a;
      const kind = i % 3;
      const body = box(0.2, 0.34, 0.26, kind === 1 ? hullDark : hull);
      mod.add(body);
      // End caps and trim give each module a machined silhouette.
      const cap = box(0.21, 0.08, 0.27, black);
      cap.position.y = 0.15;
      mod.add(cap);
      if (kind === 0) {
        const fin = box(0.004, 0.24, 0.34, radiator);
        fin.position.set(0.105, 0, 0.02);
        mod.add(fin);
        const fin2 = fin.clone();
        fin2.position.x = -0.105;
        mod.add(fin2);
      }
      if (kind === 1) {
        for (const y of [-0.08, 0, 0.08]) {
          const w = box(0.205, 0.018, 0.05, windowMat);
          w.position.set(0, y, -0.1);
          mod.add(w);
        }
      }
      if (kind === 2) {
        const wrap = box(0.205, 0.12, 0.265, foil);
        wrap.position.y = -0.08;
        mod.add(wrap);
        const tank = cyl(0.045, 0.24, hull);
        tank.rotation.x = Math.PI / 2;
        tank.position.set(0, 0.02, 0.2);
        mod.add(tank);
      }
      this.ring.add(mod);
      // Tunnel to the next module.
      const b = a + Math.PI / 12;
      const tunnel = cyl(0.045, 0.34, black, 10);
      tunnel.position.set(Math.cos(b) * 0.985, Math.sin(b) * 0.985, 0);
      tunnel.rotation.z = b;
      this.ring.add(tunnel);
      const collar = cyl(0.06, 0.03, hullDark, 10);
      collar.position.copy(tunnel.position);
      collar.rotation.z = b;
      this.ring.add(collar);
    }
    // Four spokes.
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + Math.PI / 12;
      const spoke = cyl(0.022, 0.78, hullDark, 8);
      spoke.position.set(Math.cos(a) * 0.53, Math.sin(a) * 0.53, 0);
      spoke.rotation.z = a - Math.PI / 2;
      this.ring.add(spoke);
    }
    // Central hub with docking collars.
    const hub = cyl(0.14, 0.62, hull, 24);
    hub.rotation.x = Math.PI / 2;
    this.ring.add(hub);
    const hubBand = cyl(0.152, 0.1, foil, 24);
    hubBand.rotation.x = Math.PI / 2;
    this.ring.add(hubBand);
    this.group.add(this.ring);

    // Docked Ranger at the bow (does not spin).
    const ranger = new THREE.Group();
    const rangerShape = new THREE.Shape();
    rangerShape.moveTo(0, -0.26);
    rangerShape.lineTo(0.13, 0.16);
    rangerShape.lineTo(0.1, 0.22);
    rangerShape.lineTo(-0.1, 0.22);
    rangerShape.lineTo(-0.13, 0.16);
    rangerShape.closePath();
    const rangerGeo = new THREE.ExtrudeGeometry(rangerShape, {
      depth: 0.05,
      bevelEnabled: true,
      bevelSize: 0.012,
      bevelThickness: 0.012,
      bevelSegments: 2,
    });
    const rangerBody = new THREE.Mesh(rangerGeo, hull);
    // Shape y → z, so the nose at y = −0.26 points forward; extrusion → −y, so lift by half.
    rangerBody.rotation.x = Math.PI / 2;
    rangerBody.position.y = 0.025;
    ranger.add(rangerBody);
    const cockpit = box(0.09, 0.03, 0.1, windowMat);
    cockpit.position.set(0, 0.035, -0.12);
    ranger.add(cockpit);
    ranger.position.set(0, 0, -0.62);
    this.group.add(ranger);
    const bowCollar = cyl(0.09, 0.08, black, 16);
    bowCollar.rotation.x = Math.PI / 2;
    bowCollar.position.z = -0.35;
    this.group.add(bowCollar);
    // Landers at the stern.
    for (const x of [-0.11, 0.11]) {
      const lander = box(0.14, 0.09, 0.26, hullDark);
      lander.position.set(x, 0, 0.46);
      this.group.add(lander);
      const legs = box(0.16, 0.012, 0.2, black);
      legs.position.set(x, -0.05, 0.46);
      this.group.add(legs);
    }
    const sternCollar = cyl(0.1, 0.08, black, 16);
    sternCollar.rotation.x = Math.PI / 2;
    sternCollar.position.z = 0.34;
    this.group.add(sternCollar);

    mergeByMaterial(this.ring);
    mergeByMaterial(this.group, this.ring);

    // Main drive glow on the stern and RCS puffs around the ring.
    const glow = glowTexture();
    const makeSprite = (scale: number) => {
      const s = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: glow,
          color: new THREE.Color(2.2, 2.6, 4),
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          transparent: true,
          opacity: 0,
        }),
      );
      s.scale.setScalar(scale);
      return s;
    };
    for (const x of [-0.11, 0.11]) {
      const s = makeSprite(0.28);
      s.position.set(x, 0, 0.64);
      this.thrusters.push(s);
      this.group.add(s);
    }
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2;
      const s = makeSprite(0.12);
      s.position.set(Math.cos(a) * 1.02, Math.sin(a) * 1.02, 0.16);
      this.rcs.push(s);
      this.group.add(s);
    }
  }
  /** thrust: −1..1 main drive, turn: 0..1 attitude activity */
  update(dt: number, thrust: number, turn: number, time: number) {
    // The ring turns slowly to generate artificial gravity.
    this.ring.rotation.z += dt * 0.35;
    const flicker = 0.85 + 0.15 * Math.sin(time * 53) * Math.sin(time * 31);
    for (const s of this.thrusters) {
      const m = s.material as THREE.SpriteMaterial;
      m.opacity = THREE.MathUtils.damp(m.opacity, Math.max(0, thrust) * flicker, 10, dt);
      s.scale.setScalar(0.18 + 0.22 * m.opacity);
    }
    for (const s of this.rcs) {
      const m = s.material as THREE.SpriteMaterial;
      m.opacity = THREE.MathUtils.damp(m.opacity, (turn + Math.max(0, -thrust)) * 0.7 * flicker, 14, dt);
    }
  }
}
