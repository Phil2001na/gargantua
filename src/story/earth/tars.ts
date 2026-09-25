import * as THREE from "three";
import { canvasTexture } from "./textures";

/**
 * TARS: four brushed-metal slabs hinged near the top. It walks by swinging the outer
 * pair forward while the inner pair takes the weight, then the other way round.
 * An original take on the idea, not a replica.
 */
export class Tars {
  readonly root = new THREE.Group();
  private slabs: THREE.Group[] = [];
  private screen: THREE.MeshStandardMaterial;
  private phase = 0;
  /** Metres per second it's moving (drives the gait). */
  speed = 0;
  static readonly HEIGHT = 1.55;
  constructor() {
    const brushed = canvasTexture(
      128,
      (g, r) => {
        g.fillStyle = "#6c6f73";
        g.fillRect(0, 0, 128, 128);
        for (let i = 0; i < 400; i++) {
          g.fillStyle = `rgba(${r() < 0.5 ? "255,255,255" : "0,0,0"},${r() * 0.08})`;
          g.fillRect(0, r() * 128, 128, 1);
        }
        g.strokeStyle = "rgba(20,20,22,.6)";
        g.strokeRect(2, 2, 124, 124);
      },
      91,
    );
    const metal = new THREE.MeshStandardMaterial({ map: brushed, metalness: 0.75, roughness: 0.38 });
    const joint = new THREE.MeshStandardMaterial({ color: 0x1b1c1e, metalness: 0.6, roughness: 0.5 });
    this.screen = new THREE.MeshStandardMaterial({
      color: 0x050807,
      emissive: 0xffffff,
      emissiveMap: canvasTexture(
        64,
        (g, r) => {
          g.fillStyle = "#000";
          g.fillRect(0, 0, 64, 64);
          g.fillStyle = "#b8f5c8";
          for (let y = 6; y < 58; y += 7) g.fillRect(4, y, 10 + r() * 46, 2);
        },
        4,
      ),
      emissiveIntensity: 0.5,
    });
    const H = Tars.HEIGHT,
      w = 0.2,
      d = 0.26,
      hinge = H - 0.28;
    for (let i = 0; i < 4; i++) {
      const pivot = new THREE.Group();
      pivot.position.set((i - 1.5) * (w + 0.012), hinge, 0);
      const slab = new THREE.Mesh(new THREE.BoxGeometry(w, H, d), metal);
      slab.position.y = H / 2 - hinge;
      slab.castShadow = slab.receiveShadow = true;
      pivot.add(slab);
      const pin = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, w + 0.01, 10).rotateZ(Math.PI / 2), joint);
      pivot.add(pin);
      if (i === 1) {
        const s = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 0.2), this.screen);
        s.position.set(0.1, H - hinge - 0.42, d / 2 + 0.002);
        pivot.add(s);
      }
      this.slabs.push(pivot);
      this.root.add(pivot);
    }
  }
  /** `talk` 0..1 brightens the display while it speaks. */
  update(dt: number, talk = 0) {
    this.phase += dt * this.speed * 4.2;
    const a = Math.sin(this.phase) * Math.min(1, this.speed / 0.8) * 0.42;
    // Outer slabs swing one way, inner the other; the whole body rocks a little.
    this.slabs[0].rotation.x = this.slabs[3].rotation.x = a;
    this.slabs[1].rotation.x = this.slabs[2].rotation.x = -a * 0.6;
    this.root.children.forEach((c) => (c.position.y = Tars.HEIGHT - 0.28 - Math.abs(Math.sin(this.phase)) * 0.05 * Math.min(1, this.speed)));
    this.screen.emissiveIntensity = 0.35 + talk * (0.4 + 0.3 * Math.sin(performance.now() / 70));
  }
}
