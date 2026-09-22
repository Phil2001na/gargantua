import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import worldFragment from "./shaders/world.frag?raw";
import blackHoleFragment from "./shaders/blackhole.frag?raw";
import "./atlas.css";

type Sector = "gargantua" | "solar";
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
    radius: 3.5,
    orbit: 124,
    angle: 3.25,
    color: 0xdac796,
    kind: 1,
    subtitle: "The doorway home",
    description:
      "Icy rings encircle the pale gas giant. Nearby, a spherical distortion marks the route to Gargantua: the wormhole can be crossed in either direction.",
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
type Body = {
  data: World;
  mesh: THREE.Mesh;
  group: THREE.Group;
  material: THREE.ShaderMaterial;
};
export class Atlas {
  active = false;
  sector: Sector = "gargantua";
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(48, 1, 0.015, 6000);
  private controls: OrbitControls;
  private composer: EffectComposer;
  private bodies: Body[] = [];
  private roots = { gargantua: new THREE.Group(), solar: new THREE.Group() };
  private portal = new THREE.Mesh();
  private selected = "miller";
  private travel: {
    from: THREE.Vector3;
    to: THREE.Vector3;
    lookFrom: THREE.Vector3;
    lookTo: THREE.Vector3;
    t: number;
    duration: number;
    enter?: boolean;
  } | null = null;
  private crossing = -1;
  private elapsed = 0;
  private renderScale = .65;
  private adaptiveQuality = true;
  private performanceTime = 0;
  private performanceFrames = 0;
  private paused = false;
  private flight = false;
  private keys = new Set<string>();
  private pointer: { x: number; y: number } | null = null;
  private root: HTMLElement;
  private routes: HTMLDialogElement;
  private labels = new Map<string, HTMLButtonElement>();
  private spin: THREE.Object3D[] = [];
  private ringPaths = new THREE.Group();
  private manualCooldown = 0;
  private earth: THREE.Texture;
  private portalMaterial: THREE.ShaderMaterial;
  private blackSky: THREE.Mesh;
  private tunnel: THREE.Mesh;
  constructor(
    private renderer: THREE.WebGLRenderer,
    sky: THREE.Texture,
    private exit: () => void,
  ) {
    this.earth = new THREE.TextureLoader().load("/textures/earth.jpg");
    this.earth.colorSpace = THREE.SRGBColorSpace;
    const background = sky.clone();
    background.mapping = THREE.EquirectangularReflectionMapping;
    background.needsUpdate = true;
    this.scene.background = background;
    this.scene.add(this.roots.gargantua, this.roots.solar, this.ringPaths);
    this.controls = new OrbitControls(this.camera, renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.enablePan = false;
    this.controls.enabled = false;
    this.controls.minDistance = 0.1;
    this.controls.maxDistance = 1000;
    this.composer = new EffectComposer(renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.composer.addPass(
      new UnrealBloomPass(new THREE.Vector2(1, 1), 0.35, 0.5, 1.1),
    );
    this.composer.addPass(new OutputPass());
    for (const data of worlds) this.createBody(data);
    this.addDebris("solar", 70, 79, 1400);
    this.addDebris("solar", 225, 270, 1800);
    this.addDebris("gargantua", 185, 215, 1100);
    const screenVertex =
      "varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,1.,1.);}";
    this.blackSky = new THREE.Mesh(
      new THREE.PlaneGeometry(2, 2),
      new THREE.ShaderMaterial({
        vertexShader: screenVertex,
        fragmentShader: blackHoleFragment,
        depthWrite: false,
        depthTest: false,
        uniforms: {
          uResolution: { value: new THREE.Vector2() },
          uCamera: { value: new THREE.Vector3() },
          uBasis: { value: new THREE.Matrix3() },
          uFov: { value: THREE.MathUtils.degToRad(48) },
          uTime: { value: 0 },
          uExposure: { value: 1 },
          uDisk: { value: 1 },
          uLensing: { value: 1 },
          uDoppler: { value: 1 },
          uDust: { value: 1 },
          uSky: { value: sky },
        },
      }),
    );
    this.blackSky.frustumCulled = false;
    this.blackSky.renderOrder = -100;
    this.scene.add(this.blackSky);
    this.tunnel = new THREE.Mesh(
      new THREE.PlaneGeometry(2, 2),
      new THREE.ShaderMaterial({
        vertexShader: screenVertex,
        depthTest: false,
        depthWrite: false,
        uniforms: {
          uTime: { value: 0 },
          uAspect: { value: 1 },
          uSky: { value: sky },
        },
        fragmentShader: `varying vec2 vUv;uniform float uTime;uniform float uAspect;uniform sampler2D uSky;void main(){vec2 p=(vUv-.5)*2.;p.x*=uAspect;float r=length(p),a=atan(p.y,p.x);float z=1./max(r,.025);vec2 uv=vec2(a/6.283185+uTime*.06,z*.065-uTime*.24);vec3 sky=texture2D(uSky,vec2(fract(uv.x),fract(uv.y))).rgb;float filaments=pow(.5+.5*sin(a*80.+sin(z*2.-uTime*6.)),24.);float rings=pow(.5+.5*sin(z*5.-uTime*13.),18.);vec3 color=sky*(1.+r)+vec3(.18,.33,.55)*filaments*.7+vec3(.26,.42,.65)*rings*.2;float core=exp(-r*r*45.);color+=vec3(.8,.9,1.)*core*(.2+uTime*.12);gl_FragColor=vec4(color,1.);}`,
      }),
    );
    this.tunnel.frustumCulled = false;
    this.tunnel.renderOrder = 100;
    this.tunnel.visible = false;
    this.scene.add(this.tunnel);
    this.portalMaterial = new THREE.ShaderMaterial({
      vertexShader: vertex,
      uniforms: {
        uSky: { value: sky },
        uTime: { value: 0 },
        uSolar: { value: 0 },
      },
      fragmentShader: `
   varying vec3 vNormal;varying vec3 vWorld;varying vec3 vLocal;varying vec2 vUv;uniform sampler2D uSky;uniform float uTime;uniform float uSolar;
   vec3 sampleSky(vec3 d){return texture2D(uSky,vec2(atan(d.z,d.x)/6.283185+.5,asin(clamp(d.y,-1.,1.))/3.141593+.5)).rgb;}
   void main(){vec3 n=normalize(vNormal),e=normalize(vWorld-cameraPosition);float facing=abs(dot(n,-e));vec3 d=reflect(e,n);d=normalize(mix(d,refract(e,n,.42),.6));float swirl=.12*sin(uTime*.15+facing*14.);d.xz=mat2(cos(swirl),-sin(swirl),sin(swirl),cos(swirl))*d.xz;vec3 c=sampleSky(d)*1.4;float star=pow(max(dot(d,normalize(vec3(.3,.15,-1.))),0.),180.);c+=vec3(1.,.72,.32)*star*5.;if(uSolar>.5){float disk=exp(-abs(d.y+.05)*85.)*exp(-pow(d.x*2.,2.));float hole=1.-smoothstep(.11,.15,length(d.xy));c=c*(1.-hole)+vec3(1.,.48,.12)*disk*(1.-hole)*2.;}float rim=pow(1.-facing,5.);gl_FragColor=vec4(c+vec3(.3,.6,.9)*rim*.8,1.);}`,
    });
    this.portal = new THREE.Mesh(
      new THREE.SphereGeometry(3.2, 80, 64),
      this.portalMaterial,
    );
    this.scene.add(this.portal);
    this.root = document.createElement("section");
    this.root.className = "atlas-ui";
    this.root.hidden = true;
    this.root.innerHTML = `<header class="atlas-top"><div><span class="micro">ENDURANCE / NAVIGATION</span><h1 id="sector-name">Gargantua system</h1></div><div class="atlas-tools"><button id="atlas-map">Route chart <kbd>Tab</kbd></button><button id="atlas-exit">Black hole observatory</button></div></header><div id="world-labels"></div><article class="world-card"><div class="micro" id="world-subtitle"></div><h2 id="world-name"></h2><p id="world-description"></p><div id="world-fact"></div></article><div class="crossing-caption" role="status"></div><footer class="atlas-bottom"><div class="atlas-readout"><span class="micro" id="atlas-state">Orbital observation</span><strong id="atlas-distance"></strong><small>Exploration scale · sizes and distances compressed</small></div><div class="atlas-actions"><button id="atlas-orbit" aria-pressed="true">Orbit</button><button id="atlas-flight" aria-pressed="false">Pilot ship</button><button id="atlas-wormhole">Set course: wormhole</button><button id="atlas-pause" aria-label="Pause atlas">Pause</button></div><div class="atlas-hint">Drag to look / orbit · Scroll to approach · WASD + QE to fly · Shift boost · H hide · F fullscreen</div><div class="atlas-touch"><button data-thrust="w" aria-label="Thrust forward">Forward</button><button data-thrust="s" aria-label="Thrust backward">Reverse</button></div></footer>`;
    document.body.append(this.root);
    const quality = document.createElement('select'); quality.setAttribute('aria-label','Atlas render quality');
    quality.innerHTML='<option value="auto">Adaptive quality</option><option value="high">Cinematic quality</option><option value="low">Performance quality</option>';
    quality.onchange=()=>{this.adaptiveQuality=quality.value==='auto';this.renderScale=quality.value==='high'?1:quality.value==='low'?.5:.65;this.resize();};
    this.root.querySelector('.atlas-tools')!.prepend(quality);
    const restore = document.createElement('button');
    restore.className = 'atlas-restore'; restore.textContent = 'Show controls';
    restore.onclick = () => this.root.classList.remove('atlas-clean'); this.root.append(restore);
    for (const [id, title, target] of [
      ["atlas-sound", "Sound", "audio"],
      ["atlas-photo", "Save image", "capture"],
    ]) {
      const b = document.createElement("button");
      b.id = id;
      b.textContent = title;
      b.onclick = () => {
        document.getElementById(target)!.click();
      };
      if(target==='audio'){
        const source=document.getElementById('audio')!;
        const sync=()=>{const enabled=source.getAttribute('aria-pressed')==='true';b.textContent=enabled?'Mute':'Sound';b.setAttribute('aria-pressed',String(enabled));};
        new MutationObserver(sync).observe(source,{attributes:true,attributeFilter:['aria-pressed']});sync();
      }
      this.root.querySelector(".atlas-tools")!.prepend(b);
    }
    this.routes = document.createElement("dialog");
    this.routes.className = "route-chart";
    this.routes.innerHTML = `<header><div><div class="micro">TWO SKIES. ONE JOURNEY.</div><h2>Find your next world.</h2></div><button id="close-routes" aria-label="Close route chart">✕</button></header><p>Choose a destination in your current system. Cross the wormhole to reach the other side.</p><div class="route-layout"><div class="chart-art" aria-hidden="true"><svg viewBox="0 0 480 480"><g fill="none" stroke="currentColor" opacity=".22"><circle cx="240" cy="240" r="45"/><circle cx="240" cy="240" r="78"/><circle cx="240" cy="240" r="115"/><circle cx="240" cy="240" r="155"/><circle cx="240" cy="240" r="207"/><path d="M0 240h480M240 0v480" stroke-dasharray="3 8"/></g><g id="chart-dots"></g></svg><span>SCHEMATIC · NOT TO SCALE</span></div><div id="route-list"></div></div><div class="route-bridge"><span id="route-origin">Gargantua</span><span>◯ ─── Einstein–Rosen bridge ─── ◯</span><span id="route-other">Solar system / Saturn</span></div><p class="route-note">Solar facts: NASA. Lazarus worlds and wormhole are fiction. This is a cinematic reconstruction, not an ephemeris or a physically validated wormhole model.</p>`;
    document.body.append(this.routes);
    const $ = (id: string) => document.getElementById(id)!;
    $("atlas-map").onclick = () => this.openMap();
    $("close-routes").onclick = () => this.routes.close();
    $("atlas-exit").onclick = () => this.close();
    $("atlas-wormhole").onclick = () => this.goWormhole();
    $("atlas-orbit").onclick = () => this.setFlight(false);
    $("atlas-flight").onclick = () => this.setFlight(true);
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
    renderer.domElement.addEventListener("pointerdown", (e) => {
      if (this.active && this.flight) {
        this.pointer = { x: e.clientX, y: e.clientY };
        renderer.domElement.setPointerCapture(e.pointerId);
      }
    });
    renderer.domElement.addEventListener("pointermove", (e) => {
      if (!this.active || !this.flight || !this.pointer) return;
      const rot = new THREE.Euler().setFromQuaternion(
        this.camera.quaternion,
        "YXZ",
      );
      rot.y -= (e.clientX - this.pointer.x) * 0.003;
      rot.x = THREE.MathUtils.clamp(
        rot.x - (e.clientY - this.pointer.y) * 0.003,
        -1.5,
        1.5,
      );
      this.camera.quaternion.setFromEuler(rot);
      this.pointer = { x: e.clientX, y: e.clientY };
    });
    for (const event of ["pointerup", "pointercancel", "lostpointercapture"])
      renderer.domElement.addEventListener(event, () => (this.pointer = null));
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
      if (k === "h") this.root.classList.toggle("atlas-clean");
      if (k === "f") {
        if (document.fullscreenElement) void document.exitFullscreen();
        else void document.documentElement.requestFullscreen();
      }
      if ("wasdqe".includes(k) && k.length === 1) {
        e.preventDefault();
        if (!this.travel && this.crossing < 0) this.setFlight(true);
        this.keys.add(k);
      }
      if (k === "shift") this.keys.add(k);
      if (k === " ") {
        e.preventDefault();
        if (!e.repeat) $("atlas-pause").click();
      }
    });
    window.addEventListener("keyup", (e) =>
      this.keys.delete(e.key.toLowerCase()),
    );
    window.addEventListener("blur", () => {
      this.keys.clear();
      this.pointer = null;
    });
    this.root
      .querySelectorAll<HTMLButtonElement>("[data-thrust]")
      .forEach((b) => {
        b.onpointerdown = (e) => {
          e.preventDefault();
          this.setFlight(true);
          this.keys.add(b.dataset.thrust!);
          b.setPointerCapture(e.pointerId);
        };
        b.onpointerup =
          b.onpointercancel =
          b.onlostpointercapture =
            () => this.keys.delete(b.dataset.thrust!);
      });
    Object.defineProperty(window, "interstellar", {
      get: () => ({
        active: this.active,
        sector: this.sector,
        selected: this.selected,
        traveling: !!this.travel,
        crossing: this.crossing,
        paused: this.paused,
        time: this.elapsed,
        flight: this.flight,
        position: this.camera.position.toArray(),
        worlds: this.bodies
          .filter((b) => b.data.sector === this.sector)
          .map((b) => b.data.id),
        portalDistance: this.camera.position.distanceTo(this.portal.position),
      }),
    });
  }
  private createBody(data: World) {
    const group = new THREE.Group();
    group.position.set(
      Math.cos(data.angle) * data.orbit,
      0,
      Math.sin(data.angle) * data.orbit,
    );
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
      },
    });
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(data.radius, 80, 56),
      material,
    );
    group.add(mesh);
    if (data.id === "gargantua") mesh.visible = false;
    this.bodies.push({ data, mesh, group, material });
    if (data.id === "earth") {
      mesh.rotation.z = 0.409;
      const cloudMap = new THREE.TextureLoader().load(
        "/textures/earth-clouds.png",
      );
      const clouds = new THREE.Mesh(
        new THREE.SphereGeometry(data.radius * 1.008, 64, 48),
        new THREE.MeshStandardMaterial({
          map: cloudMap,
          transparent: true,
          opacity: 0.6,
          depthWrite: false,
        }),
      );
      group.add(clouds);
      this.spin.push(clouds);
      const sunLight = new THREE.PointLight(0xffffff, 2.7, 0, 0);
      this.roots.solar.add(sunLight);
      this.roots.solar.add(new THREE.AmbientLight(0x6688bb, 0.055));
      this.moon(group, 0.32, 4.2, 0xb5b0a7);
    }
    if (data.id === "jupiter")
      for (let i = 0; i < 4; i++)
        this.moon(group, 0.17 + i * 0.025, 6 + i * 1.4, 0xb1a392, i * 1.7);
    if (data.id === "saturn" || data.id === "uranus")
      this.rings(group, data.radius, data.id === "uranus");
    if (["earth", "miller", "mann", "edmunds", "sun"].includes(data.id)) {
      const corona = data.id === "sun";
      const atmosphere = new THREE.Mesh(
        new THREE.SphereGeometry(data.radius * (corona ? 1.3 : 1.025), 96, 64),
        new THREE.ShaderMaterial({
          vertexShader: vertex,
          transparent: true,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
          side: THREE.BackSide,
          uniforms: {
            color: { value: new THREE.Color(corona ? 0xffac42 : 0x689dcc) },
          },
          fragmentShader: `varying vec3 vNormal;varying vec3 vWorld;uniform vec3 color;void main(){float f=abs(dot(normalize(vNormal),normalize(cameraPosition-vWorld)));gl_FragColor=vec4(color,f*exp(-f*${corona ? "8." : "15."})*${corona ? "1.8" : "3.0"});}`,
        }),
      );
      if(!corona)group.add(atmosphere);
      else {
        const glowCanvas=document.createElement('canvas');glowCanvas.width=256;glowCanvas.height=256;
        const ctx=glowCanvas.getContext('2d')!, gradient=ctx.createRadialGradient(128,128,0,128,128,128);
        gradient.addColorStop(0,'rgba(255,206,125,.65)');gradient.addColorStop(.35,'rgba(255,177,70,.25)');gradient.addColorStop(.6,'rgba(255,140,40,.06)');gradient.addColorStop(1,'rgba(255,120,20,0)');ctx.fillStyle=gradient;ctx.fillRect(0,0,256,256);
        const glow=new THREE.Sprite(new THREE.SpriteMaterial({map:new THREE.CanvasTexture(glowCanvas),blending:THREE.AdditiveBlending,depthWrite:false}));glow.scale.setScalar(data.radius*5);group.add(glow);
      }
    }
  }
  private moon(group: THREE.Group, r: number, d: number, color: number, a = 0) {
    const pivot = new THREE.Group();
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(r, 28, 20),
      new THREE.ShaderMaterial({vertexShader:vertex,fragmentShader:worldFragment,uniforms:{uTime:{value:0},uKind:{value:0},uColor:{value:new THREE.Color(color)},uLight:{value:new THREE.Vector3()},uEarth:{value:this.earth}}}),
    );
    mesh.position.set(Math.cos(a) * d, 0.2, Math.sin(a) * d);
    pivot.add(mesh);
    group.add(pivot);
    this.spin.push(pivot);
  }
  private rings(group: THREE.Group, r: number, tilted: boolean) {
    const c = document.createElement("canvas");
    c.width = 512;
    c.height = 1;
    const ctx = c.getContext("2d")!;
    for (let i = 0; i < 512; i++) {
      const v = 0.45 + 0.25 * Math.sin(i * 0.45) + 0.16 * Math.sin(i * 1.7);
      ctx.fillStyle = `rgba(205,185,146,${i > 265 && i < 290 ? 0.04 : v})`;
      ctx.fillRect(i, 0, 1, 1);
    }
    const tex = new THREE.CanvasTexture(c);
    const inner = tilted ? 1.7 : 1.3, outer = tilted ? 1.82 : 2.3;
    const geo = new THREE.RingGeometry(r * inner, r * outer, 192, 1);
    const p = geo.attributes.position,
      uv = geo.attributes.uv;
    for (let i = 0; i < p.count; i++)
      uv.setXY(i, (Math.hypot(p.getX(i), p.getY(i)) - r * inner) / (r*(outer-inner)), 0.5);
    const ring = new THREE.Mesh(
      geo,
      new THREE.MeshBasicMaterial({
        map: tex,
        transparent: true,
        opacity: tilted ? 0.3 : 0.8,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
    );
    ring.rotation.x = tilted ? 0.25 : 1.12;
    group.add(ring);
  }
  private addBlackHole() {
    const root = this.roots.gargantua;
    const hole = new THREE.Mesh(
      new THREE.SphereGeometry(12, 64, 48),
      new THREE.MeshBasicMaterial({ color: 0x000000 }),
    );
    root.add(hole);
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(15, 46, 160, 10),
      new THREE.ShaderMaterial({
        side: THREE.DoubleSide,
        transparent: true,
        depthWrite: false,
        vertexShader: vertex,
        fragmentShader: `varying vec3 vLocal;void main(){float r=length(vLocal.xy),a=atan(vLocal.y,vLocal.x);float f=.7+.2*sin(r*5.+sin(a*8.))+.1*sin(r*19.+a*4.);float edge=smoothstep(15.,18.,r)*(1.-smoothstep(32.,46.,r));gl_FragColor=vec4(mix(vec3(2.,1.5,.8),vec3(.8,.2,.035),(r-15.)/31.)*f,edge);}`,
      }),
    );
    ring.rotation.x = Math.PI / 2;
    root.add(ring);
    const halo = new THREE.Mesh(
      new THREE.TorusGeometry(13.2, 0.23, 12, 160),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 1.7, 0.7) }),
    );
    halo.name = "photon-halo";
    root.add(halo);
  }
  private addDebris(
    sector: Sector,
    inner: number,
    outer: number,
    count: number,
  ) {
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
        new THREE.PointsMaterial({
          color: 0x948b80,
          size: 0.11,
          sizeAttenuation: true,
          transparent: true,
          opacity: 0.6,
        }),
      ),
    );
  }
  open() {
    this.active = true;
    document.body.classList.add("exploring");
    this.root.hidden = false;
    this.sector = "gargantua";
    this.configureSector();
    this.go("miller", true);
    this.resize();
  }
  close() {
    this.active = false;
    this.travel = null;
    this.crossing = -1;
    this.root.hidden = true;
    this.routes.close();
    this.controls.enabled = false;
    this.keys.clear();
    document.body.classList.remove("exploring");
    this.exit();
  }
  resize() {
    if(this.active)this.renderer.setSize(Math.round(innerWidth*this.renderScale),Math.round(innerHeight*this.renderScale),false);
    const size = this.renderer.getSize(new THREE.Vector2());
    this.composer.setSize(size.x, size.y);
    this.camera.aspect = innerWidth / innerHeight;
    this.camera.updateProjectionMatrix();
  }
  private configureSector() {
    this.roots.gargantua.visible = this.sector === "gargantua";
    this.roots.solar.visible = this.sector === "solar";
    this.portalMaterial.uniforms.uSolar.value = this.sector === "solar" ? 1 : 0;
    const saturn = this.bodies.find((b) => b.data.id === "saturn")!.group
      .position;
    this.portal.position.copy(
      this.sector === "solar"
        ? saturn.clone().add(new THREE.Vector3(15, 3, 12))
        : new THREE.Vector3(128, 8, -94),
    );
    document.getElementById("sector-name")!.textContent =
      this.sector === "solar" ? "Solar system" : "Gargantua system";
    document.getElementById("atlas-wormhole")!.textContent =
      "Set course: wormhole";
  }
  private setFlight(value: boolean) {
    this.flight = value;
    this.controls.enabled =
      this.active && !value && !this.travel && this.crossing < 0;
    if (!value) {
      const body = this.bodies.find((b) => b.data.id === this.selected);
      this.controls.target.copy(
        this.selected === "wormhole"
          ? this.portal.position
          : body!.group.position,
      );
      this.controls.update();
    }
    document
      .getElementById("atlas-orbit")!
      .setAttribute("aria-pressed", String(!value));
    document
      .getElementById("atlas-flight")!
      .setAttribute("aria-pressed", String(value));
  }
  private setCard(id: string) {
    const b = this.bodies.find((b) => b.data.id === id)?.data;
    document.getElementById("world-name")!.textContent =
      b?.name ?? "The wormhole";
    document.getElementById("world-subtitle")!.textContent =
      b?.subtitle ?? "A sphere. Not a hole.";
    document.getElementById("world-description")!.textContent =
      b?.description ??
      "The other sky folds across its surface. Approach the sphere, then enter the bridge. The passage works in both directions.";
    document.getElementById("world-fact")!.textContent =
      b?.fact ??
      (this.sector === "solar"
        ? "Near Saturn → Gargantua system"
        : "Gargantua system → Saturn, solar system");
  }
  private go(id: string, instant = false) {
    if (this.crossing >= 0) return;
    const b = this.bodies.find((b) => b.data.id === id)!;
    if (b.data.sector !== this.sector) return;
    this.selected = id;
    this.setCard(id);
    this.routes.close();
    this.keys.clear();
    this.flight = false;
    this.controls.minDistance = b.data.radius * 1.08;
    const offset = new THREE.Vector3(0.5, 0.28, 1)
      .normalize()
      .multiplyScalar(b.data.radius * (innerWidth < 700 ? (id === 'saturn' ? 12 : 8) : (id === 'saturn' ? 6 : 3.8)));
    if (id === "gargantua") offset.set(0, 18, 80);
    const end = b.group.position.clone().add(offset);
    this.controls.enabled = false;
    this.travel = {
      from: this.camera.position.clone(),
      to: end,
      lookFrom: this.controls.target.clone(),
      lookTo: b.group.position.clone(),
      t: 0,
      duration: instant ? 0 : 4,
    };
    if (instant) {
      this.camera.position.copy(end);
      this.controls.target.copy(b.group.position);
      this.travel = null;
      this.setFlight(false);
    }
    document.getElementById("atlas-wormhole")!.textContent =
      "Set course: wormhole";
  }
  private goWormhole() {
    if (this.crossing >= 0 || this.travel) return;
    this.routes.close();
    if (
      this.selected === "wormhole" &&
      this.camera.position.distanceTo(this.portal.position) < 18
    ) {
      this.travel = {
        from: this.camera.position.clone(),
        to: this.portal.position.clone(),
        lookFrom: this.controls.target.clone(),
        lookTo: this.portal.position.clone().add(new THREE.Vector3(0, 0, -1)),
        t: 0,
        duration: 4,
        enter: true,
      };
      this.controls.enabled = false;
      return;
    }
    this.selected = "wormhole";
    this.setCard("wormhole");
    this.flight = false;
    this.controls.minDistance = 3.3;
    this.travel = {
      from: this.camera.position.clone(),
      to: this.portal.position.clone().add(new THREE.Vector3(0, 1.3, 12)),
      lookFrom: this.controls.target.clone(),
      lookTo: this.portal.position.clone(),
      t: 0,
      duration: 5,
    };
    this.controls.enabled = false;
    document.getElementById("atlas-wormhole")!.textContent = "Enter wormhole";
  }
  private openMap() {
    if (this.crossing >= 0) return;
    this.keys.clear();
    const list = document.getElementById("route-list")!;
    list.innerHTML = "";
    const dots = document.getElementById("chart-dots")!;
    dots.innerHTML = "";
    for (const b of this.bodies.filter((b) => b.data.sector === this.sector)) {
      const button = document.createElement("button");
      button.innerHTML = `<span>${b.data.name}</span><small>${b.data.subtitle}</small><span>↗</span>`;
      button.onclick = () => this.go(b.data.id);
      list.append(button);
      const r = (b.data.orbit / (this.sector === "solar" ? 205 : 171)) * 205;
      const angle = Math.atan2(b.group.position.z,b.group.position.x);
      const x = 240 + Math.cos(angle) * r,
        y = 240 + Math.sin(angle) * r;
      dots.innerHTML += `<circle cx="${x}" cy="${y}" r="${b.data.orbit === 0 ? 9 : 4}" fill="#dec49a"/><text x="${x + 8}" y="${y + 4}" fill="#ccd5dd" font-size="11">${b.data.name}</text>`;
    }
    const portal = document.createElement("button");
    portal.innerHTML =
      "<span>◯ Wormhole</span><small>Cross to the other system</small><span>↗</span>";
    portal.onclick = () => this.goWormhole();
    list.append(portal);
    document.getElementById("route-origin")!.textContent =
      this.sector === "solar" ? "Solar system / Saturn" : "Gargantua";
    document.getElementById("route-other")!.textContent =
      this.sector === "solar" ? "Gargantua" : "Solar system / Saturn";
    this.routes.showModal();
  }
  update(dt: number) {
    if (!this.active) return;
    this.performanceTime += dt; this.performanceFrames++;
    if(this.performanceTime>2){const fps=this.performanceFrames/this.performanceTime;const previous=this.renderScale;if(this.adaptiveQuality){if(fps<24)this.renderScale=Math.max(innerWidth<700?.75:.5,this.renderScale-.1);else if(fps>52)this.renderScale=Math.min(1,this.renderScale+.05);}if(previous!==this.renderScale)this.resize();this.performanceTime=0;this.performanceFrames=0;}
    const step = this.paused ? 0 : dt;
    this.elapsed += step;
    const periods:Record<string,number>={mercury:.241,venus:.615,earth:1,mars:1.881,jupiter:11.86,saturn:29.46,uranus:84,neptune:164.8,miller:2,mann:6,edmunds:12};
    for(const body of this.bodies){
      if(!body.data.orbit)continue;
      const before=body.group.position.clone();
      const angle=body.data.angle+this.elapsed*Math.PI*2/(2400*periods[body.data.id]);
      body.group.position.set(Math.cos(angle)*body.data.orbit,0,Math.sin(angle)*body.data.orbit);
      const delta=body.group.position.clone().sub(before);
      if(this.selected===body.data.id && this.sector===body.data.sector && !this.flight && this.crossing<0){
        if(this.travel){this.travel.to.add(delta);this.travel.lookTo.add(delta);}else{this.camera.position.add(delta);this.controls.target.add(delta);}
      }
      if(body.data.id==='saturn'&&this.sector==='solar'){
        this.portal.position.add(delta);
        if(this.selected==='wormhole'&&!this.flight&&this.crossing<0){if(this.travel){this.travel.to.add(delta);this.travel.lookTo.add(delta);}else{this.camera.position.add(delta);this.controls.target.add(delta);}}
      }
    }
    this.manualCooldown = Math.max(0, this.manualCooldown - dt);
    for (const b of this.bodies) {
      b.material.uniforms.uTime.value = this.elapsed;
      if (b.data.kind !== 5) b.mesh.rotation.y += step * 0.025;
    }
    for (const o of this.spin) o.rotation.y += step * 0.04;
    this.portalMaterial.uniforms.uTime.value = this.elapsed;
    if (this.travel) {
      const t = this.travel;
      t.t = Math.min(1, t.t + step / t.duration);
      const ease = t.t * t.t * (3 - 2 * t.t);
      this.camera.position.lerpVectors(t.from, t.to, ease);
      this.controls.target.lerpVectors(t.lookFrom, t.lookTo, ease);
      this.camera.lookAt(this.controls.target);
      if (t.t === 1) {
        this.travel = null;
        if (t.enter) this.beginCrossing();
        else this.setFlight(false);
      }
    }
    if (this.flight && !this.travel && this.crossing < 0 && !this.routes.open) {
      const v = new THREE.Vector3(
        Number(this.keys.has("d")) - Number(this.keys.has("a")),
        Number(this.keys.has("e")) - Number(this.keys.has("q")),
        Number(this.keys.has("s")) - Number(this.keys.has("w")),
      );
      let nearest = 100;
      for (const b of this.bodies.filter((b) => b.data.sector === this.sector))
        nearest = Math.min(
          nearest,
          this.camera.position.distanceTo(b.group.position) - b.data.radius,
        );
      const rate =
        Math.max(0.3, nearest * 0.45) * (this.keys.has("shift") ? 10 : 1);
      this.camera.position.addScaledVector(
        v.normalize().applyQuaternion(this.camera.quaternion),
        dt * rate,
      );
    }
    if (this.crossing < 0) {
      for (const b of this.bodies.filter(
        (b) => b.data.sector === this.sector,
      )) {
        const d = this.camera.position.clone().sub(b.group.position);
        if (d.length() < b.data.radius * 1.055)
          this.camera.position
            .copy(b.group.position)
            .add(d.setLength(b.data.radius * 1.055));
      }
      if (
        this.flight &&
        this.manualCooldown === 0 &&
        this.camera.position.distanceTo(this.portal.position) < 3.1
      )
        this.beginCrossing();
    }
    if (this.crossing >= 0) {
      this.crossing += step;
      const t = this.crossing / 5;
      this.camera.fov = 48 + Math.sin(Math.PI * Math.min(t, 1)) * 55;
      this.camera.updateProjectionMatrix();
      const caption =
        this.root.querySelector<HTMLElement>(".crossing-caption")!;
      caption.textContent =
        t < 0.5
          ? "Crossing the Einstein–Rosen bridge"
          : "A different sky awaits";
      this.root.style.setProperty(
        "--crossing",
        String(Math.sin(Math.PI * Math.min(t, 1))),
      );
      this.camera.rotateZ(step * 0.13);
      if (t >= 1) {
        this.sector = this.sector === "solar" ? "gargantua" : "solar";
        this.configureSector();
        this.selected = "wormhole";
        this.setCard("wormhole");
        this.camera.position
          .copy(this.portal.position)
          .add(new THREE.Vector3(0, 1, 10));
        this.controls.target.copy(this.portal.position);
        this.camera.fov = 48;
        this.camera.updateProjectionMatrix();
        this.crossing = -1;
        this.manualCooldown = 3;
        this.root.classList.remove("in-transit");
        this.setFlight(false);
        document.getElementById("atlas-wormhole")!.textContent =
          "Enter wormhole";
      }
    }
    if (this.controls.enabled) this.controls.update();
    const halo = this.roots.gargantua.getObjectByName("photon-halo");
    halo?.quaternion.copy(this.camera.quaternion);
    this.camera.updateMatrixWorld();
    this.blackSky.visible = this.sector === "gargantua" && this.crossing<0;
    this.roots.gargantua.visible = this.sector==='gargantua'&&this.crossing<0;
    this.roots.solar.visible = this.sector==='solar'&&this.crossing<0;
    this.portal.visible = this.crossing<0;
    const black = (this.blackSky.material as THREE.ShaderMaterial).uniforms;
    black.uCamera.value.copy(this.camera.position).divideScalar(3);
    black.uBasis.value.setFromMatrix4(this.camera.matrixWorld);
    black.uResolution.value.copy(this.renderer.getSize(new THREE.Vector2()));
    black.uTime.value = this.elapsed;
    black.uFov.value = THREE.MathUtils.degToRad(this.camera.fov);
    this.tunnel.visible = this.crossing >= 0;
    const tunnel = (this.tunnel.material as THREE.ShaderMaterial).uniforms;
    tunnel.uTime.value = this.crossing;
    tunnel.uAspect.value = this.camera.aspect;
    this.composer.render();
    for (const [id, label] of this.labels) {
      const b = this.bodies.find((b) => b.data.id === id);
      const pos = id === "wormhole" ? this.portal.position : b!.group.position;
      const p = pos.clone().project(this.camera);
      const line = pos.clone().sub(this.camera.position), length = line.length();
      line.normalize();
      const occluded = this.bodies.some(other => {
        if(other.data.id===id || other.data.sector!==this.sector) return false;
        const relative = other.group.position.clone().sub(this.camera.position), along = relative.dot(line);
        return along>0 && along<length && relative.lengthSq()-along*along<other.data.radius*other.data.radius;
      });
      const visible =
        !occluded &&
        (id === "wormhole" || b!.data.sector === this.sector) &&
        p.z < 1 &&
        p.z > -1 &&
        Math.abs(p.x) < 0.94 &&
        Math.abs(p.y) < 0.83 &&
        id !== this.selected &&
        this.crossing < 0;
      label.hidden = !visible;
      if (visible) {
        label.style.left = `${(p.x * 0.5 + 0.5) * innerWidth}px`;
        label.style.top = `${(-p.y * 0.5 + 0.5) * innerHeight}px`;
      }
    }
    const body = this.bodies.find((b) => b.data.id === this.selected);
    const d = this.camera.position.distanceTo(
      this.selected === "wormhole"
        ? this.portal.position
        : body!.group.position,
    );
    document.getElementById("atlas-distance")!.textContent =
      this.selected === "wormhole"
        ? `${(d / 3.2).toFixed(1)} mouth radii from bridge`
        : `${(d / body!.data.radius).toFixed(1)} radii from ${body!.data.name}`;
    document.getElementById("atlas-state")!.textContent = this.paused
      ? "TIME PAUSED"
      : this.crossing >= 0
        ? "BRIDGE TRANSIT"
        : this.travel
          ? "COURSE LOCKED · APPROACHING"
          : this.flight
            ? "MANUAL FLIGHT · THRUSTERS ONLINE"
            : "ORBITAL OBSERVATION";
  }
  private beginCrossing() {
    this.crossing = 0;
    this.travel = null;
    this.flight = false;
    this.controls.enabled = false;
    this.keys.clear();
    this.root.classList.add("in-transit");
  }
}
