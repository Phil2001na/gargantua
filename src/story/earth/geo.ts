import * as THREE from "three";

/**
 * Where the farm is on the real Earth, and how the local map (true-scale metres, +x east,
 * +y up, +z south, origin at the farmhouse) wraps onto the globe.
 *
 * The local map is drawn as if the planet's top were always directly under the camera:
 * the ground falls away as d²/2R from the viewer (`curveDrop`). So the globe is also
 * centred straight below the camera, and the camera's horizontal offset from the farm is
 * treated as a distance travelled over the surface (an arc). This keeps close things
 * exact and lets a rocket fly thousands of kilometres downrange without float trouble.
 */
export const EARTH_R = 6371000;
/** The top of the atmosphere used for scattering. */
export const ATMOSPHERE = 100000;
/** South-central Nebraska, just north of the Kansas line. */
export const FARM_LAT = 40.0;
export const FARM_LON = -99.555;

const deg = Math.PI / 180;

/** Farm-frame axes (east, up, south) expressed in Earth-centred, Earth-fixed coordinates. */
export function farmBasis() {
  const la = FARM_LAT * deg,
    lo = FARM_LON * deg;
  const up = new THREE.Vector3(Math.cos(la) * Math.cos(lo), Math.cos(la) * Math.sin(lo), Math.sin(la));
  const east = new THREE.Vector3(-Math.sin(lo), Math.cos(lo), 0);
  const north = new THREE.Vector3().crossVectors(up, east);
  // Columns: where local x, y, z point in ECEF.
  return new THREE.Matrix3().set(east.x, up.x, -north.x, east.y, up.y, -north.y, east.z, up.z, -north.z);
}
const FARM = farmBasis();

/**
 * The rotation from the frame under the camera (up = +y) to the farm frame. The camera
 * has travelled (x, z) metres over the surface from the farm.
 */
export function arcRotation(x: number, z: number, out = new THREE.Matrix3()) {
  const d = Math.hypot(x, z);
  if (d < 1e-3) return out.identity();
  const angle = d / EARTH_R;
  // Tilt the up axis toward the direction travelled.
  const axis = new THREE.Vector3(z / d, 0, -x / d);
  const m = new THREE.Matrix4().makeRotationAxis(axis, angle);
  return out.setFromMatrix4(m);
}

/** Camera-frame directions to ECEF: farm basis × arc rotation. */
export function toEcef(x: number, z: number, out = new THREE.Matrix3()) {
  return out.multiplyMatrices(FARM, arcRotation(x, z));
}

/** Latitude and longitude (degrees) of a point on the local map. */
export function latLon(x: number, z: number) {
  const n = new THREE.Vector3(0, 1, 0).applyMatrix3(toEcef(x, z));
  return { lat: Math.asin(n.z) / deg, lon: Math.atan2(n.y, n.x) / deg };
}

/** How far the surface at (x, z) sits below the camera's tangent plane. */
export function dropFrom(camX: number, camZ: number, x: number, z: number) {
  const dx = x - camX,
    dz = z - camZ;
  return (dx * dx + dz * dz) / (2 * EARTH_R);
}
