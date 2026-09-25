import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { Input, Rail, Script, type ScriptFn } from "./engine";
import { StoryUI, type ChapterEntry } from "./ui";
import { StoryAudio } from "./sound";
import { EarthWorld } from "./earth/world";
import { FarmChapter } from "./chapters/farm";
import { GhostChapter } from "./chapters/ghost";
import { CoordinatesChapter } from "./chapters/coordinates";
import { GoodbyeChapter } from "./chapters/goodbye";
import { LaunchChapter } from "./chapters/launch";
import { MillerChapter } from "./chapters/miller";

/** A playable chapter. It owns its script and controls; the Story owns rendering and UI. */
export interface Chapter {
  readonly title: string;
  /** Help shown in the pause menu. */
  readonly keys: string;
  start(checkpoint?: string): void;
  update(dt: number): void;
  /** Called when the player skips a cinematic. */
  skip?(): void;
  dispose(): void;
  checkpoint: string;
  /** True while the chapter shows its own modal UI (Escape belongs to it). */
  modal?: boolean;
}

type ChapterDef = ChapterEntry & { make?: (s: Story) => Chapter };

const CHAPTERS: ChapterDef[] = [
  {
    id: "farm",
    number: "01",
    title: "The Dust",
    blurb: "Morning on the farm. A drone nobody has seen in years comes in low over the corn.",
    ready: true,
    make: (s) => new FarmChapter(s),
  },
  {
    id: "ghost",
    number: "02",
    title: "The Ghost",
    blurb: "Murph's bookshelf, the storm, and a message in the dust.",
    ready: true,
    make: (s) => new GhostChapter(s),
  },
  {
    id: "coordinates",
    number: "03",
    title: "Coordinates",
    blurb: "A night drive to a place that isn't on any map.",
    ready: true,
    make: (s) => new CoordinatesChapter(s),
  },
  {
    id: "goodbye",
    number: "04",
    title: "Don't Go",
    blurb: "A watch, a bookshelf, a truck on the road.",
    ready: true,
    make: (s) => new GoodbyeChapter(s),
  },
  {
    id: "launch",
    number: "05",
    title: "Liftoff",
    blurb: "From the pad to orbit in one unbroken climb.",
    ready: true,
    make: (s) => new LaunchChapter(s),
  },
  { id: "wormhole", number: "06", title: "The Wormhole", blurb: "Saturn, and a sphere in space.", ready: false },
  {
    id: "miller",
    number: "07",
    title: "Miller",
    blurb: "One hour here is seven years back home.",
    ready: true,
    make: (s) => new MillerChapter(s),
  },
  { id: "gargantua", number: "08", title: "Gargantua", blurb: "The slingshot, and the fall.", ready: false },
  { id: "tesseract", number: "09", title: "The Tesseract", blurb: "Behind the bookshelf, every moment at once.", ready: false },
  { id: "station", number: "10", title: "Cooper Station", blurb: "A world rolled up inside a cylinder.", ready: false },
];

export class Story {
  active = false;
  readonly camera = new THREE.PerspectiveCamera(60, 1, 0.2, 60000);
  readonly ui = new StoryUI();
  readonly input: Input;
  readonly audio = new StoryAudio();
  readonly script = new Script();
  /** Runs alongside the main script (ambient barks, reactions). */
  readonly side = new Script();
  earth!: EarthWorld;
  /** Set by the app: Gargantua's sky and where its worlds are, for chapters set there. */
  gargantua: { scene: THREE.Scene; point: (id: "miller" | "mann") => THREE.Vector3 } | null = null;
  /** Set by the app: continue into the space atlas near Earth (after the launch). */
  onAtlas: ((snapshot: string) => void) | null = null;
  private composer: EffectComposer;
  private pass: RenderPass;
  private bloom: UnrealBloomPass;
  private msaa = true;
  private chapter: Chapter | null = null;
  private chapterId = "";
  private rail: Rail | null = null;
  private cine = false;
  private skipHeld = 0;
  private paused = false;
  private inMenu = false;
  private menuT = 0;
  private renderScale = 1;
  private fps = 60;
  private frames = 0;
  private fpsT = 0;
  private quality: "low" | "mid" | "high" = "mid";
  private shownFirstFrame = false;
  constructor(
    private renderer: THREE.WebGLRenderer,
    private onExit: () => void,
  ) {
    this.input = new Input(renderer.domElement);
    this.input.onUnlock = () => {
      if (this.chapter && !this.paused && !this.inMenu) this.setPaused(true);
    };
    const target = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 });
    this.composer = new EffectComposer(renderer, target);
    this.pass = new RenderPass(new THREE.Scene(), this.camera);
    this.composer.addPass(this.pass);
    this.bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.12, 0.5, 1.4);
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());
    window.addEventListener("resize", () => this.active && this.resize());
    document.addEventListener("visibilitychange", () => {
      if (!this.active) return;
      if (document.hidden) this.audio.suspend();
      else this.audio.resume();
    });
  }

  // --- Lifecycle ------------------------------------------------------------
  /** Opens the chapter menu over a slow flight across the fields. */
  open() {
    this.active = true;
    document.body.classList.add("storying");
    this.ui.root.hidden = false;
    this.input.enabled = true;
    this.audio.resume();
    if (!this.earth) {
      this.earth = new EarthWorld(this.renderer);
      this.pass.scene = this.earth.scene;
    }
    this.renderer.toneMappingExposure = 1;
    this.renderer.shadowMap.enabled = true;
    this.resize();
    this.showMenu();
  }
  close() {
    this.endChapter();
    this.active = false;
    this.input.enabled = false;
    this.input.capture(false);
    this.ui.root.hidden = true;
    this.ui.menu(null, () => {}, () => {});
    this.audio.silence();
    this.audio.suspend();
    document.body.classList.remove("storying");
    this.renderer.shadowMap.enabled = false;
    this.onExit();
  }
  private showMenu() {
    this.endChapter();
    this.inMenu = true;
    this.ui.reset();
    this.ui.fade(0, 1.2);
    this.input.capture(false);
    this.audio.padLevel(0.5, 4);
    this.ui.menu(
      CHAPTERS,
      (id) => this.play(id),
      () => this.close(),
    );
  }
  play(id: string, checkpoint?: string) {
    const def = CHAPTERS.find((c) => c.id === id);
    if (!def?.make) return;
    this.endChapter();
    this.inMenu = false;
    this.ui.menu(null, () => {}, () => {});
    this.ui.reset();
    this.audio.resume();
    this.audio.padLevel(0, 2);
    this.chapterId = id;
    this.chapter = def.make(this);
    // Fade up from whatever came before (a failure, the menu); chapters can override.
    this.ui.fade(0, 0.9);
    this.chapter.start(checkpoint);
  }
  private endChapter() {
    this.setScene(null);
    this.script.stop();
    this.side.stop();
    this.rail = null;
    this.cine = false;
    this.setPaused(false);
    this.chapter?.dispose();
    this.chapter = null;
    this.audio.silence();
  }
  restart(fromCheckpoint: boolean) {
    const cp = fromCheckpoint ? this.chapter?.checkpoint : undefined;
    this.play(this.chapterId, cp);
  }
  toMenu() {
    this.showMenu();
  }
  /** Draw another world's scene (a chapter away from Earth), or Earth again with null. */
  setScene(scene: THREE.Scene | null) {
    this.pass.scene = scene ?? this.earth.scene;
  }
  get renderer3() {
    return this.renderer;
  }
  /** The current frame as an image (for a crossfade into another mode). */
  snapshot() {
    this.composer.render();
    return this.renderer.domElement.toDataURL("image/jpeg", 0.9);
  }
  /** Hand over to the atlas: the flight goes on, only the controls and scale change. */
  leaveForAtlas() {
    const shot = this.snapshot();
    this.close();
    this.onAtlas?.(shot);
  }
  /** Come back from the atlas: straight into the Ranger's descent to the farm. */
  homecoming() {
    this.open();
    this.play("launch", "home");
  }

  // --- Helpers for chapters -----------------------------------------------------
  run(fn: ScriptFn) {
    this.script.run(fn);
  }
  /** Take the camera on a rail; returns a wait predicate. Letterbox on while it runs. */
  cinematic(rail: Rail | null) {
    this.rail = rail;
    this.cine = !!rail;
    this.ui.letterbox(!!rail);
    if (rail) this.input.capture(false);
    return () => !this.rail || this.rail.done;
  }
  /** Letterbox and skip without a rail (the chapter drives the camera). */
  set cinematicMode(on: boolean) {
    this.cine = on;
    this.ui.letterbox(on);
  }
  get inCinematic() {
    return this.cine;
  }
  /** The player controls something: ask for mouse look. */
  gameplay() {
    this.cinematic(null);
    this.input.capture(true);
  }
  setPaused(on: boolean) {
    if (this.paused === on) return;
    this.paused = on;
    if (on) {
      this.input.capture(false);
      this.audio.silence();
      this.ui.pause(this.chapter?.title ?? "", this.chapter?.keys ?? "", (act) => {
        if (act === "resume") {
          this.setPaused(false);
          if (!this.cine) this.input.capture(true);
        } else if (act === "checkpoint") this.restart(true);
        else if (act === "restart") this.restart(false);
        else this.toMenu();
      });
    } else this.ui.pause(null, "", () => {});
  }
  /** Draw distance and effects for the current quality tier. */
  private applyQuality() {
    // MSAA and bloom are the first things to go on weak GPUs.
    const msaa = this.quality === "high";
    if (msaa !== this.msaa) {
      this.msaa = msaa;
      for (const t of [this.composer.renderTarget1, this.composer.renderTarget2]) {
        t.samples = msaa ? 4 : 0;
        t.dispose();
      }
    }
    this.bloom.enabled = this.quality !== "low";
    const radius = { low: 26, mid: 34, high: 42 }[this.quality];
    if (this.earth && this.earth.corn.plantRadius !== radius) {
      this.earth.corn.setRadius(radius);
      this.earth.ground.plantRadius = radius;
    }
  }

  resize() {
    const w = Math.max(1, Math.round(innerWidth * this.renderScale)),
      h = Math.max(1, Math.round(innerHeight * this.renderScale));
    this.renderer.setPixelRatio(1);
    this.renderer.setSize(w, h, false);
    this.composer.setSize(w, h);
    if (this.earth) this.earth.pixelHeight = h;
    this.camera.aspect = innerWidth / innerHeight;
    this.camera.updateProjectionMatrix();
  }

  update(raw: number) {
    const dt = Math.min(raw, 0.05);
    const input = this.input;
    this.ui.clickToLook(!!this.chapter && !this.paused && !this.cine && !input.locked && !this.inMenu);
    if (this.chapter && !this.paused) {
      if (input.hit("Escape", "KeyP") && !this.chapter.modal) this.setPaused(true);
      // Hold Space to skip a cinematic.
      if (this.cine && input.key("Space")) {
        this.skipHeld += dt;
        this.ui.skip(Math.min(1, this.skipHeld / 0.8));
        if (this.skipHeld >= 0.8) {
          this.skipHeld = 0;
          this.ui.clearLines();
          if (this.rail) this.rail.t = this.rail.duration;
          this.chapter.skip?.();
        }
      } else {
        this.skipHeld = 0;
        this.ui.skip(this.cine ? 0 : null);
      }
    } else this.ui.skip(null);

    if (this.inMenu) {
      // Backdrop: a slow drift over the fields toward the farm.
      this.menuT += dt;
      const a = this.menuT * 0.02;
      this.camera.position.set(Math.cos(a) * 140 - 10, 14 + Math.sin(this.menuT * 0.1) * 2, Math.sin(a) * 140 + 10);
      this.camera.lookAt(0, 3, 0);
      this.earth.update(dt, this.camera);
      this.earth.drone.hide();
    } else if (this.chapter && !this.paused) {
      this.script.step(dt);
      this.side.step(dt);
      if (this.rail) this.rail.apply(this.camera, dt);
      this.chapter.update(dt);
    }
    this.ui.update(dt);
    input.endFrame();
    this.applyQuality();
    this.composer.render();
    if (!this.shownFirstFrame) {
      this.shownFirstFrame = true;
      document.getElementById("loading")?.setAttribute("hidden", "");
    }
    // Adaptive resolution: hold 50+ fps where possible.
    this.frames++;
    this.fpsT += raw;
    if (this.fpsT > 2) {
      this.fps = this.frames / this.fpsT;
      this.frames = 0;
      this.fpsT = 0;
      const old = this.renderScale;
      if (this.fps < 40) {
        if (this.renderScale > 0.62) this.renderScale = Math.max(0.6, this.renderScale - 0.1);
        else this.quality = this.quality === "high" ? "mid" : "low";
      } else if (this.fps > 57) {
        if (this.quality !== "high" && this.renderScale >= 0.99) this.quality = this.quality === "low" ? "mid" : "high";
        else this.renderScale = Math.min(1, this.renderScale + 0.05);
      }
      if (old !== this.renderScale) this.resize();
    }
  }
  get diagnostics() {
    return {
      chapter: this.chapterId,
      checkpoint: this.chapter?.checkpoint,
      fps: Math.round(this.fps),
      scale: this.renderScale,
      quality: this.quality,
      camera: this.camera.position.toArray().map((v) => +v.toFixed(1)),
      paused: this.paused,
      cinematic: this.cine,
    };
  }
}
