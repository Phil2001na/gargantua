import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

/**
 * Bake every static mesh under `root` into one mesh per material (world transforms applied),
 * leaving the subtrees in `keep` untouched. Cuts hundreds of draw calls to a handful.
 */
export function mergeStatic(root: THREE.Object3D, keep: THREE.Object3D[] = []) {
  root.updateMatrixWorld(true);
  const inv = root.matrixWorld.clone().invert();
  const byMat = new Map<THREE.Material, THREE.BufferGeometry[]>();
  const shadow = new Map<THREE.Material, boolean>();
  const remove: THREE.Mesh[] = [];
  const skip = new Set<THREE.Object3D>();
  for (const k of keep) k.traverse((o) => skip.add(o));
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh || skip.has(m) || (m as unknown as THREE.InstancedMesh).isInstancedMesh || Array.isArray(m.material)) return;
    const g = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone();
    for (const name of Object.keys(g.attributes)) if (!["position", "normal", "uv"].includes(name)) g.deleteAttribute(name);
    if (!g.attributes.uv) g.setAttribute("uv", new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, m.matrixWorld));
    const mat = m.material as THREE.Material;
    if (!byMat.has(mat)) byMat.set(mat, []);
    byMat.get(mat)!.push(g);
    shadow.set(mat, (shadow.get(mat) ?? false) || m.castShadow);
    remove.push(m);
  });
  for (const m of remove) m.parent!.remove(m);
  for (const [mat, geos] of byMat) {
    const merged = mergeGeometries(geos, false);
    if (!merged) continue;
    const mesh = new THREE.Mesh(merged, mat);
    mesh.castShadow = shadow.get(mat)!;
    mesh.receiveShadow = true;
    root.add(mesh);
  }
}
