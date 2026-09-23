import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import blackHoleFragment from "./shaders/blackhole.frag?raw";
import starsChunk from "./shaders/stars.glsl?raw";
import { createSky, skyUniforms } from "./sky";
import { Ambience } from "./audio";
import { Atlas } from "./atlas";
import "./style.css";

const icons = {
  settings:
    '<path d="M4 7h16M4 17h16"/><circle cx="9" cy="7" r="3" fill="#0c1017"/><circle cx="15" cy="17" r="3" fill="#0c1017"/>',
  fullscreen: '<path d="M9 4H4v5m11-5h5v5M4 15v5h5m11-5v5h-5"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9.7 9a2.3 2.3 0 014.6 0c0 2-2.3 2-2.3 4m0 3v.1"/>',
  eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>',
  reset: '<path d="M4 10a8 8 0 111 8M4 4v6h6"/>',
  pause: '<path d="M9 5v14M15 5v14"/>',
  play: '<path d="m9 5 10 7-10 7Z"/>',
  camera: '<path d="M4 7h4l2-3h4l2 3h4v13H4Z"/><circle cx="12" cy="13" r="4"/>',
  close: '<path d="m6 6 12 12M18 6 6 18"/>',
};
const svg = (name: keyof typeof icons) =>
  `<svg viewBox="0 0 24 24" aria-hidden="true">${icons[name]}</svg>`;
document.querySelector<HTMLDivElement>("#app")!.innerHTML = `
 <canvas id="universe" aria-label="Interactive black hole simulation. Drag to look around. Controls are available in the guide." tabindex="0"></canvas>
 <div class="hud">
   <header class="top"><div class="brand"><svg class="mark" viewBox="0 0 40 40" fill="none" aria-hidden="true"><circle cx="20" cy="20" r="12" stroke="#dec49a" stroke-width="1"/><ellipse cx="20" cy="22" rx="19" ry="4" stroke="#dec49a" stroke-width="1" transform="rotate(-15 20 22)"/></svg><div><div class="brand-name">GARGANTUA</div><div class="micro">A journey beyond the familiar</div></div></div>
   <nav class="top-tools" aria-label="Experience tools"><button class="icon-btn" id="audio" aria-label="Enable ambient sound" aria-pressed="false" title="Ambient sound (M)"><span class="audio-lines"><i></i><i></i><i></i><i></i></span></button><button class="icon-btn" id="capture" aria-label="Save image" title="Save image">${svg("camera")}</button><button class="icon-btn" id="settings" aria-label="Scene settings" aria-expanded="false" title="Scene settings">${svg("settings")}</button><button class="icon-btn" id="help" aria-label="Controls and science" title="Controls and science (?)">${svg("help")}</button><button class="icon-btn" id="hide" aria-label="Hide interface" title="Hide interface (H)">${svg("eye")}</button><button class="icon-btn fullscreen-button" id="fullscreen" aria-label="Enter fullscreen" title="Fullscreen (F)">${svg("fullscreen")}</button></nav></header>
   <section class="intro"><div class="eyebrow">Deep space · Uncharted sector</div><h1>Nothing escapes.<br><em>Except wonder.</em></h1><p>A hundred million suns.<br>A silence beyond imagination.<br>Take a journey to the edge of the impossible.</p><button class="begin" id="begin">Begin approach <span>↗</span></button><div class="footnote">Interactive experience · Headphones recommended</div></section>
   <aside class="location"><div class="micro">Gravitational anomaly</div><strong>Gargantua</strong><div class="leader"></div><small>100,000,000 solar masses</small></aside>
   <div class="chapter" id="chapter" aria-live="polite"><div class="micro" id="chapter-label"></div><p id="chapter-text"></p></div>
   <aside class="panel" id="panel" aria-label="Scene settings" hidden><div class="panel-header"><h2>Observation deck</h2><button class="icon-btn" id="close-settings" aria-label="Close settings">${svg("close")}</button></div><p>Make the universe your own.</p>
   <div class="control"><label for="exposure">Exposure <output id="exposure-value">1.0</output></label><input id="exposure" type="range" min=".3" max="2.5" step=".05" value="1"/></div>
   <div class="control"><label for="disk">Accretion glow <output id="disk-value">1.0</output></label><input id="disk" type="range" min="0" max="2" step=".05" value="1"/></div>
   <div class="control"><label for="dust">Disk atmosphere <output id="dust-value">1.0</output></label><input id="dust" type="range" min="0" max="3" step=".1" value="1"/></div>
   <div class="control"><label for="speed">Time speed <output id="speed-value">1×</output></label><input id="speed" type="range" min="0" max="5" step=".1" value="1"/></div>
   <div class="control"><label for="fov">Field of view <output id="fov-value">48°</output></label><input id="fov" type="range" min="30" max="90" step="1" value="48"/></div>
   <label class="check-row" for="lensing">Gravitational lensing <input id="lensing" type="checkbox" checked/></label><label class="check-row" for="doppler">Doppler brightness <input id="doppler" type="checkbox" checked/></label>
   <div class="select-row"><label for="quality">Render quality</label><select id="quality"><option value="auto">Adaptive</option><option value="low">Performance</option><option value="high">High</option><option value="ultra">Ultra</option></select></div>
   <div class="section-label">Travel to a viewpoint</div><div class="preset-row"><button data-preset="front">Disk edge</button><button data-preset="above">Above the disk</button><button data-preset="near">Photon ring</button><button data-preset="far">Deep space</button></div>
   <p class="note">Travel is accelerated. Light bending uses a Schwarzschild approximation; this is an artistic exploration, not a precision Kerr simulation.</p></aside>
   <div class="touch-controls" id="touch-controls" aria-label="Flight controls"><button data-move="w" aria-label="Fly forward">↑</button><button data-move="s" aria-label="Fly backward">↓</button><button data-move="a" aria-label="Strafe left">←</button><button data-move="d" aria-label="Strafe right">→</button><button data-move="e" aria-label="Ascend">+</button><button data-move="q" aria-label="Descend">−</button></div>
   <footer class="bottom"><div class="voyage-progress" id="progress"></div><div class="status-line"><div class="status" id="status">Systems ready · Awaiting departure</div><div class="hints" id="hints">Drag to look <span>·</span> Scroll to approach <span>·</span> <kbd>H</kbd> hide interface</div></div><div class="bottom-row"><div class="telemetry"><div class="metric"><div class="micro">Distance from centre</div><div class="metric-value"><span id="distance">—</span><small>AU</small></div></div><div class="metric"><div class="micro">Horizon radii</div><div class="metric-value"><span id="radius">—</span><small>Rѕ</small></div></div><div class="metric"><div class="micro">Distant / local clock</div><div class="metric-value"><span id="dilation">—</span><small>×</small></div></div><div class="metric mass"><div class="micro">Event horizon diameter</div><div class="metric-value">590.6<small>M km</small></div></div></div><div class="mode-switch" role="group" aria-label="Navigation mode"><button data-mode="voyage" aria-pressed="true">Voyage</button><button data-mode="flight" aria-pressed="false">Free flight</button><button data-mode="orbit" aria-pressed="false">Orbit</button></div><div class="transport"><button class="icon-btn" id="pause" aria-label="Pause simulation" title="Pause (Space)">${svg("pause")}</button><button class="icon-btn" id="reset" aria-label="Restart journey" title="Restart (R)">${svg("reset")}</button></div></div></footer>
 </div>
 <button class="return-hud" id="show">Show controls · H</button>
 <dialog class="info" id="info"><button class="icon-btn close" id="close-info" aria-label="Close guide">${svg("close")}</button><div class="eyebrow">Field guide</div><h2>You are very, very small.</h2><p>This black hole has the mass of 100 million suns. Its event horizon is about 591 million kilometres across: large enough to swallow Earth's orbit.</p><h3>Find your way</h3><div class="key-table"><kbd>Drag / arrows</kbd><span>Look around in flight; circle in orbit</span><kbd>W A S D</kbd><span>Fly forward, left, backward, right</span><kbd>Q / E</kbd><span>Descend / ascend</span><kbd>Shift</kbd><span>Boost flight speed</span><kbd>Scroll / pinch</kbd><span>Approach or pull back</span><kbd>Space</kbd><span>Pause time and the guided voyage</span><kbd>H / F / M</kbd><span>Hide interface / fullscreen / sound</span><kbd>R / Escape</kbd><span>Restart / close panels or show controls</span></div><p>Choose <b>Voyage</b> for a 100-second approach. <b>Free flight</b> puts you at the controls. <b>Orbit</b> lets you examine the disk from every angle. Flight keys take over from the voyage automatically. On a touch screen, use the flight buttons and drag to look.</p><h3>What you are seeing</h3><p>Light paths curve through an approximate Schwarzschild gravitational field. The disk's far side appears above and below the shadow because its light bends around the hole. Hot gas forms bright filaments; surrounding haze catches their glow. Background stars are lensed along the same light paths.</p><p>The clock ratio estimates gravitational time dilation for a stationary observer. It excludes orbital velocity and spin. Travel, disk motion, and sound are artistic choices. Flight stops outside the horizon so you can keep exploring.</p><p>Inspired by <i>Interstellar</i> and the <a href="https://arxiv.org/abs/1502.03808" target="_blank" rel="noopener noreferrer">James, von Tunzelmann, Franklin & Thorne paper</a>. Independently created; no film imagery or audio used.</p></dialog>
 <div class="loading" id="loading"><div class="loading-ring"></div><p>Mapping the light</p></div><div class="toast" id="toast" role="status"></div>`;

const $ = <T extends HTMLElement = HTMLElement>(id: string) =>
  document.getElementById(id) as T;
const canvas = $<HTMLCanvasElement>("universe");
let renderer: THREE.WebGLRenderer;
try {
  renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: false,
    powerPreference: "high-performance",
    preserveDrawingBuffer: true,
  });
} catch {
  $("loading").innerHTML =
    "<p>WebGL 2 is unavailable.</p><p>Enable graphics acceleration in your browser, then reload.</p>";
  throw new Error("WebGL 2 is required");
}
renderer.setPixelRatio(1);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1;
let shaderErrors = 0;
renderer.debug.onShaderError = (gl, program, vertex, fragment) => {
  shaderErrors++;
  console.error(
    "Black hole shader failed",
    gl.getProgramInfoLog(program),
    gl.getShaderInfoLog(vertex),
    gl.getShaderInfoLog(fragment),
  );
};
const scene = new THREE.Scene(),
  renderCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
const viewCamera = new THREE.PerspectiveCamera(48, 1, 0.1, 1000);
const position = new THREE.Vector3(0, 1.45, 21),
  target = new THREE.Vector3(0, 0.0, 0);
const uniforms = {
  uResolution: { value: new THREE.Vector2() },
  uCamera: { value: position },
  uBasis: { value: new THREE.Matrix3() },
  uFov: { value: THREE.MathUtils.degToRad(48) },
  uTime: { value: 0 },
  uExposure: { value: 1 },
  uDisk: { value: 1 },
  uLensing: { value: 1 },
  uDoppler: { value: 1 },
  uDust: { value: 1 },
  ...skyUniforms(createSky(), true),
};
const material = new THREE.ShaderMaterial({
  uniforms,
  vertexShader:
    "varying vec2 vUv; void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}",
  fragmentShader: starsChunk + blackHoleFragment,
  depthTest: false,
  depthWrite: false,
});
scene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material));
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, renderCamera));
const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.22, 0.35, 1.25);
composer.addPass(bloom);
composer.addPass(new OutputPass());
// Dev-only handle for profiling the observatory without requestAnimationFrame.
if (import.meta.env.DEV) Object.assign(window, { __obs: { composer, renderer, uniforms } });
const ambience = new Ambience();
const atlas = new Atlas(
  renderer,
  uniforms.uSky.value,
  () => {
    resize();
  },
  ambience,
);
const atlasLaunch = document.createElement("button");
atlasLaunch.className = "atlas-launch";
atlasLaunch.textContent = "Explore both systems ↗";
atlasLaunch.onclick = () => {
  keys.clear();
  atlas.open();
};
document.body.append(atlasLaunch);
type Mode = "voyage" | "flight" | "orbit";
let mode: Mode = "voyage",
  started = false,
  paused = false,
  time = 0,
  speed = 1,
  journey = 0,
  last = performance.now(),
  frame = 0;
let yaw = 0,
  pitch = 0,
  orbitTheta = 0,
  orbitPhi = 1.5,
  orbitRadius = 21;
let smoothTheta = 0,
  smoothPhi = 1.5,
  smoothRadius = 21;
let autoScale = window.innerWidth < 700 ? 0.65 : 0.82,
  quality = "auto",
  fpsAverage = 40;
let transition: { start: THREE.Vector3; end: THREE.Vector3; t: number } | null =
  null;
const keys = new Set<string>(),
  clockRate = $("dilation"),
  distance = $("distance"),
  radius = $("radius");
const AU_PER_RS = 1.9741;
let toastTimer: ReturnType<typeof setTimeout>;
function toast(text: string) {
  $("toast").textContent = text;
  $("toast").classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => $("toast").classList.remove("show"), 3000);
}
function resize() {
  const scale =
    quality === "auto"
      ? autoScale
      : quality === "low"
        ? 0.5
        : quality === "high"
          ? 1
          : 1.4;
  const ratio = Math.min(scale, 1920 / window.innerWidth);
  const w = Math.round(innerWidth * ratio),
    h = Math.round(innerHeight * ratio);
  renderer.setSize(w, h, false);
  composer.setSize(w, h);
  uniforms.uResolution.value.set(w, h);
  uniforms.uPix.value = (2 * Math.tan(uniforms.uFov.value / 2)) / h;
  viewCamera.aspect = innerWidth / innerHeight;
  viewCamera.updateProjectionMatrix();
  atlas.resize();
}
window.addEventListener("resize", resize);
resize();
function syncOrbit() {
  orbitRadius = position.length();
  orbitPhi = Math.acos(position.y / orbitRadius);
  orbitTheta = Math.atan2(position.x, position.z);
  smoothRadius = orbitRadius;
  smoothPhi = orbitPhi;
  smoothTheta = orbitTheta;
}
function start() {
  if (started) return;
  started = true;
  document.body.classList.add("started");
  $("intro")?.setAttribute("aria-hidden", "true");
  document.querySelector(".intro")?.setAttribute("inert", "");
  canvas.focus({ preventScroll: true });
}
function setMode(next: Mode) {
  const orientation = new THREE.Euler().setFromQuaternion(
    viewCamera.quaternion,
    "YXZ",
  );
  start();
  mode = next;
  transition = null;
  yaw = 0;
  pitch = 0;
  velocity.set(0, 0, 0);
  if (next === "flight") {
    yaw = orientation.y;
    pitch = orientation.x;
  }
  if (next === "orbit") syncOrbit();
  if (next === "voyage") {
    journey = 0;
    position.set(0, 1.45, 21);
    paused = false;
    updatePause();
  }
  document
    .querySelectorAll<HTMLButtonElement>("[data-mode]")
    .forEach((b) =>
      b.setAttribute("aria-pressed", String(b.dataset.mode === mode)),
    );
  $("touch-controls").classList.toggle("visible", mode === "flight");
  $("hints").innerHTML =
    mode === "flight"
      ? "<kbd>W A S D</kbd> fly · <kbd>Q E</kbd> vertical · <kbd>Shift</kbd> boost · Drag or arrows to look"
      : mode === "orbit"
        ? "Drag or arrows to orbit · Scroll to change distance · <kbd>H</kbd> hide interface"
        : "Drag or arrows to look · <kbd>W</kbd> take control · <kbd>Space</kbd> pause";
}
function updatePause() {
  $("pause").innerHTML = svg(paused ? "play" : "pause");
  $("pause").setAttribute(
    "aria-label",
    paused ? "Resume simulation" : "Pause simulation",
  );
  $("pause").setAttribute("aria-pressed", String(paused));
}
function reset() {
  setMode("voyage");
  time = 0;
  paused = false;
  yaw = 0;
  pitch = 0;
  updatePause();
  toast("Journey restarted");
}
$("begin").onclick = () => {
  start();
  journey = 0;
  paused = false;
  updatePause();
};
document
  .querySelectorAll<HTMLButtonElement>("[data-mode]")
  .forEach((b) => (b.onclick = () => setMode(b.dataset.mode as Mode)));
$("pause").onclick = () => {
  paused = !paused;
  updatePause();
};
$("reset").onclick = reset;
function toggleClean() {
  document.body.classList.toggle("clean");
}
$("hide").onclick = toggleClean;
$("show").onclick = toggleClean;
function closePanel() {
  $("panel").hidden = true;
  $("settings").setAttribute("aria-expanded", "false");
}
$("settings").onclick = () => {
  $("panel").hidden = !$("panel").hidden;
  $("settings").setAttribute("aria-expanded", String(!$("panel").hidden));
};
$("close-settings").onclick = () => {
  closePanel();
  $("settings").focus();
};
const info = $<HTMLDialogElement>("info");
$("help").onclick = () => {
  keys.clear();
  info.showModal();
};
$("close-info").onclick = () => info.close();
info.addEventListener("click", (e) => {
  if (e.target === info) {
    const r = info.getBoundingClientRect();
    if (
      e.clientX < r.left ||
      e.clientX > r.right ||
      e.clientY < r.top ||
      e.clientY > r.bottom
    )
      info.close();
  }
});
$("audio").onclick = async () => {
  try {
    const enabled = await ambience.toggle();
    $("audio").classList.toggle("audio-on", enabled);
    $("audio").setAttribute("aria-pressed", String(enabled));
    $("audio").setAttribute(
      "aria-label",
      enabled ? "Mute ambient sound" : "Enable ambient sound",
    );
  } catch {
    toast("Audio unavailable in this browser");
  }
};
async function fullscreen() {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await document.documentElement.requestFullscreen();
  } catch {
    toast("Fullscreen is unavailable in this browser");
  }
}
$("fullscreen").onclick = fullscreen;
document.addEventListener("fullscreenchange", () => {
  $("fullscreen").setAttribute(
    "aria-label",
    document.fullscreenElement ? "Exit fullscreen" : "Enter fullscreen",
  );
});
$("capture").onclick = () => {
  composer.render();
  canvas.toBlob((blob) => {
    if (!blob) {
      toast("Could not save this frame");
      return;
    }
    const a = document.createElement("a"),
      url = URL.createObjectURL(blob);
    a.href = url;
    a.download = `gargantua-${new Date().toISOString().replace(/[:.]/g, "-")}.png`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast("Image saved");
  });
};
const bindRange = (
  id: string,
  cb: (v: number) => void,
  format: (v: number) => string = (v) => v.toFixed(1),
) => {
  $<HTMLInputElement>(id).oninput = (e) => {
    const v = Number((e.target as HTMLInputElement).value);
    cb(v);
    $(id + "-value").textContent = format(v);
  };
};
bindRange("exposure", (v) => (uniforms.uExposure.value = v));
bindRange("disk", (v) => (uniforms.uDisk.value = v));
bindRange("dust", (v) => (uniforms.uDust.value = v));
bindRange(
  "speed",
  (v) => (speed = v),
  (v) => v.toFixed(1) + "×",
);
bindRange(
  "fov",
  (v) => {
    uniforms.uFov.value = THREE.MathUtils.degToRad(v);
    resize();
  },
  (v) => v + "°",
);
$<HTMLInputElement>("lensing").onchange = (e) =>
  (uniforms.uLensing.value = (e.target as HTMLInputElement).checked ? 1 : 0);
$<HTMLInputElement>("doppler").onchange = (e) =>
  (uniforms.uDoppler.value = (e.target as HTMLInputElement).checked ? 1 : 0);
$<HTMLSelectElement>("quality").onchange = (e) => {
  quality = (e.target as HTMLSelectElement).value;
  resize();
};
const presets: Record<string, THREE.Vector3> = {
  front: new THREE.Vector3(0, 1.2, 18),
  above: new THREE.Vector3(0, 22, 12),
  near: new THREE.Vector3(0, 1.1, 7),
  far: new THREE.Vector3(0, 7, 52),
};
document.querySelectorAll<HTMLButtonElement>("[data-preset]").forEach(
  (b) =>
    (b.onclick = () => {
      const end = presets[b.dataset.preset!];
      setMode("orbit");
      transition = { start: position.clone(), end: end.clone(), t: 0 };
      closePanel();
    }),
);
const pointers = new Map<number, { x: number; y: number }>();
let pinchDistance = 0;
canvas.addEventListener("pointerdown", (e) => {
  if (atlas.active) return;
  canvas.focus({ preventScroll: true });
  canvas.setPointerCapture(e.pointerId);
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (pointers.size === 2) {
    const p = [...pointers.values()];
    pinchDistance = Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y);
  }
});
canvas.addEventListener("pointermove", (e) => {
  if (atlas.active) return;
  const previous = pointers.get(e.pointerId);
  if (!previous) return;
  const dx = e.clientX - previous.x,
    dy = e.clientY - previous.y;
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (pointers.size === 2) {
    const p = [...pointers.values()],
      dist = Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y);
    dolly((pinchDistance - dist) * 0.006);
    pinchDistance = dist;
    return;
  }
  if (mode === "orbit") {
    orbitTheta -= dx * 0.004;
    orbitPhi = THREE.MathUtils.clamp(
      orbitPhi - dy * 0.004,
      0.04,
      Math.PI - 0.04,
    );
  } else {
    yaw -= dx * 0.003;
    pitch = THREE.MathUtils.clamp(pitch - dy * 0.003, -1.3, 1.3);
  }
});
const release = (e: PointerEvent) => pointers.delete(e.pointerId);
canvas.addEventListener("pointerup", release);
canvas.addEventListener("pointercancel", release);
canvas.addEventListener("lostpointercapture", release);
function dolly(amount: number) {
  if (atlas.active) return;
  if (mode === "voyage") setMode("orbit");
  if (mode === "orbit")
    orbitRadius = THREE.MathUtils.clamp(
      orbitRadius * Math.exp(amount),
      3.2,
      100,
    );
  else
    position.addScaledVector(
      new THREE.Vector3(0, 0, -1).applyQuaternion(viewCamera.quaternion),
      -amount * Math.max(position.length(), 3),
    );
}
canvas.addEventListener(
  "wheel",
  (e) => {
    e.preventDefault();
    dolly(e.deltaY * 0.001);
  },
  { passive: false },
);
document.querySelectorAll<HTMLButtonElement>("[data-move]").forEach((b) => {
  b.onpointerdown = (e) => {
    e.preventDefault();
    b.setPointerCapture(e.pointerId);
    keys.add(b.dataset.move!);
  };
  b.onpointerup = b.onpointercancel = () => keys.delete(b.dataset.move!);
  b.onlostpointercapture = () => keys.delete(b.dataset.move!);
});
window.addEventListener("keydown", (e) => {
  if (atlas.active) return;
  if (info.open) return;
  if ((e.target as HTMLElement).matches("input,select,textarea")) return;
  const k = e.key.toLowerCase();
  if ([" ", "w", "a", "s", "d", "q", "e"].includes(k) || k.startsWith("arrow"))
    e.preventDefault();
  if (e.repeat) return;
  // Arrow keys look around (or circle the hole in orbit) while W A S D fly.
  if (k.startsWith("arrow")) keys.add(k);
  if ("wasdqe".includes(k) && k.length === 1) {
    if (mode !== "flight") setMode("flight");
    keys.add(k);
  }
  if (k === "shift") keys.add(k);
  if (k === " ") {
    paused = !paused;
    updatePause();
  }
  if (k === "h") toggleClean();
  if (k === "r") reset();
  if (k === "f") void fullscreen();
  if (k === "m") $("audio").click();
  if (k === "?") info.showModal();
  if (k === "escape") {
    closePanel();
    document.body.classList.remove("clean");
  }
});
window.addEventListener("keyup", (e) => keys.delete(e.key.toLowerCase()));
window.addEventListener("blur", () => {
  keys.clear();
  pointers.clear();
});
document.addEventListener("visibilitychange", () => {
  keys.clear();
  last = performance.now();
  if (document.hidden) ambience.suspend();
  else ambience.resume();
});
const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
if (reducedMotion) {
  paused = true;
  updatePause();
}
const chapters = [
  {
    at: 0,
    end: 12,
    label: "Departure",
    text: "Some things are too vast to understand from a distance.",
  },
  {
    at: 21,
    end: 33,
    label: "The accretion disk",
    text: "A river of light. Falling forever.",
  },
  {
    at: 45,
    end: 57,
    label: "Gravitational lensing",
    text: "The universe behind it bends into view.",
  },
  {
    at: 72,
    end: 85,
    label: "The edge of the shadow",
    text: "Even light has a point of no return.",
  },
  {
    at: 94,
    end: 110,
    label: "Approach complete",
    text: "Stay a while. Or take the controls.",
  },
];
let lastChapter = -1;
let introBlend = 1;
const velocity = new THREE.Vector3();
function updateCamera(dt: number) {
  if (transition) {
    transition.t = Math.min(transition.t + dt / 3, 1);
    const t = transition.t * transition.t * (3 - 2 * transition.t);
    position.lerpVectors(transition.start, transition.end, t);
    syncOrbit();
    if (transition.t >= 1) transition = null;
  } else if (mode === "voyage" && started && !paused) {
    journey = Math.min(100, journey + dt * speed);
    const t = journey / 100,
      s = t * t * (3 - 2 * t);
    const r = 21 - 13.5 * s;
    const angle = s * 0.22;
    position.set(Math.sin(angle) * r, 1.45 + s * 0.05, Math.cos(angle) * r);
  } else if (mode === "orbit") {
    smoothTheta = THREE.MathUtils.damp(smoothTheta, orbitTheta, 9, dt);
    smoothPhi = THREE.MathUtils.damp(smoothPhi, orbitPhi, 9, dt);
    smoothRadius = THREE.MathUtils.damp(smoothRadius, orbitRadius, 7, dt);
    position.setFromSphericalCoords(smoothRadius, smoothPhi, smoothTheta);
  }
  const lookX = Number(keys.has("arrowleft")) - Number(keys.has("arrowright")),
    lookY = Number(keys.has("arrowup")) - Number(keys.has("arrowdown"));
  if (lookX || lookY) {
    if (mode === "orbit") {
      orbitTheta += lookX * 1.2 * dt;
      orbitPhi = THREE.MathUtils.clamp(orbitPhi - lookY * 1.2 * dt, 0.04, Math.PI - 0.04);
    } else {
      yaw = THREE.MathUtils.euclideanModulo(yaw + lookX * 1.5 * dt + Math.PI, Math.PI * 2) - Math.PI;
      pitch = THREE.MathUtils.clamp(pitch + lookY * 1.5 * dt, -1.3, 1.3);
    }
  }
  if (mode === "flight") {
    const movement = new THREE.Vector3(
      Number(keys.has("d")) - Number(keys.has("a")),
      Number(keys.has("e")) - Number(keys.has("q")),
      Number(keys.has("s")) - Number(keys.has("w")),
    );
    if (movement.lengthSq())
      movement
        .normalize()
        .applyQuaternion(viewCamera.quaternion)
        .multiplyScalar(
          Math.max(0.3, position.length() * 0.09) * (keys.has("shift") ? 4 : 1),
        );
    velocity.lerp(movement, 1 - Math.exp(-dt * 3));
    position.addScaledVector(velocity, dt);
    if (position.length() < 1.12) {
      position.setLength(1.12);
      velocity.set(0, 0, 0);
      toast("Horizon boundary · Reverse thrust to retreat");
    }
    if (position.length() > 120) {
      position.setLength(120);
      velocity.set(0, 0, 0);
    }
  }
  viewCamera.position.copy(position);
  if (mode !== "flight") {
    viewCamera.lookAt(target);
    viewCamera.rotateY(yaw);
    viewCamera.rotateX(pitch);
  } else {
    // Keep a stable ship orientation instead of continually re-aiming at the hole.
    viewCamera.rotation.set(pitch, yaw, 0, "YXZ");
  }
  if (!started || (introBlend > 0.001 && mode === "voyage")) {
    if (started) introBlend = THREE.MathUtils.damp(introBlend, 0, 2, dt);
    const framing =
      innerWidth < 700
        ? new THREE.Vector3(0, -5, 0)
        : new THREE.Vector3(-5, 1, 0);
    viewCamera.lookAt(framing.multiplyScalar(introBlend));
  }
  viewCamera.updateMatrixWorld();
  uniforms.uBasis.value.setFromMatrix4(viewCamera.matrixWorld);
}
function animate(now: number) {
  requestAnimationFrame(animate);
  const raw = (now - last) / 1000,
    dt = Math.min(raw, 0.05);
  last = now;
  if (document.hidden) return;
  if (atlas.active) {
    atlas.update(Math.min(raw, .25));
    return;
  }
  frame++;
  if (!paused) time += dt * speed;
  uniforms.uTime.value = time;
  updateCamera(dt);
  composer.render();
  if (frame === 3) {
    $("loading").classList.add("ready");
    setTimeout(() => ($("loading").hidden = true), 1100);
  }
  if (frame % 12 === 0) {
    const r = position.length();
    distance.textContent = (r * AU_PER_RS).toFixed(2);
    radius.textContent = r.toFixed(2);
    clockRate.textContent = (1 / Math.sqrt(1 - 1 / r)).toFixed(3);
    ambience.update(r);
    document.body.classList.toggle("danger", r < 3);
    $("status").textContent = !started
      ? "Systems ready · Awaiting departure"
      : r < 3
        ? "Proximity warning · Horizon ahead"
        : paused
          ? "Time paused · Navigation available"
          : mode === "voyage"
            ? journey >= 100
              ? "Approach complete · Take the controls"
              : "Voyage in progress · " + Math.round(journey) + "%"
            : mode === "flight"
              ? "Manual flight · Thrusters online"
              : "Orbital observation · Drag to explore";
    $("progress").style.width =
      mode === "voyage" && started ? journey + "%" : "0";
    const c =
      mode === "voyage" && started
        ? chapters.findIndex((c) => journey >= c.at && journey < c.end)
        : -1;
    if (c !== lastChapter) {
      lastChapter = c;
      $("chapter").classList.toggle("show", c >= 0);
      if (c >= 0) {
        $("chapter-label").textContent = chapters[c].label;
        $("chapter-text").textContent = chapters[c].text;
      }
    }
  }
  if (raw > 0.001) fpsAverage = fpsAverage * 0.98 + (1 / raw) * 0.02;
  if (frame % 240 === 0 && quality === "auto") {
    const old = autoScale;
    if (fpsAverage < 25) autoScale = Math.max(0.4, autoScale - 0.1);
    else if (fpsAverage > 52) autoScale = Math.min(1, autoScale + 0.05);
    if (old !== autoScale) resize();
  }
}
canvas.addEventListener("webglcontextlost", (e) => {
  e.preventDefault();
  $("loading").hidden = false;
  $("loading").classList.remove("ready");
  $("loading").innerHTML =
    '<p>Graphics connection interrupted.</p><button class="begin" onclick="location.reload()">Reload experience</button>';
});
// Read-only diagnostics for performance checks and reproducible QA.
Object.defineProperty(window, "gargantua", {
  get: () => ({
    mode,
    started,
    paused,
    journey,
    time,
    position: position.toArray(),
    distance: position.length(),
    look: [yaw, pitch],
    fps: Math.round(fpsAverage),
    resolution: uniforms.uResolution.value.toArray(),
    quality,
    shaderErrors,
  }),
});
requestAnimationFrame(animate);
