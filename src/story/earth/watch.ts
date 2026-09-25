import * as THREE from "three";
import { canvasTexture } from "./textures";

/**
 * A plain steel wristwatch, lying face up: 38 mm case, cream dial, three hands and a
 * leather strap. Cooper keeps one and gives Murph the other; in the tesseract it is the
 * watch whose second hand he nudges. Local frame: dial faces +y, twelve o'clock is -z.
 */
const dial = () =>
  canvasTexture(256, (c) => {
    const s = 256,
      r = s / 2;
    c.fillStyle = "#ece4d2";
    c.fillRect(0, 0, s, s);
    c.translate(r, r);
    c.strokeStyle = "#2a2622";
    for (let i = 0; i < 60; i++) {
      const big = i % 5 === 0;
      c.lineWidth = big ? 5 : 1.6;
      c.beginPath();
      const a = (i / 60) * Math.PI * 2;
      c.moveTo(Math.sin(a) * (r - 8), -Math.cos(a) * (r - 8));
      c.lineTo(Math.sin(a) * (r - (big ? 30 : 16)), -Math.cos(a) * (r - (big ? 30 : 16)));
      c.stroke();
    }
    c.fillStyle = "#2a2622";
    c.font = "600 34px Georgia, serif";
    c.textAlign = "center";
    c.textBaseline = "middle";
    for (const [n, a] of [
      ["12", 0],
      ["3", 0.25],
      ["6", 0.5],
      ["9", 0.75],
    ] as [string, number][])
      c.fillText(n, Math.sin(a * Math.PI * 2) * (r - 56), -Math.cos(a * Math.PI * 2) * (r - 56));
  });

export class Watch {
  readonly group = new THREE.Group();
  private hour = new THREE.Group();
  private minute = new THREE.Group();
  private second = new THREE.Group();
  /** Seconds past midnight shown on the dial. */
  time = 0;
  constructor(strapColour = 0x5a3a22) {
    const steel = new THREE.MeshStandardMaterial({ color: 0xc8c8c4, metalness: 0.9, roughness: 0.28 });
    const ink = new THREE.MeshStandardMaterial({ color: 0x1c1a18, metalness: 0.3, roughness: 0.4 });
    const leather = new THREE.MeshStandardMaterial({ color: strapColour, roughness: 0.75 });
    const R = 0.019;
    const g = this.group;
    const caseMesh = new THREE.Mesh(new THREE.CylinderGeometry(R, R * 1.02, 0.008, 40), steel);
    caseMesh.position.y = 0.004;
    const bezel = new THREE.Mesh(new THREE.TorusGeometry(R * 0.93, 0.0016, 8, 40).rotateX(Math.PI / 2), steel);
    bezel.position.y = 0.0082;
    const face = new THREE.Mesh(
      new THREE.CircleGeometry(R * 0.9, 40).rotateX(-Math.PI / 2),
      new THREE.MeshStandardMaterial({ map: dial(), roughness: 0.5 }),
    );
    face.position.y = 0.0081;
    // A faint crystal over the dial.
    const crystal = new THREE.Mesh(
      new THREE.CircleGeometry(R * 0.9, 40).rotateX(-Math.PI / 2),
      new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.02, metalness: 0, transparent: true, opacity: 0.08 }),
    );
    crystal.position.y = 0.0098;
    const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.0025, 0.0025, 0.004, 12).rotateZ(Math.PI / 2), steel);
    crown.position.set(R + 0.002, 0.004, 0);
    g.add(caseMesh, bezel, face, crystal, crown);
    // Hands: a pivot each, the blade pointing to twelve (-z) before rotation.
    const hand = (pivot: THREE.Group, len: number, w: number, m: THREE.Material, y: number, tail = 0) => {
      const blade = new THREE.Mesh(new THREE.BoxGeometry(w, 0.0006, len + tail), m);
      blade.position.z = -(len - tail) / 2;
      pivot.add(blade);
      pivot.position.y = y;
      g.add(pivot);
    };
    hand(this.hour, R * 0.5, 0.0016, ink, 0.0085);
    hand(this.minute, R * 0.78, 0.0011, ink, 0.0089);
    hand(this.second, R * 0.84, 0.0004, new THREE.MeshStandardMaterial({ color: 0x9a2a1e, roughness: 0.4 }), 0.0093, R * 0.2);
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.0012, 0.0012, 0.0012, 10), ink);
    cap.position.y = 0.0095;
    g.add(cap);
    // Strap, lying open to either side of the case (toward twelve and six).
    for (const s of [-1, 1]) {
      const band = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.003, 0.085), leather);
      band.position.set(0, 0.0015, s * (R + 0.04));
      g.add(band);
      const lug = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.005, 0.006), steel);
      lug.position.set(0, 0.0035, s * (R + 0.002));
      g.add(lug);
    }
    const buckle = new THREE.Mesh(new THREE.TorusGeometry(0.009, 0.0012, 6, 16).rotateX(Math.PI / 2), steel);
    buckle.scale.set(1.1, 1, 0.7);
    buckle.position.set(0, 0.0032, R + 0.08);
    g.add(buckle);
    g.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) o.castShadow = o.receiveShadow = true;
    });
    this.set(0);
  }
  /** Show a time of day in seconds. The second hand ticks; the others sweep. */
  set(seconds: number) {
    this.time = seconds;
    const turn = (u: number) => -u * Math.PI * 2;
    this.second.rotation.y = turn(Math.floor(seconds % 60) / 60);
    this.minute.rotation.y = turn((seconds / 3600) % 1);
    this.hour.rotation.y = turn((seconds / 43200) % 1);
  }
}
