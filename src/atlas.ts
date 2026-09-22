import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import worldFragment from "./shaders/world.frag?raw";
import blackHoleFragment from "./shaders/blackhole.frag?raw";
import starsChunk from "./shaders/stars.glsl?raw";
import lensFragment from "./shaders/lens.frag?raw";
import {
  A,
  Bridge,
  L1,
  L2,
  LENS_M,
  RHO,
  RZ,
  other,
  radiusAt,
  type Side,
  type ZonePoint,
} from "./wormhole";
import { Endurance } from "./endurance";
import { skyUniforms } from "./sky";
import type { Ambience } from "./audio";
import "./atlas.css";

type Sector = Side;
type World = {
  id: string;
  name: string;
  sector: Sector;
  radius: number;
  orbit: number;
  angle: number;
  color: number;
  kind: number;
  subtitle: string;
  description: string;
  fact: string;
};
export const worlds: World[] = [
  {
    id: "gargantua",
    name: "Gargantua",
    sector: "gargantua",
    radius: 3,
    orbit: 0,
    angle: 0,
    color: 0,
    kind: 0,
    subtitle: "The dark heart",
    description:
      "A hundred million solar masses. The far side of the accretion disk bends above and below the shadow. The observatory offers an even closer approach.",
    fact: "100 million solar masses · fictional system",
  },
  {
    id: "miller",
    name: "Miller",
    sector: "gargantua",
    radius: 1.25,
    orbit: 76,
    angle: 1.1,
    color: 0x466a80,
    kind: 3,
    subtitle: "An ocean without a shore",
    description:
      "A shallow ocean under a colossal sky. Long tidal wave fronts cross the water. Inspired by the film’s ocean world; its extreme clock ratio is a story reference, not calculated here.",
    fact: "Film reference: 1 hour ≈ 7 Earth years",
  },
  {
    id: "mann",
    name: "Mann",
    sector: "gargantua",
    radius: 1.7,
    orbit: 118,
    angle: 3.8,
    color: 0x95b8c4,
    kind: 2,
    subtitle: "The frozen world",
    description:
      "Fractured ice, pale ridges and a thin veil of frozen cloud. A beautiful, hostile destination from the Lazarus expedition.",
    fact: "Fictional ice world · placement is artistic",
  },
  {
    id: "edmunds",
    name: "Edmunds",
    sector: "gargantua",
    radius: 1.35,
    orbit: 171,
    angle: 5.5,
    color: 0xc7935d,
    kind: 4,
    subtitle: "A place to begin again",
    description:
      "Ochre deserts, dark highlands and a pale atmosphere. A speculative interpretation of humanity’s new home, not a measured exoplanet.",
    fact: "Fictional habitable world · placement is artistic",
  },
  {
    id: "sun",
    name: "Sun",
    sector: "solar",
    radius: 8,
    orbit: 0,
    angle: 0,
    color: 0xffc575,
    kind: 5,
    subtitle: "The star that made us",
    description:
      "A living surface of bright granules beneath a soft corona. Our star holds the solar system together; every familiar world circles this light.",
    fact: "Diameter 1.39 million km · G-type star",
  },
  {
    id: "mercury",
    name: "Mercury",
    sector: "solar",
    radius: 0.65,
    orbit: 20,
    angle: 0.5,
    color: 0x9c9083,
    kind: 0,
    subtitle: "Scorched stone",
    description:
      "A small, airless, rocky world close to the Sun. Its long day exposes the surface to dramatic temperature extremes.",
    fact: "0.39 AU from Sun · diameter 4,879 km",
  },
  {
    id: "venus",
    name: "Venus",
    sector: "solar",
    radius: 1.1,
    orbit: 30,
    angle: 2.5,
    color: 0xd9b574,
    kind: 1,
    subtitle: "Behind the clouds",
    description:
      "A bright, cloud-wrapped world. Beneath the opaque atmosphere lies a crushing, intensely hot surface.",
    fact: "0.72 AU from Sun · diameter 12,104 km",
  },
  {
    id: "earth",
    name: "Earth",
    sector: "solar",
    radius: 1.2,
    orbit: 42,
    angle: 4.1,
    color: 0x448dca,
    kind: 6,
    subtitle: "There is no place like home",
    description:
      "Blue oceans, familiar continents, moving clouds and a thin atmospheric limb. The Moon accompanies our fragile home through the dark.",
    fact: "1 AU from Sun · diameter 12,742 km",
  },
  {
    id: "mars",
    name: "Mars",
    sector: "solar",
    radius: 0.85,
    orbit: 56,
    angle: 5.5,
    color: 0xb55d36,
    kind: 0,
    subtitle: "The red frontier",
    description:
      "Rust-colored deserts and dark weathered terrain. A rocky neighbor beyond Earth, on the inner edge of the asteroid belt.",
    fact: "1.52 AU from Sun · diameter 6,779 km",
  },
  {
    id: "jupiter",
    name: "Jupiter",
    sector: "solar",
    radius: 4.2,
    orbit: 89,
    angle: 1.3,
    color: 0xd5b594,
    kind: 1,
    subtitle: "A world of storms",
    description:
      "Bands of ammonia cloud, turbulent belts and a great rust-colored storm. Four small moons trace paths around the gas giant.",
    fact: "5.20 AU from Sun · diameter 139,820 km",
  },
  {
    id: "saturn",
    name: "Saturn",
    sector: "solar",
    radius: 6,
    orbit: 124,
    angle: 3.25,
    color: 0xdac796,
    kind: 1,
    subtitle: "The doorway home",
    description:
      "Icy rings encircle the pale gas giant. Nearby hangs a sphere that is not a planet: a wormhole, showing another galaxy’s sky folded across its face.",
    fact: "9.58 AU from Sun · diameter 116,460 km",
  },
  {
    id: "uranus",
    name: "Uranus",
    sector: "solar",
    radius: 2.5,
    orbit: 163,
    angle: 4.7,
    color: 0x85cbd0,
    kind: 1,
    subtitle: "The tilted ice giant",
    description:
      "A quiet cyan atmosphere and a narrow, tilted ring system. An ice giant in the cold outer solar system.",
    fact: "19.2 AU from Sun · diameter 50,724 km",
  },
  {
    id: "neptune",
    name: "Neptune",
    sector: "solar",
    radius: 2.4,
    orbit: 205,
    angle: 0.15,
    color: 0x3565cc,
    kind: 1,
    subtitle: "Beyond the familiar",
    description:
      "Deep blue cloud bands mark the outermost major planet. Beyond it stretches the broad, faint debris of the Kuiper belt.",
    fact: "30.1 AU from Sun · diameter 49,244 km",
  },
];
const vertex = `varying vec3 vNormal; varying vec3 vWorld; varying vec3 vLocal; varying vec2 vUv; void main(){vUv=uv;vLocal=position;vWorld=(modelMatrix*vec4(position,1.)).xyz;vNormal=normalize(mat3(modelMatrix)*normal);gl_Position=projectionMatrix*viewMatrix*vec4(vWorld,1.);}`;
// Sky domes sit at the far plane around whichever camera renders them (including cube faces).
const domeVertex = `varying vec3 vDir; void main(){vDir=(modelMatrix*vec4(position,0.)).xyz;vec4 p=projectionMatrix*viewMatrix*vec4(cameraPosition+vDir,1.);gl_Position=vec4(p.xy,p.w*.999999,p.w);}`;

/** Endurance ring radius in world units: the wormhole throat is ~36 ships across. */
const SHIP_R = 0.035;
/** Solar mouth relative to Saturn; Gargantua mouth in its system. */
const SATURN_OFFSET = new THREE.Vector3(30, 6, 32);
const GARGANTUA_MOUTH = new THREE.Vector3(-60, 14, -76);
const periods: Record<string, number> = {
  mercury: 0.241,
  venus: 0.615,
  earth: 1,
  mars: 1.881,
  jupiter: 11.86,
  saturn: 29.46,
  uranus: 84,
  neptune: 164.8,
  miller: 2,
  mann: 6,
  edmunds: 12,
};
type Body = {
  data: World;
  mesh: THREE.Mesh;
  group: THREE.Group;
  material: THREE.ShaderMaterial;
};
type View = "chase" | "hull" | "cockpit" | "orbit";
type Autopilot =
  | { kind: "body"; id: string }
  | { kind: "wormhole"; phase: "approach" | "exit" | "settle" }
  | null;
const views: Record<Exclude<View, "orbit">, { offset: THREE.Vector3; tilt: THREE.Quaternion }> = {
  chase: {
    offset: new THREE.Vector3(1.3, 1.3, 6.8).multiplyScalar(SHIP_R),
    tilt: new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.075, -0.075, 0)),
  },
  hull: {
    offset: new THREE.Vector3(0.2, 0.2, 0.62).multiplyScalar(SHIP_R),
    tilt: new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.05, 0.1, 0)),
  },
  cockpit: {
    offset: new THREE.Vector3(0, 0.07, -0.9).multiplyScalar(SHIP_R),
    tilt: new THREE.Quaternion(),
  },
};
const viewNames: Record<View, string> = {
  chase: "Chase",
  hull: "Hull camera",
  cockpit: "Cockpit",
  orbit: "Orbit",
};

export class Atlas {
  active = false;
  sector: Sector = "solar";
  private scene = new THREE.Scene();
  private shipScene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(50, 1, 0.01, 9000);
  private shipCamera = new THREE.PerspectiveCamera(50, 1, 0.0008, 20);
  private controls: OrbitControls;
  private composer: EffectComposer;
  private bodies: Body[] = [];
  private roots = { gargantua: new THREE.Group(), solar: new THREE.Group() };
  private bridge = new Bridge();
  private selected = "wormhole";
  private elapsed = 0;
  private renderScale = 0.75;
  private adaptiveQuality = true;
  private performanceTime = 0;
  private performanceFrames = 0;
  private fps = 60;
  private paused = false;
  private keys = new Set<string>();
  private steer: { x0: number; y0: number; x: number; y: number } | null = null;
  private root: HTMLElement;
  private routes: HTMLDialogElement;
  private labels = new Map<string, HTMLButtonElement>();
  private spin: THREE.Object3D[] = [];
  private earth: THREE.Texture;
  private solarDome: THREE.Mesh;
  private blackDome: THREE.Mesh;
  private lens: THREE.Mesh;
  private lensMaterial: THREE.ShaderMaterial;
  private cubes: Record<"local" | "remote", { target: THREE.WebGLCubeRenderTarget; camera: THREE.CubeCamera }>;
  private cubeSize = 0;
  private cubeFrame = 0;
  private endurance = new Endurance();
  private shipPivot = new THREE.Group();
  private keyLight = new THREE.DirectionalLight(0xffffff, 3);
  private fillLight = new THREE.HemisphereLight(0x8aa4c8, 0x1a1410, 0.18);
  private camLight = new THREE.DirectionalLight(0x9fb3d1, 0.35);
  private dust: THREE.LineSegments;
  private dustUnit: Float32Array;
  private ship = {
    side: "solar" as Side,
    pos: new THREE.Vector3(),
    vel: new THREE.Vector3(),
    quat: new THREE.Quaternion(),
    ang: new THREE.Vector3(),
    zone: null as ZonePoint | null,
    thrust: 0,
  };
  private camQuat = new THREE.Quaternion();
  private camSide: Side = "solar";
  private camZone: ZonePoint | null = null;
  private view: View = "chase";
  private zoom = 1;
  private autopilot: Autopilot = null;
  private cardTimer = 0;
  private shake = 0;
  private crossings = 0;
  constructor(
    private renderer: THREE.WebGLRenderer,
    sky: THREE.Texture,
    private exit: () => void,
    private ambience?: Ambience,
  ) {
    this.earth = new THREE.TextureLoader().load("/textures/earth.jpg");
    this.earth.colorSpace = THREE.SRGBColorSpace;
    this.scene.add(this.roots.gargantua, this.roots.solar);
    this.controls = new OrbitControls(this.camera, renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.enablePan = false;
    this.controls.enabled = false;
    // Multisampled HDR target: the ship's thin spokes and module edges need antialiasing.
    this.composer = new EffectComposer(
      renderer,
      new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 }),
    );
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    const shipPass = new RenderPass(this.shipScene, this.shipCamera);
    shipPass.clear = false;
    shipPass.clearDepth = true;
    this.composer.addPass(shipPass);
    this.composer.addPass(new UnrealBloomPass(new THREE.Vector2(1, 1), 0.3, 0.45, 1.15));
    this.composer.addPass(new OutputPass());
    for (const data of worlds) this.createBody(data);
    this.addDebris("solar", 70, 79, 1400);
    this.addDebris("solar", 225, 270, 1800);

    // Skies: our stars, and Gargantua's lensed sky from the black-hole ray tracer.
    const pixelSize = (m: THREE.ShaderMaterial) => (r: THREE.WebGLRenderer, _s: THREE.Scene, c: THREE.Camera) => {
      const cam = c as THREE.PerspectiveCamera;
      const target = r.getRenderTarget();
      const h = target ? target.height : r.getDrawingBufferSize(new THREE.Vector2()).y;
      m.uniforms.uPix.value = (2 * Math.tan(THREE.MathUtils.degToRad(cam.fov) / 2)) / h;
    };
    const solarSky = new THREE.ShaderMaterial({
      vertexShader: domeVertex,
      fragmentShader: starsChunk + "varying vec3 vDir;void main(){gl_FragColor=vec4(skyColor(normalize(vDir)),1.);}",
      uniforms: skyUniforms(sky, false),
      side: THREE.BackSide,
      depthWrite: false,
    });
    this.solarDome = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 16), solarSky);
    this.solarDome.onBeforeRender = pixelSize(solarSky);
    const blackSky = new THREE.ShaderMaterial({
      vertexShader: domeVertex,
      fragmentShader: "#define DOME\n" + starsChunk + blackHoleFragment,
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: {
        uCamera: { value: new THREE.Vector3() },
        uTime: { value: 0 },
        uExposure: { value: 1 },
        uDisk: { value: 1 },
        uLensing: { value: 1 },
        uDoppler: { value: 1 },
        uDust: { value: 1 },
        ...skyUniforms(sky, true),
      },
    });
    this.blackDome = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 16), blackSky);
    this.blackDome.onBeforeRender = (r, s, c) => {
      pixelSize(blackSky)(r, s, c);
      blackSky.uniforms.uCamera.value.setFromMatrixPosition(c.matrixWorld).divideScalar(3);
    };
    for (const dome of [this.solarDome, this.blackDome]) {
      dome.frustumCulled = false;
      dome.renderOrder = -100;
    }
    this.roots.solar.add(this.solarDome);
    this.roots.gargantua.add(this.blackDome);

    // The wormhole: a region of curved space rendered by tracing light through it.
    const cube = () => {
      const target = new THREE.WebGLCubeRenderTarget(256, {
        type: THREE.HalfFloatType,
        generateMipmaps: false,
        minFilter: THREE.LinearFilter,
      });
      return { target, camera: new THREE.CubeCamera(0.05, 9000, target) };
    };
    this.cubes = { local: cube(), remote: cube() };
    this.lensMaterial = new THREE.ShaderMaterial({
      vertexShader: "varying vec3 vWorld;void main(){vWorld=(modelMatrix*vec4(position,1.)).xyz;gl_Position=projectionMatrix*viewMatrix*vec4(vWorld,1.);}",
      fragmentShader: starsChunk + lensFragment,
      transparent: true,
      depthWrite: false,
      uniforms: {
        ...skyUniforms(sky, false),
        uMouth: { value: new THREE.Vector3() },
        uInside: { value: 0 },
        uCamN: { value: new THREE.Vector3(0, 0, 1) },
        uCamL: { value: L2 },
        uCamR: { value: RZ },
        uLocal: { value: this.cubes.local.target.texture },
        uRemote: { value: this.cubes.remote.target.texture },
        uLocalSolar: { value: 1 },
        uRemoteSolar: { value: 0 },
        uMirror: { value: this.bridge.mirror },
        uRho: { value: RHO },
        uA: { value: A },
        uM: { value: LENS_M },
        uL1: { value: L1 },
        uL2: { value: L2 },
        uRz: { value: RZ },
      },
    });
    this.lens = new THREE.Mesh(new THREE.SphereGeometry(RZ, 96, 64), this.lensMaterial);
    this.lens.onBeforeRender = pixelSize(this.lensMaterial);
    this.lens.renderOrder = 50;
    this.lens.frustumCulled = false;
    this.scene.add(this.lens);

    // Mouth placement and the pairing of directions across the bridge: fly in from
    // the far side of the sphere (Saturn behind it) and emerge facing Gargantua.
    this.bridge.mouths.gargantua.copy(GARGANTUA_MOUTH);
    this.bridge.setMirror(
      SATURN_OFFSET.clone().normalize(),
      GARGANTUA_MOUTH.clone().negate().normalize(),
    );
    this.updateOrbits();

    // The ship lives in its own scene, rendered over the world with its own depth range.
    this.endurance.group.scale.setScalar(SHIP_R);
    this.shipPivot.add(this.endurance.group);
    this.shipScene.add(this.shipPivot, this.keyLight, this.keyLight.target, this.fillLight, this.camLight);
    const dustCount = 360;
    this.dustUnit = new Float32Array(dustCount * 3).map(() => Math.random() - 0.5);
    const dustGeo = new THREE.BufferGeometry();
    dustGeo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(dustCount * 6), 3));
    this.dust = new THREE.LineSegments(
      dustGeo,
      new THREE.LineBasicMaterial({
        color: 0x9fb4cc,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
    this.dust.frustumCulled = false;
    this.shipPivot.add(this.dust);

    this.root = document.createElement("section");
    this.root.className = "atlas-ui";
    this.root.hidden = true;
    this.root.innerHTML = `<header class="atlas-top"><div><span class="micro">ENDURANCE / NAVIGATION</span><h1 id="sector-name">Solar system</h1></div><div class="atlas-tools"><button id="atlas-map">Route chart <kbd>Tab</kbd></button><button id="atlas-exit">Black hole observatory</button></div></header><div id="world-labels"></div><article class="world-card"><div class="micro" id="world-subtitle"></div><h2 id="world-name"></h2><p id="world-description"></p><div id="world-fact"></div></article><div class="flight-hud" aria-hidden="true"><div><span class="micro">Velocity</span><strong id="hud-speed">0</strong><small>km/s</small></div><div><span class="micro">Throttle</span><i class="throttle"><b id="hud-throttle"></b></i></div><div><span class="micro" id="hud-range-label">Throat</span><strong id="hud-range">—</strong><small id="hud-range-unit"></small></div></div><footer class="atlas-bottom"><div class="atlas-readout"><span class="micro" id="atlas-state">Manual flight</span><strong id="atlas-distance"></strong><small>Exploration scale · sizes and distances compressed · wormhole ray-traced</small></div><div class="atlas-actions"><button id="atlas-view" title="Camera (C)">View: Chase</button><button id="atlas-orbit" aria-pressed="false">Orbit</button><button id="atlas-wormhole" title="Autopilot through the wormhole (G)">Autopilot: wormhole</button><button id="atlas-pause" aria-label="Pause atlas">Pause</button></div><div class="atlas-hint"><kbd>W</kbd>/<kbd>S</kbd> thrust · <kbd>A</kbd>/<kbd>D</kbd> yaw · drag or arrows to steer · <kbd>Q</kbd>/<kbd>E</kbd> roll · <kbd>Shift</kbd> boost · <kbd>X</kbd> brake · <kbd>C</kbd> camera · <kbd>G</kbd> wormhole · scroll zoom · <kbd>H</kbd> hide</div><div class="atlas-touch"><button data-thrust="w" aria-label="Thrust forward">Thrust</button><button data-thrust="s" aria-label="Reverse thrust">Reverse</button><button data-thrust="x" aria-label="Brake">Brake</button></div></footer>`;
    document.body.append(this.root);
    const quality = document.createElement("select");
    quality.setAttribute("aria-label", "Atlas render quality");
    quality.innerHTML =
      '<option value="auto">Adaptive quality</option><option value="high">Cinematic quality</option><option value="low">Performance quality</option>';
    quality.onchange = () => {
      this.adaptiveQuality = quality.value === "auto";
      this.renderScale = quality.value === "high" ? 1 : quality.value === "low" ? 0.5 : 0.75;
      this.resize();
    };
    this.root.querySelector(".atlas-tools")!.prepend(quality);
    const restore = document.createElement("button");
    restore.className = "atlas-restore";
    restore.textContent = "Show controls";
    restore.onclick = () => this.root.classList.remove("atlas-clean");
    this.root.append(restore);
    for (const [id, title, target] of [
      ["atlas-sound", "Sound", "audio"],
      ["atlas-photo", "Save image", "capture"],
    ]) {
      const b = document.createElement("button");
      b.id = id;
      b.textContent = title;
      b.onclick = () => {
        if (target === "capture") this.capture();
        else document.getElementById(target)!.click();
      };
      if (target === "audio") {
        const source = document.getElementById("audio")!;
        const sync = () => {
          const enabled = source.getAttribute("aria-pressed") === "true";
          b.textContent = enabled ? "Mute" : "Sound";
          b.setAttribute("aria-pressed", String(enabled));
        };
        new MutationObserver(sync).observe(source, { attributes: true, attributeFilter: ["aria-pressed"] });
        sync();
      }
      this.root.querySelector(".atlas-tools")!.prepend(b);
    }
    this.routes = document.createElement("dialog");
    this.routes.className = "route-chart";
    this.routes.innerHTML = `<header><div><div class="micro">TWO SKIES. ONE JOURNEY.</div><h2>Find your next world.</h2></div><button id="close-routes" aria-label="Close route chart">✕</button></header><p>Choose a destination in your current system and the autopilot will fly the Endurance there. Cross the wormhole to reach the other side.</p><div class="route-layout"><div class="chart-art" aria-hidden="true"><svg viewBox="0 0 480 480"><g fill="none" stroke="currentColor" opacity=".22"><circle cx="240" cy="240" r="45"/><circle cx="240" cy="240" r="78"/><circle cx="240" cy="240" r="115"/><circle cx="240" cy="240" r="155"/><circle cx="240" cy="240" r="207"/><path d="M0 240h480M240 0v480" stroke-dasharray="3 8"/></g><g id="chart-dots"></g></svg><span>SCHEMATIC · NOT TO SCALE</span></div><div id="route-list"></div></div><div class="route-bridge"><span id="route-origin">Solar system / Saturn</span><span>◯ ─── Einstein–Rosen bridge ─── ◯</span><span id="route-other">Gargantua</span></div><p class="route-note">Solar facts: NASA. Lazarus worlds and the wormhole are fiction. The wormhole is ray-traced through the metric published by the film’s visual-effects team (James et al. 2015); scales are compressed for exploration.</p>`;
    document.body.append(this.routes);
    const $ = (id: string) => document.getElementById(id)!;
    $("atlas-map").onclick = () => this.openMap();
    $("close-routes").onclick = () => this.routes.close();
    $("atlas-exit").onclick = () => this.close();
    $("atlas-wormhole").onclick = () => this.goWormhole();
    $("atlas-orbit").onclick = () => this.setView(this.view === "orbit" ? "chase" : "orbit");
    $("atlas-view").onclick = () => this.cycleView();
    $("atlas-pause").onclick = () => {
      this.paused = !this.paused;
      $("atlas-pause").textContent = this.paused ? "Resume" : "Pause";
    };
    for (const b of this.bodies) {
      const label = document.createElement("button");
      label.className = "world-label";
      label.textContent = b.data.name;
      label.onclick = () => this.go(b.data.id);
      $("world-labels").append(label);
      this.labels.set(b.data.id, label);
    }
    const label = document.createElement("button");
    label.className = "world-label portal-label";
    label.textContent = "◯ Wormhole";
    label.onclick = () => this.goWormhole();
    $("world-labels").append(label);
    this.labels.set("wormhole", label);

    const canvas = renderer.domElement;
    canvas.addEventListener("pointerdown", (e) => {
      if (!this.active || this.view === "orbit") return;
      this.steer = { x0: e.clientX, y0: e.clientY, x: e.clientX, y: e.clientY };
      canvas.setPointerCapture(e.pointerId);
    });
    canvas.addEventListener("pointermove", (e) => {
      if (!this.steer) return;
      this.steer.x = e.clientX;
      this.steer.y = e.clientY;
      if (Math.hypot(e.clientX - this.steer.x0, e.clientY - this.steer.y0) > 6) this.autopilot = null;
    });
    for (const event of ["pointerup", "pointercancel", "lostpointercapture"])
      canvas.addEventListener(event, () => (this.steer = null));
    canvas.addEventListener(
      "wheel",
      (e) => {
        if (!this.active || this.view === "orbit") return;
        e.preventDefault();
        this.zoom = THREE.MathUtils.clamp(this.zoom * Math.exp(e.deltaY * 0.001), 0.55, 40);
      },
      { passive: false },
    );
    window.addEventListener("keydown", (e) => {
      if (!this.active) return;
      if (e.key === "Escape") {
        this.root.classList.remove("atlas-clean");
        return;
      }
      if (this.routes.open) return;
      if ((e.target as HTMLElement).matches("input,select,textarea")) return;
      const k = e.key.toLowerCase();
      if (k === "tab") {
        e.preventDefault();
        this.openMap();
      }
      if (e.repeat && !"wasdqex".includes(k)) return;
      if (k === "h") this.root.classList.toggle("atlas-clean");
      if (k === "f") {
        if (document.fullscreenElement) void document.exitFullscreen();
        else void document.documentElement.requestFullscreen();
      }
      if (k === "c") this.cycleView();
      if (k === "g") this.goWormhole();
      const flightKeys = ["w", "a", "s", "d", "q", "e", "x", "arrowup", "arrowdown", "arrowleft", "arrowright"];
      if (flightKeys.includes(k)) {
        e.preventDefault();
        this.keys.add(k);
        this.autopilot = null;
        if (this.view === "orbit") this.setView("chase");
      }
      if (k === "shift") this.keys.add(k);
      if (k === " ") {
        e.preventDefault();
        $("atlas-pause").click();
      }
    });
    window.addEventListener("keyup", (e) => this.keys.delete(e.key.toLowerCase()));
    window.addEventListener("blur", () => {
      this.keys.clear();
      this.steer = null;
    });
    this.root.querySelectorAll<HTMLButtonElement>("[data-thrust]").forEach((b) => {
      b.onpointerdown = (e) => {
        e.preventDefault();
        this.autopilot = null;
        if (this.view === "orbit") this.setView("chase");
        this.keys.add(b.dataset.thrust!);
        b.setPointerCapture(e.pointerId);
      };
      b.onpointerup = b.onpointercancel = b.onlostpointercapture = () => this.keys.delete(b.dataset.thrust!);
    });
    Object.defineProperty(window, "interstellar", {
      get: () => ({
        active: this.active,
        sector: this.camSide,
        shipSide: this.ship.side,
        selected: this.selected,
        traveling: !!this.autopilot,
        autopilot: this.autopilot,
        crossing: this.ship.zone ? this.ship.zone.l : -1,
        crossings: this.crossings,
        paused: this.paused,
        time: this.elapsed,
        flight: this.view !== "orbit",
        view: this.view,
        speed: this.ship.vel.length(),
        forward: new THREE.Vector3(0, 0, -1).applyQuaternion(this.ship.quat).toArray(),
        zoneN: this.ship.zone?.n.toArray(),
        position: this.ship.pos.toArray(),
        camera: this.camera.position.toArray(),
        worlds: this.bodies.filter((b) => b.data.sector === this.camSide).map((b) => b.data.id),
        portalDistance: this.ship.pos.distanceTo(this.bridge.mouths[this.ship.side]),
        fps: Math.round(this.fps),
        renderScale: this.renderScale,
        cubeSize: this.cubeSize,
      }),
    });
  }
  private createBody(data: World) {
    const group = new THREE.Group();
    group.position.set(Math.cos(data.angle) * data.orbit, 0, Math.sin(data.angle) * data.orbit);
    this.roots[data.sector].add(group);
    const material = new THREE.ShaderMaterial({
      vertexShader: vertex,
      fragmentShader: worldFragment,
      uniforms: {
        uTime: { value: 0 },
        uKind: { value: data.kind },
        uColor: { value: new THREE.Color(data.color) },
        uLight: { value: new THREE.Vector3(0, 3, 0) },
        uEarth: { value: this.earth },
        uStorm: { value: data.id === "jupiter" ? 1 : 0 },
      },
    });
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(data.radius, 96, 64), material);
    group.add(mesh);
    if (data.id === "gargantua") mesh.visible = false;
    this.bodies.push({ data, mesh, group, material });
    if (data.id === "earth") {
      mesh.rotation.z = 0.409;
      const cloudMap = new THREE.TextureLoader().load("/textures/earth-clouds.png");
      const clouds = new THREE.Mesh(
        new THREE.SphereGeometry(data.radius * 1.008, 64, 48),
        new THREE.MeshStandardMaterial({ map: cloudMap, transparent: true, opacity: 0.6, depthWrite: false }),
      );
      group.add(clouds);
      this.spin.push(clouds);
      const sunLight = new THREE.PointLight(0xffffff, 2.7, 0, 0);
      this.roots.solar.add(sunLight);
      this.roots.solar.add(new THREE.AmbientLight(0x6688bb, 0.055));
      this.moon(group, 0.32, 4.2, 0xb5b0a7);
    }
    if (data.id === "jupiter")
      for (let i = 0; i < 4; i++) this.moon(group, 0.17 + i * 0.025, 6 + i * 1.4, 0xb1a392, i * 1.7);
    if (data.id === "saturn" || data.id === "uranus") this.rings(group, data.radius, data.id === "uranus");
    if (["earth", "miller", "mann", "edmunds", "sun"].includes(data.id)) {
      const corona = data.id === "sun";
      if (!corona) {
        const atmosphere = new THREE.Mesh(
          new THREE.SphereGeometry(data.radius * 1.025, 96, 64),
          new THREE.ShaderMaterial({
            vertexShader: vertex,
            transparent: true,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
            side: THREE.BackSide,
            uniforms: { color: { value: new THREE.Color(0x689dcc) } },
            fragmentShader: `varying vec3 vNormal;varying vec3 vWorld;uniform vec3 color;void main(){float f=abs(dot(normalize(vNormal),normalize(cameraPosition-vWorld)));gl_FragColor=vec4(color,f*exp(-f*15.)*3.);}`,
          }),
        );
        group.add(atmosphere);
      } else {
        const glowCanvas = document.createElement("canvas");
        glowCanvas.width = 256;
        glowCanvas.height = 256;
        const ctx = glowCanvas.getContext("2d")!,
          gradient = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
        gradient.addColorStop(0, "rgba(255,206,125,.65)");
        gradient.addColorStop(0.35, "rgba(255,177,70,.25)");
        gradient.addColorStop(0.6, "rgba(255,140,40,.06)");
        gradient.addColorStop(1, "rgba(255,120,20,0)");
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, 256, 256);
        const glow = new THREE.Sprite(
          new THREE.SpriteMaterial({
            map: new THREE.CanvasTexture(glowCanvas),
            blending: THREE.AdditiveBlending,
            depthWrite: false,
          }),
        );
        glow.scale.setScalar(data.radius * 5);
        group.add(glow);
      }
    }
  }
  private moon(group: THREE.Group, r: number, d: number, color: number, a = 0) {
    const pivot = new THREE.Group();
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(r, 28, 20),
      new THREE.ShaderMaterial({
        vertexShader: vertex,
        fragmentShader: worldFragment,
        uniforms: {
          uTime: { value: 0 },
          uKind: { value: 0 },
          uColor: { value: new THREE.Color(color) },
          uLight: { value: new THREE.Vector3() },
          uEarth: { value: this.earth },
          uStorm: { value: 0 },
        },
      }),
    );
    mesh.position.set(Math.cos(a) * d, 0.2, Math.sin(a) * d);
    pivot.add(mesh);
    group.add(pivot);
    this.spin.push(pivot);
  }
  private rings(group: THREE.Group, r: number, tilted: boolean) {
    const c = document.createElement("canvas");
    c.width = 1024;
    c.height = 1;
    const ctx = c.getContext("2d")!;
    for (let i = 0; i < 1024; i++) {
      const x = i / 1024;
      let v = 0.45 + 0.22 * Math.sin(i * 0.23) + 0.14 * Math.sin(i * 0.87) + 0.08 * Math.sin(i * 2.9);
      if (x > 0.53 && x < 0.58) v = 0.03; // Cassini division
      if (x < 0.12) v *= 0.35 + x * 5; // faint inner C ring
      ctx.fillStyle = `rgba(${205 + 20 * Math.sin(i * 0.05)},${185 + 12 * Math.sin(i * 0.07)},146,${Math.max(0, v)})`;
      ctx.fillRect(i, 0, 1, 1);
    }
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    const inner = tilted ? 1.7 : 1.24,
      outer = tilted ? 1.82 : 2.3;
    const geo = new THREE.RingGeometry(r * inner, r * outer, 256, 1);
    const p = geo.attributes.position,
      uv = geo.attributes.uv;
    for (let i = 0; i < p.count; i++)
      uv.setXY(i, (Math.hypot(p.getX(i), p.getY(i)) - r * inner) / (r * (outer - inner)), 0.5);
    const ring = new THREE.Mesh(
      geo,
      new THREE.MeshBasicMaterial({
        map: tex,
        transparent: true,
        opacity: tilted ? 0.3 : 0.85,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
    );
    ring.rotation.x = tilted ? 0.25 : 1.12;
    group.add(ring);
  }
  private addDebris(sector: Sector, inner: number, outer: number, count: number) {
    let seed = 733;
    const rand = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 4294967296;
    };
    const points = [];
    for (let i = 0; i < count; i++) {
      const a = rand() * Math.PI * 2,
        r = inner + (outer - inner) * rand();
      points.push(Math.cos(a) * r, (rand() - 0.5) * 3, Math.sin(a) * r);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(points, 3));
    this.roots[sector].add(
      new THREE.Points(
        geo,
        new THREE.PointsMaterial({ color: 0x948b80, size: 0.11, sizeAttenuation: true, transparent: true, opacity: 0.6 }),
      ),
    );
  }
  private body(id: string) {
    return this.bodies.find((b) => b.data.id === id);
  }
  open() {
    this.active = true;
    document.body.classList.add("exploring");
    this.root.hidden = false;
    this.placeAtStart();
    this.resize();
  }
  /** Beyond the wormhole from Saturn: the giant hangs behind the sphere. */
  private placeAtStart() {
    const s = this.ship;
    s.side = "solar";
    s.zone = null;
    const mouth = this.bridge.mouths.solar;
    const away = SATURN_OFFSET.clone().normalize();
    const side = new THREE.Vector3(0, 1, 0).cross(away).normalize();
    s.pos.copy(mouth).addScaledVector(away, 21).addScaledVector(side, 5).add(new THREE.Vector3(0, 2, 0));
    s.vel.set(0, 0, 0);
    s.ang.set(0, 0, 0);
    const look = new THREE.Matrix4().lookAt(s.pos, mouth.clone().addScaledVector(side, -2), new THREE.Vector3(0, 1, 0));
    s.quat.setFromRotationMatrix(look);
    this.camQuat.copy(s.quat);
    this.autopilot = null;
    this.selected = "wormhole";
    this.setCard("wormhole");
    this.setView("chase");
  }
  close() {
    this.active = false;
    this.autopilot = null;
    this.root.hidden = true;
    this.routes.close();
    this.controls.enabled = false;
    this.keys.clear();
    this.ambience?.flight(0, 0);
    document.body.classList.remove("exploring");
    this.exit();
  }
  resize() {
    if (this.active)
      this.renderer.setSize(
        Math.round(innerWidth * this.renderScale),
        Math.round(innerHeight * this.renderScale),
        false,
      );
    const size = this.renderer.getSize(new THREE.Vector2());
    this.composer.setSize(size.x, size.y);
    for (const cam of [this.camera, this.shipCamera]) {
      cam.aspect = innerWidth / innerHeight;
      cam.updateProjectionMatrix();
    }
  }
  private capture() {
    this.composer.render();
    this.renderer.domElement.toBlob((blob) => {
      if (!blob) return;
      const a = document.createElement("a"),
        url = URL.createObjectURL(blob);
      a.href = url;
      a.download = `endurance-${new Date().toISOString().replace(/[:.]/g, "-")}.png`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    });
  }
  private cycleView() {
    const order: View[] = ["chase", "hull", "cockpit"];
    this.setView(order[(order.indexOf(this.view) + 1) % order.length] ?? "chase");
  }
  private setView(view: View) {
    if (view === "orbit") {
      if (this.ship.zone || this.camZone) return;
      const b = this.body(this.selected);
      this.controls.target.copy(b ? b.group.position : this.bridge.mouths[this.camSide]);
      this.controls.minDistance = b ? b.data.radius * 1.1 : RZ * 1.02;
      this.controls.maxDistance = 1500;
      this.controls.enabled = true;
      this.controls.update();
    } else this.controls.enabled = false;
    this.view = view;
    document.getElementById("atlas-orbit")!.setAttribute("aria-pressed", String(view === "orbit"));
    document.getElementById("atlas-view")!.textContent = `View: ${viewNames[view === "orbit" ? "chase" : view]}`;
  }
  private setCard(id: string) {
    const b = this.body(id)?.data;
    document.getElementById("world-name")!.textContent = b?.name ?? "The wormhole";
    document.getElementById("world-subtitle")!.textContent = b?.subtitle ?? "A sphere. Not a hole.";
    document.getElementById("world-description")!.textContent =
      b?.description ??
      "You are looking at another galaxy, bent into a crystal ball. Light from the far side threads the throat and spills across the sphere; our own stars smear into a ring around it. Fly in.";
    document.getElementById("world-fact")!.textContent =
      b?.fact ??
      (this.camSide === "solar" ? "Near Saturn → Gargantua system" : "Gargantua system → Saturn, solar system");
    this.cardTimer = 9;
  }
  private go(id: string) {
    const b = this.body(id);
    if (!b || b.data.sector !== this.ship.side) return;
    this.selected = id;
    this.setCard(id);
    this.routes.close();
    this.keys.clear();
    this.autopilot = { kind: "body", id };
    if (this.view === "orbit") this.setView("chase");
  }
  private goWormhole() {
    this.routes.close();
    this.selected = "wormhole";
    this.setCard("wormhole");
    this.keys.clear();
    this.autopilot = { kind: "wormhole", phase: "approach" };
    if (this.view === "orbit") this.setView("chase");
  }
  private openMap() {
    this.keys.clear();
    const list = document.getElementById("route-list")!;
    list.innerHTML = "";
    const dots = document.getElementById("chart-dots")!;
    dots.innerHTML = "";
    const side = this.ship.side;
    for (const b of this.bodies.filter((b) => b.data.sector === side)) {
      const button = document.createElement("button");
      button.innerHTML = `<span>${b.data.name}</span><small>${b.data.subtitle}</small><span>↗</span>`;
      button.onclick = () => this.go(b.data.id);
      list.append(button);
      const r = (b.data.orbit / (side === "solar" ? 205 : 171)) * 205;
      const angle = Math.atan2(b.group.position.z, b.group.position.x);
      const x = 240 + Math.cos(angle) * r,
        y = 240 + Math.sin(angle) * r;
      dots.innerHTML += `<circle cx="${x}" cy="${y}" r="${b.data.orbit === 0 ? 9 : 4}" fill="#dec49a"/><text x="${x + 8}" y="${y + 4}" fill="#ccd5dd" font-size="11">${b.data.name}</text>`;
    }
    const portal = document.createElement("button");
    portal.innerHTML = "<span>◯ Wormhole</span><small>Autopilot through the bridge</small><span>↗</span>";
    portal.onclick = () => this.goWormhole();
    list.append(portal);
    document.getElementById("route-origin")!.textContent = side === "solar" ? "Solar system / Saturn" : "Gargantua";
    document.getElementById("route-other")!.textContent = side === "solar" ? "Gargantua" : "Solar system / Saturn";
    this.routes.showModal();
  }
  private updateOrbits() {
    for (const body of this.bodies) {
      if (!body.data.orbit) continue;
      const angle = body.data.angle + (this.elapsed * Math.PI * 2) / (2400 * periods[body.data.id]);
      body.group.position.set(Math.cos(angle) * body.data.orbit, 0, Math.sin(angle) * body.data.orbit);
    }
    this.bridge.mouths.solar.copy(this.body("saturn")!.group.position).add(SATURN_OFFSET);
  }
  /** Distance from a point to the nearest surface on a side (planets, star, horizon, throat). */
  private clearance(side: Side, pos: THREE.Vector3, mouthRadius = RHO) {
    let c = mouthRadius > 0 ? pos.distanceTo(this.bridge.mouths[side]) - mouthRadius : Infinity;
    for (const b of this.bodies) {
      if (b.data.sector !== side) continue;
      const r = b.data.id === "gargantua" ? 4.5 : b.data.id === "sun" ? b.data.radius * 1.4 : b.data.radius;
      c = Math.min(c, b.group.position.distanceTo(pos) - r);
    }
    return Math.max(c, 0.001);
  }
  private speedCap() {
    const s = this.ship;
    // Worlds slow you down in proportion to their distance; the bridge sets its own pace,
    // so passage through the throat takes a few unhurried seconds.
    let cap = THREE.MathUtils.clamp(this.clearance(s.side, s.pos, 0) * 0.45, 0.05, 260);
    const r = s.zone ? radiusAt(s.zone.l) : s.pos.distanceTo(this.bridge.mouths[s.side]);
    cap = Math.min(cap, 0.55 * r + 0.25);
    return cap;
  }
  private turnToward(dir: THREE.Vector3, dt: number, rate = 1) {
    const s = this.ship;
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(s.quat);
    const target = new THREE.Quaternion().setFromRotationMatrix(
      new THREE.Matrix4().lookAt(new THREE.Vector3(), dir, up),
    );
    const angle = s.quat.angleTo(target);
    s.quat.rotateTowards(target, Math.min(angle, (0.25 + angle * 1.1) * rate * dt));
    s.ang.multiplyScalar(Math.exp(-dt * 4));
    return angle;
  }
  private fly(dt: number) {
    const s = this.ship,
      k = this.keys;
    const boost = k.has("shift") ? 5 : 1;
    const cap = this.speedCap() * boost;
    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(s.quat);
    let thrust = 0,
      turning = 0;
    const ap = this.autopilot;
    if (ap && !this.paused) {
      const mouth = this.bridge.mouths[s.side];
      let dir = new THREE.Vector3(),
        speed = cap,
        faceOnly = false;
      if (ap.kind === "body") {
        const b = this.body(ap.id);
        if (!b || b.data.sector !== s.side) this.autopilot = null;
        else {
          const center = b.group.position;
          const standoffR = b.data.id === "gargantua" ? 26 : b.data.radius * (b.data.id === "saturn" ? 3.6 : b.data.id === "sun" ? 3 : 4.2);
          const from = s.pos.clone().sub(center).normalize();
          from.y = Math.max(from.y, 0.18);
          const goal = center.clone().addScaledVector(from.normalize(), standoffR);
          const offset = goal.sub(s.pos);
          const dist = offset.length();
          dir.copy(offset).normalize();
          speed = Math.min(cap, dist * 0.55 + 0.01);
          if (dist < Math.max(0.04, standoffR * 0.03) && s.vel.length() < 0.2 * cap) {
            this.autopilot = null;
            dir.copy(center).sub(s.pos).normalize();
            faceOnly = true;
          }
        }
      } else {
        const out = s.zone ? s.zone.n.clone() : s.pos.clone().sub(mouth).normalize();
        if (ap.phase === "approach") {
          dir.copy(out).negate();
          if (!s.zone) {
            // Line up on the throat from wherever we are.
            dir.copy(mouth).sub(s.pos).normalize();
          }
        } else if (ap.phase === "exit") {
          dir.copy(out);
          speed = cap * 0.8;
          if (!s.zone && s.pos.distanceTo(mouth) > RZ * 1.35) ap.phase = "settle";
        } else {
          // Come about to face the landmark of the new sky: Gargantua, or Saturn on the way home.
          const focus = s.side === "gargantua" ? new THREE.Vector3() : this.body("saturn")!.group.position;
          dir.copy(focus).sub(s.pos).normalize();
          speed = 0;
          if (s.vel.length() < 0.03 && forward.angleTo(dir) < 0.08) {
            this.autopilot = null;
            this.setCard(s.side === "gargantua" ? "gargantua" : "saturn");
          }
        }
      }
      if (this.autopilot || faceOnly) {
        const angle = this.turnToward(dir, dt, 1);
        turning = Math.min(1, angle * 2);
        if (!faceOnly) {
          const desired = dir.clone().multiplyScalar(angle < 0.6 ? speed : speed * 0.15);
          const before = s.vel.clone();
          s.vel.lerp(desired, 1 - Math.exp(-dt * 1.3));
          thrust = THREE.MathUtils.clamp(s.vel.clone().sub(before).dot(forward) / Math.max(cap * dt, 1e-6), -1, 1);
        } else s.vel.multiplyScalar(Math.exp(-dt * 2));
      }
    } else {
      // Manual flight: rate commands through a damped attitude controller.
      const steerX = this.steer ? THREE.MathUtils.clamp((this.steer.x - this.steer.x0) / (0.22 * Math.min(innerWidth, innerHeight)), -1, 1) : 0;
      const steerY = this.steer ? THREE.MathUtils.clamp((this.steer.y - this.steer.y0) / (0.22 * Math.min(innerWidth, innerHeight)), -1, 1) : 0;
      const yaw = Number(k.has("a") || k.has("arrowleft")) - Number(k.has("d") || k.has("arrowright")) - steerX;
      const pitch = Number(k.has("arrowdown")) - Number(k.has("arrowup")) - steerY;
      const roll = Number(k.has("q")) - Number(k.has("e"));
      const target = new THREE.Vector3(pitch * 0.75, yaw * 0.75, roll * 1.1);
      s.ang.lerp(target, 1 - Math.exp(-dt * 3.2));
      turning = Math.min(1, s.ang.length());
      const dq = new THREE.Quaternion().setFromEuler(new THREE.Euler(s.ang.x * dt, s.ang.y * dt, s.ang.z * dt, "YXZ"));
      s.quat.multiply(dq).normalize();
      thrust = Number(k.has("w")) - Number(k.has("s"));
      if (thrust) s.vel.addScaledVector(forward, thrust * Math.max(cap, 0.12) * 1.1 * dt);
      if (k.has("x")) s.vel.multiplyScalar(Math.exp(-dt * 2.4));
      else {
        // Flight assist trims sideways drift so the ship carries its momentum into turns.
        const along = forward.clone().multiplyScalar(s.vel.dot(forward));
        s.vel.sub(along).multiplyScalar(Math.exp(-dt * 0.9)).add(along);
      }
    }
    // Soft speed limit: slower near worlds and inside the bridge.
    const v = s.vel.length();
    if (v > cap) s.vel.setLength(THREE.MathUtils.damp(v, cap, 2.2, dt));
    s.thrust = THREE.MathUtils.damp(s.thrust, Math.abs(thrust), 6, dt);
    this.endurance.update(dt, thrust, turning, this.elapsed + performance.now() / 1000);

    // Integrate position: flat space outside the lens region, wormhole coordinates inside.
    const step = s.vel.clone().multiplyScalar(dt);
    if (!s.zone) {
      s.pos.add(step);
      s.zone = this.bridge.toZone(s.side, s.pos);
    }
    if (s.zone) {
      if (this.bridge.displace(s.zone, step, { vectors: [s.vel], quats: [s.quat, this.camQuat, this.lastQuat] })) {
        s.side = s.zone.side;
        this.crossings++;
        if (this.autopilot?.kind === "wormhole") this.autopilot.phase = "exit";
        this.cardTimer = 0;
      }
      this.bridge.position(s.zone, s.pos);
      if (s.zone.l >= L2) s.zone = null;
    }
    // Keep clear of solid bodies and the horizon.
    for (const b of this.bodies) {
      if (b.data.sector !== s.side) continue;
      const r = (b.data.id === "gargantua" ? 3.9 : b.data.id === "sun" ? b.data.radius * 1.15 : b.data.radius * 1.02) + SHIP_R * 1.5;
      const d = s.pos.clone().sub(b.group.position);
      if (d.length() < r) {
        const n = d.normalize();
        s.pos.copy(b.group.position).addScaledVector(n, r);
        const inward = s.vel.dot(n);
        if (inward < 0) s.vel.addScaledVector(n, -inward);
      }
    }
  }
  /** Place the world camera (possibly on the other side of the throat from the ship). */
  private placeCamera(dt: number) {
    const s = this.ship;
    if (this.view === "orbit") {
      this.camSide = s.side;
      this.camZone = null;
      this.controls.update();
      return;
    }
    const v = views[this.view];
    if (this.view === "chase") {
      // A lagging chase camera, like a second craft flying formation.
      this.camQuat.slerp(s.quat, 1 - Math.exp(-dt * 3.2));
    } else this.camQuat.copy(s.quat);
    const offset = v.offset.clone().multiplyScalar(this.view === "chase" ? this.zoom : 1);
    // Portrait screens are narrow: centre the chase camera and stand further back.
    const narrow = this.view === "chase" && innerWidth < 700;
    if (narrow) offset.set(0, offset.y * 1.6, offset.z * 1.8);
    const orient = this.camQuat.clone().multiply(narrow ? views.cockpit.tilt : v.tilt);
    // Buffeting inside the bridge.
    if (this.shake > 0.001) {
      const t = performance.now() / 1000;
      const j = this.shake;
      orient.multiply(
        new THREE.Quaternion().setFromEuler(
          new THREE.Euler(
            j * 0.006 * (Math.sin(t * 23) + 0.6 * Math.sin(t * 57)),
            j * 0.006 * Math.sin(t * 31 + 1),
            j * 0.012 * Math.sin(t * 3.1) + j * 0.004 * Math.sin(t * 41),
          ),
        ),
      );
    }
    // Ship-relative pose for the ship pass.
    this.shipPivot.quaternion.copy(s.quat);
    this.shipCamera.position.copy(offset).applyQuaternion(this.camQuat);
    this.shipCamera.quaternion.copy(orient);
    this.endurance.group.visible = this.view !== "cockpit";
    // World pose: carry the same displacement through the bridge if needed.
    const d = offset.clone().applyQuaternion(this.camQuat);
    const worldOrient = orient.clone();
    if (s.zone) {
      const z: ZonePoint = { side: s.zone.side, l: s.zone.l, n: s.zone.n.clone() };
      this.bridge.displace(z, d, { quats: [worldOrient] });
      this.camSide = z.side;
      this.camZone = z.l < L2 ? z : null;
      this.bridge.position(z, this.camera.position);
    } else {
      this.camSide = s.side;
      this.camera.position.copy(s.pos).add(d);
      this.camZone = this.bridge.toZone(this.camSide, this.camera.position);
    }
    this.camera.quaternion.copy(worldOrient);
  }
  private captureCubes(inside: boolean, angular: number) {
    // Our side's worlds are cheap to capture; Gargantua's sky is a full ray trace.
    const hi = this.renderScale >= 0.95;
    const want = (side: Side) => {
      const big = inside || angular > 0.25;
      if (side === "solar") return big ? 1024 : 512;
      return big ? (hi ? 768 : 512) : 256;
    };
    for (const [which, side] of [["local", this.camSide], ["remote", other(this.camSide)]] as const) {
      const size = want(side);
      if (this.cubes[which].target.width !== size) this.cubes[which].target.setSize(size, size);
    }
    this.cubeSize = this.cubes.local.target.width;
    this.cubeFrame++;
    const mouth = this.bridge.mouths[this.camSide];
    const rel = this.camera.position.clone().sub(mouth);
    const dist = Math.max(rel.length(), 1e-4);
    const mirrorPoint = rel
      .divideScalar(dist)
      .applyMatrix3(this.bridge.mirror)
      .multiplyScalar(Math.min(dist, RZ))
      .add(this.bridge.mouths[other(this.camSide)]);
    const jobs: [keyof typeof this.cubes, Side, THREE.Vector3][] = [];
    // Alternate the two captures; motion near the bridge is slow enough that a frame of lag is invisible.
    if (this.cubeFrame % 2 === 0) jobs.push(["local", this.camSide, this.camera.position]);
    else jobs.push(["remote", other(this.camSide), mirrorPoint]);
    const clearColor = this.renderer.getClearColor(new THREE.Color()),
      clearAlpha = this.renderer.getClearAlpha();
    this.renderer.setClearColor(0x000000, 0);
    this.lens.visible = false;
    for (const [which, side, point] of jobs) {
      this.roots.solar.visible = side === "solar";
      this.roots.gargantua.visible = side === "gargantua";
      // Our sky is added procedurally by the lens shader, so capture only its worlds.
      this.solarDome.visible = false;
      this.cubes[which].camera.position.copy(point);
      this.cubes[which].camera.updateMatrixWorld();
      this.cubes[which].camera.update(this.renderer, this.scene);
    }
    this.solarDome.visible = true;
    this.renderer.setClearColor(clearColor, clearAlpha);
  }
  update(dt: number) {
    if (!this.active) return;
    this.performanceTime += dt;
    this.performanceFrames++;
    if (this.performanceTime > 2) {
      this.fps = this.performanceFrames / this.performanceTime;
      const previous = this.renderScale;
      if (this.adaptiveQuality) {
        if (this.fps < 28) this.renderScale = Math.max(innerWidth < 700 ? 0.6 : 0.45, this.renderScale - 0.1);
        else if (this.fps > 55) this.renderScale = Math.min(1, this.renderScale + 0.05);
      }
      if (previous !== this.renderScale) this.resize();
      this.performanceTime = 0;
      this.performanceFrames = 0;
    }
    dt = Math.min(dt, 0.05);
    const step = this.paused ? 0 : dt;
    this.elapsed += step;
    const oldMouth = this.bridge.mouths.solar.clone();
    this.updateOrbits();
    // Anything parked in the flat region near Saturn's mouth rides along with it.
    if (!this.ship.zone && this.ship.side === "solar" && this.ship.pos.distanceTo(oldMouth) < RZ * 3)
      this.ship.pos.add(this.bridge.mouths.solar.clone().sub(oldMouth));
    for (const b of this.bodies) {
      b.material.uniforms.uTime.value = this.elapsed;
      if (b.data.kind !== 5) b.mesh.rotation.y += step * 0.025;
    }
    for (const o of this.spin) o.rotation.y += step * 0.04;
    (this.blackDome.material as THREE.ShaderMaterial).uniforms.uTime.value = this.elapsed;

    if (!this.routes.open) this.fly(dt);
    const z = this.ship.zone;
    const nearThroat = z ? 1 - THREE.MathUtils.smoothstep(z.l, A * 0.5, L1 * 1.1) : 0;
    this.shake = THREE.MathUtils.damp(this.shake, nearThroat * Math.min(1, this.ship.vel.length() / 1.2 + 0.25), 3, dt);
    this.ambience?.flight(this.ship.thrust, this.shake);
    this.placeCamera(dt);

    // World visibility follows the camera's side of the bridge.
    const side = this.camSide;
    if (side !== this.sector) {
      this.sector = side;
      document.getElementById("sector-name")!.textContent = side === "solar" ? "Solar system" : "Gargantua system";
    }
    this.roots.solar.visible = side === "solar";
    this.roots.gargantua.visible = side === "gargantua";
    this.lens.position.copy(this.bridge.mouths[side]);
    this.camera.updateMatrixWorld();
    // Inside the lens region the sphere is drawn without depth, so only worlds limit the near plane.
    const camClear =
      this.view === "orbit"
        ? this.camera.position.distanceTo(this.controls.target) * 0.5
        : this.clearance(side, this.camera.position, this.camZone ? 0 : RZ);
    this.camera.near = THREE.MathUtils.clamp(camClear * 0.3, 0.004, 2);
    this.camera.updateProjectionMatrix();
    this.shipCamera.fov = this.camera.fov;
    this.shipCamera.updateProjectionMatrix();

    // Lens: inside the region we trace from the camera; outside we trace from the sphere.
    const inside = !!this.camZone;
    const frustum = new THREE.Frustum().setFromProjectionMatrix(
      new THREE.Matrix4().multiplyMatrices(this.camera.projectionMatrix, this.camera.matrixWorldInverse),
    );
    const mouth = this.bridge.mouths[side];
    const angular = RZ / Math.max(this.camera.position.distanceTo(mouth), RZ);
    const lensOn = inside || (frustum.intersectsSphere(new THREE.Sphere(mouth, RZ)) && angular > 0.004);
    const u = this.lensMaterial.uniforms;
    if (lensOn) {
      this.captureCubes(inside, angular);
      u.uMouth.value.copy(mouth);
      u.uInside.value = inside ? 1 : 0;
      if (this.camZone) {
        u.uCamN.value.copy(this.camZone.n);
        u.uCamL.value = this.camZone.l;
        u.uCamR.value = radiusAt(this.camZone.l);
      }
      u.uLocalSolar.value = side === "solar" ? 1 : 0;
      u.uRemoteSolar.value = side === "solar" ? 0 : 1;
      this.lensMaterial.side = inside ? THREE.BackSide : THREE.FrontSide;
      this.lensMaterial.depthTest = !inside;
    }
    this.roots.solar.visible = side === "solar";
    this.roots.gargantua.visible = side === "gargantua";
    this.lens.visible = lensOn;

    // Ship lighting from the local star or the disk, dimmed deep in the throat.
    const lightSource = this.ship.side === "solar" ? new THREE.Vector3() : new THREE.Vector3(0, 0.5, 0);
    const toLight = lightSource.sub(this.ship.pos).normalize();
    this.keyLight.position.copy(toLight);
    this.keyLight.target.position.set(0, 0, 0);
    const throatDim = z ? THREE.MathUtils.smoothstep(z.l, 0, L1) * 0.8 + 0.2 : 1;
    this.keyLight.color.set(this.ship.side === "solar" ? 0xfff3e2 : 0xffc98a);
    this.keyLight.intensity = (this.ship.side === "solar" ? 3.2 : 2.4) * throatDim;
    this.fillLight.intensity = 0.2 * throatDim + 0.05;
    // Soft light from the camera side, like reflected light from the other craft.
    this.camLight.position.copy(this.shipCamera.position).normalize().add(new THREE.Vector3(0, 0.6, 0));
    this.updateDust(dt);
    this.shipPivot.visible = this.view !== "orbit";

    this.composer.render();
    this.updateHud(dt);
  }
  private lastQuat = new THREE.Quaternion();
  private updateDust(dt: number) {
    const s = this.ship;
    const speed = s.vel.length();
    const box = THREE.MathUtils.clamp(this.speedCap() * 0.9, 0.12, 60);
    const inv = s.quat.clone().invert();
    const vb = s.vel.clone().applyQuaternion(inv);
    // Rotation of the ship this frame, expressed in the body frame.
    const dq = this.lastQuat.clone().invert().multiply(s.quat);
    if (dq.w < 0.5) dq.identity();
    const dqi = dq.clone().invert();
    this.lastQuat.copy(s.quat);
    const pos = this.dust.geometry.attributes.position as THREE.BufferAttribute;
    const u = this.dustUnit;
    const tmp = new THREE.Vector3();
    const streak = vb.clone().multiplyScalar(0.03 / box);
    for (let i = 0; i < u.length; i += 3) {
      tmp.set(u[i], u[i + 1], u[i + 2]).addScaledVector(vb, -dt / box).applyQuaternion(dqi);
      tmp.set(((tmp.x + 1.5) % 1) - 0.5, ((tmp.y + 1.5) % 1) - 0.5, ((tmp.z + 1.5) % 1) - 0.5);
      u[i] = tmp.x;
      u[i + 1] = tmp.y;
      u[i + 2] = tmp.z;
      pos.setXYZ((i / 3) * 2, tmp.x * box, tmp.y * box, tmp.z * box);
      pos.setXYZ((i / 3) * 2 + 1, (tmp.x - streak.x) * box, (tmp.y - streak.y) * box, (tmp.z - streak.z) * box);
    }
    pos.needsUpdate = true;
    // The dust box follows the ship's body frame, so undo the pivot rotation.
    this.dust.quaternion.identity();
    const m = this.dust.material as THREE.LineBasicMaterial;
    m.opacity = THREE.MathUtils.damp(m.opacity, THREE.MathUtils.clamp((speed / box - 0.2) * 0.3, 0, this.view === "cockpit" ? 0.1 : 0.2), 4, dt);
  }
  private updateHud(dt: number) {
    const s = this.ship;
    this.cardTimer = Math.max(0, this.cardTimer - dt);
    this.root.classList.toggle("card-hidden", this.cardTimer <= 0);
    this.root.classList.toggle("in-bridge", !!this.camZone && this.camZone.l < L1);
    // 1 world unit ≈ 0.91 km at the ship's scale (the Endurance ring is 64 m across).
    const kmPerUnit = 0.064 / (SHIP_R * 2);
    document.getElementById("hud-speed")!.textContent = (s.vel.length() * kmPerUnit).toFixed(s.vel.length() * kmPerUnit < 10 ? 2 : 0);
    (document.getElementById("hud-throttle") as HTMLElement).style.width = `${Math.round(s.thrust * 100)}%`;
    const mouthDist = s.zone ? Math.max(0, s.zone.l) : s.pos.distanceTo(this.bridge.mouths[s.side]) - RHO;
    document.getElementById("hud-range-label")!.textContent = s.zone && s.zone.l < A ? "Inside throat" : "To throat";
    document.getElementById("hud-range")!.textContent = (mouthDist * kmPerUnit).toFixed(mouthDist * kmPerUnit < 100 ? 1 : 0);
    document.getElementById("hud-range-unit")!.textContent = "km";
    const target = this.body(this.selected);
    const d = target ? s.pos.distanceTo(target.group.position) : mouthDist + RHO;
    document.getElementById("atlas-distance")!.textContent =
      target && target.data.sector === s.side
        ? `${(d / target.data.radius).toFixed(1)} radii from ${target.data.name}`
        : `${(mouthDist / RHO).toFixed(1)} throat radii from the bridge`;
    const ap = this.autopilot;
    document.getElementById("atlas-state")!.textContent = this.paused
      ? "TIME PAUSED · FLIGHT AVAILABLE"
      : s.zone && s.zone.l < L1
        ? "BRIDGE TRANSIT · EINSTEIN–ROSEN THROAT"
        : ap?.kind === "wormhole"
          ? "AUTOPILOT · COURSE FOR THE WORMHOLE"
          : ap?.kind === "body"
            ? `AUTOPILOT · APPROACHING ${this.body(ap.id)?.data.name.toUpperCase() ?? ""}`
            : this.view === "orbit"
              ? "ORBITAL OBSERVATION"
              : "MANUAL FLIGHT · THRUSTERS ONLINE";
    for (const [id, label] of this.labels) {
      const b = this.body(id);
      const pos = id === "wormhole" ? this.bridge.mouths[this.camSide] : b!.group.position;
      const p = pos.clone().project(this.camera);
      const line = pos.clone().sub(this.camera.position),
        length = line.length();
      line.normalize();
      const occluded = this.bodies.some((o) => {
        if (o.data.id === id || o.data.sector !== this.camSide) return false;
        const rel = o.group.position.clone().sub(this.camera.position),
          along = rel.dot(line);
        return along > 0 && along < length && rel.lengthSq() - along * along < o.data.radius * o.data.radius;
      });
      const visible =
        !occluded &&
        !this.camZone &&
        (id === "wormhole" || b!.data.sector === this.camSide) &&
        p.z < 1 &&
        p.z > -1 &&
        Math.abs(p.x) < 0.94 &&
        Math.abs(p.y) < 0.83;
      label.hidden = !visible;
      if (visible) {
        label.style.left = `${(p.x * 0.5 + 0.5) * innerWidth}px`;
        label.style.top = `${(-p.y * 0.5 + 0.5) * innerHeight}px`;
      }
    }
  }
}
