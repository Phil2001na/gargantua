import * as THREE from "three";
import type { Chapter, Story } from "../story";
import type { Wait } from "../engine";
import { Walker } from "../controls";
import { Surface } from "../../surface";
import { Colliders } from "../earth/collide";
import { person, animatePerson, CAST, type Person } from "../earth/people";
import { Tars } from "../earth/tars";
import { walkPose } from "./common";

/**
 * Chapter seven: Miller's planet. A knee-deep ocean under Gargantua, where an hour costs
 * seven years back home. Land beside the beacon, wade to the wreck, and discover that the
 * mountains on the horizon are a wave. Then the long wait while the engines drain, and back
 * aboard the Endurance, twenty-three years of messages.
 * Dialogue is original, written for this project.
 */

type Mode = "cine" | "walk" | "watch";
const KEYS = `<kbd>W A S D</kbd> wade · <kbd>Shift</kbd> run · <kbd>E</kbd> interact · mouse to look<br>Hold <kbd>Space</kbd> in a cutscene to skip it`;
/** Seconds of Earth time per second on Miller (1 hour = 7 years). */
const DILATION = (7 * 365.25 * 86400) / 3600;
/** The waves come from here; the Ranger lands facing them. */
const IN = Surface.waveDir().negate();
const SIDE = new THREE.Vector3(-IN.z, 0, IN.x);
const LAND = new THREE.Vector3(0, 0, 0);
const WRECK = IN.clone().multiplyScalar(180).addScaledVector(SIDE, 40);
const SEABED = -0.55;
/** From touchdown to the crest reaching the Ranger. */
const WAVE_AFTER_LANDING = 170;
const HATCH = SIDE.clone().multiplyScalar(-8.5);

const oceans = new WeakMap<Story, Surface>();

type Stroll = { p: Person | Tars; path: THREE.Vector3[]; speed: number; i: number; phase: number; done: boolean };

export class MillerChapter implements Chapter {
  readonly title = "07 · Miller";
  readonly keys = KEYS;
  checkpoint = "start";
  modal = false;
  private surface: Surface;
  private world: THREE.Scene;
  private mode: Mode = "cine";
  private walker = new Walker();
  private colliders = new Colliders(false);
  private brand = person(CAST.amelia);
  private doyle = person(CAST.doyle);
  private romilly = person(CAST.romillyOld);
  private cas = new Tars();
  private wreck = new THREE.Group();
  private recorder: THREE.Mesh;
  private beacon: THREE.PointLight;
  private panel: THREE.Mesh;
  private strolls: Stroll[] = [];
  private cineCam: ((dt: number) => void) | null = null;
  private marker: { at: () => THREE.Vector3; label: string } | null = null;
  private ranger: THREE.Object3D;
  /** Seconds spent on Miller (the story's clock, with the hour skipped during the drain). */
  private millerTime = 0;
  private clockOn = false;
  private landed = false;
  private aboard = false;
  private brandFree = false;
  private brandStuck = false;
  private failing = false;
  private strideT = 0;
  private room: THREE.Scene;
  private screen: THREE.Mesh;
  private screenTex: THREE.CanvasTexture;
  private t = 0;
  constructor(private s: Story) {
    // One ocean per story: it owns render targets, so replays reuse it.
    let surface = oceans.get(s);
    if (!surface) {
      const g = s.gargantua;
      surface = new Surface(s.renderer3, g ? g.scene : new THREE.Scene());
      oceans.set(s, surface);
    }
    this.surface = surface;
    this.world = this.surface.world;
    this.ranger = this.surface.flyer;
    // The wreck of Miller's lander: a broken hull, a torn-off wing, debris, and the recorder.
    const hull = new THREE.MeshStandardMaterial({ color: 0x9da1a4, roughness: 0.6, metalness: 0.4 });
    const dark = new THREE.MeshStandardMaterial({ color: 0x2c3034, roughness: 0.7, metalness: 0.4 });
    const add = (m: THREE.Mesh, x: number, y: number, z: number, rx = 0, ry = 0, rz = 0) => {
      m.position.set(x, y, z);
      m.rotation.set(rx, ry, rz);
      m.castShadow = m.receiveShadow = true;
      this.wreck.add(m);
      return m;
    };
    add(new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.8, 11, 8, 1, true), hull), 0, 0.4, 0, 1.35, 0.4, 0.2);
    add(new THREE.Mesh(new THREE.BoxGeometry(9, 0.5, 4), hull), 7, 0.1, -3, 0.2, 0.7, -0.15);
    add(new THREE.Mesh(new THREE.BoxGeometry(3, 2, 2.4), dark), -5, 0.3, 2, 0.4, 0.3, 0.6);
    for (let i = 0; i < 9; i++) add(new THREE.Mesh(new THREE.BoxGeometry(0.4 + i * 0.15, 0.08, 0.6 + (i % 3) * 0.4), i % 2 ? hull : dark), Math.cos(i * 2.1) * (6 + i), 0.02, Math.sin(i * 2.1) * (6 + i), 0, i, 0);
    // The panel that pins Brand.
    this.panel = add(new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.12, 1.6), hull), 2.4, 0.25, 2.2, 0, 0.3, 0.25);
    this.recorder = add(new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.3, 0.3), new THREE.MeshStandardMaterial({ color: 0xe06a1c, roughness: 0.5, emissive: 0x401000 })), 3.4, 0.08, 1.2);
    this.beacon = new THREE.PointLight(0xff5020, 0, 30, 1.6);
    this.beacon.position.set(3.4, 0.6, 1.2);
    this.wreck.add(this.beacon);
    this.wreck.position.copy(WRECK);
    this.world.add(this.wreck, this.brand.root, this.doyle.root, this.cas.root);
    // Floor: the seabed under knee-deep water. The Ranger is solid.
    this.colliders.box(-1e5, 1e5, -1e5, 1e5, SEABED);
    // Back aboard the Endurance: one module with a message screen.
    this.room = new THREE.Scene();
    this.room.background = new THREE.Color(0x05070a);
    const wall = new THREE.MeshStandardMaterial({ color: 0x8c9096, roughness: 0.7, metalness: 0.2, side: THREE.BackSide });
    const shell = new THREE.Mesh(new THREE.CylinderGeometry(3.2, 3.2, 9, 12, 1, true).rotateZ(Math.PI / 2), wall);
    this.room.add(shell);
    const floorM = new THREE.Mesh(new THREE.BoxGeometry(9, 0.1, 3.6), new THREE.MeshStandardMaterial({ color: 0x3a3d42, roughness: 0.8 }));
    floorM.position.y = -1.9;
    this.room.add(floorM);
    const c = document.createElement("canvas");
    c.width = 512;
    c.height = 320;
    this.screenTex = new THREE.CanvasTexture(c);
    this.screenTex.colorSpace = THREE.SRGBColorSpace;
    this.screen = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1.0), new THREE.MeshBasicMaterial({ map: this.screenTex, toneMapped: false }));
    this.screen.position.set(0, -0.2, -2.9);
    this.room.add(this.screen);
    const console = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.9, 0.7), new THREE.MeshStandardMaterial({ color: 0x24272c, roughness: 0.6, metalness: 0.5 }));
    console.position.set(0, -1.45, -2.6);
    this.room.add(console);
    const glow = new THREE.PointLight(0xa8c8ff, 6, 8, 1.6);
    glow.position.set(0, 0, -2);
    this.room.add(glow, new THREE.HemisphereLight(0x9aa4b0, 0x202428, 0.6));
    for (let i = -3; i <= 3; i++) {
      const strip = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.04, 0.2), new THREE.MeshBasicMaterial({ color: 0xdfe8f0 }));
      strip.position.set(i * 1.3, 2.9, 0);
      this.room.add(strip);
    }
    this.room.add(this.romilly.root);
    this.hide();
  }
  private hide() {
    for (const o of [this.brand.root, this.doyle.root, this.cas.root, this.romilly.root]) o.visible = false;
  }

  // --- Setup -----------------------------------------------------------------
  start(checkpoint = "start") {
    this.checkpoint = checkpoint;
    const g = this.s.gargantua;
    this.surface.enter("miller", g ? g.point("miller") : new THREE.Vector3(30, 1.2, 0));
    this.surface.leave();
    this.s.setScene(this.world);
    const cam = this.s.camera;
    cam.near = 0.2;
    cam.far = 200000;
    cam.fov = 60;
    cam.updateProjectionMatrix();
    this.ranger.visible = true;
    const run = {
      start: () => this.descent(),
      wreck: () => this.wade(true),
      wave: () => this.theWave(true),
      drain: () => this.drain(true),
      messages: () => this.messages(),
    }[checkpoint];
    this.s.run(run ?? (() => this.descent()));
  }
  dispose() {
    this.world.remove(this.wreck, this.brand.root, this.doyle.root, this.cas.root);
    this.s.setScene(null);
    const cam = this.s.camera;
    cam.far = 60000;
    cam.updateProjectionMatrix();
    this.s.ui.reset();
    this.s.input.capture(false);
    this.s.audio.rumble(0, 0.5);
  }
  skip() {
    this.s.ui.hideCard();
  }

  // --- Helpers -----------------------------------------------------------------------
  private water(x: number, z: number) {
    return Math.max(this.surface.heightAt(x, z), 0);
  }
  /** The Ranger rides the water where it floats. */
  private floatRanger(at: THREE.Vector3, yaw: number) {
    const e = 6;
    const h0 = this.water(at.x, at.z),
      hf = this.water(at.x + IN.x * e, at.z + IN.z * e),
      hs = this.water(at.x + SIDE.x * e, at.z + SIDE.z * e);
    this.ranger.position.set(at.x, h0 + 1.3, at.z);
    const pitch = Math.atan2(hf - h0, e),
      roll = Math.atan2(hs - h0, e);
    this.ranger.rotation.set(pitch, yaw, -roll, "YXZ");
  }
  private stroll(p: Person | Tars, path: THREE.Vector3[], speed: number) {
    this.strolls = this.strolls.filter((s) => s.p !== p);
    this.strolls.push({ p, path, speed, i: 0, phase: 0, done: false });
  }
  private glide(to: THREE.Vector3, look: THREE.Vector3, seconds: number): Wait {
    const cam = this.s.camera;
    const p0 = cam.position.clone(),
      q0 = cam.quaternion.clone();
    const q1 = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().lookAt(to, look, new THREE.Vector3(0, 1, 0)));
    let u = 0;
    this.cineCam = (dt) => {
      u = Math.min(1, u + dt / seconds);
      const e = u * u * (3 - 2 * u);
      cam.position.lerpVectors(p0, to, e);
      cam.quaternion.slerpQuaternions(q0, q1, e);
      if (u >= 1) this.cineCam = null;
    };
    return () => u >= 1;
  }
  private earthTime() {
    const secs = this.millerTime * DILATION;
    const years = Math.floor(secs / (365.25 * 86400));
    const days = Math.floor((secs - years * 365.25 * 86400) / 86400);
    return years ? `${years} yr ${days} d` : `${days} d ${Math.floor((secs % 86400) / 3600)} h`;
  }
  private walkHere(at: THREE.Vector3, face: THREE.Vector3) {
    const d = face.clone().sub(at);
    this.walker.place(at.x, SEABED, at.z, Math.atan2(-d.x, -d.z), -0.05);
    this.walker.eye = 1.7;
    this.walker.pace = 0.72;
    this.mode = "walk";
    this.s.cinematicMode = false;
    this.s.gameplay();
  }
  private placeCrew() {
    this.brand.root.visible = this.doyle.root.visible = this.cas.root.visible = true;
    this.doyle.root.position.copy(HATCH).setY(SEABED);
    this.doyle.root.rotation.y = Math.atan2(IN.x, IN.z);
    this.cas.root.position.copy(HATCH).addScaledVector(IN, 3).setY(SEABED);
    this.brand.root.position.copy(HATCH).addScaledVector(IN, 2).addScaledVector(SIDE, -1.5).setY(SEABED);
  }

  // --- Scene 1: the descent ---------------------------------------------------------
  private *descent(): Generator<Wait> {
    const { ui, audio } = this.s;
    this.checkpoint = "start";
    this.mode = "cine";
    this.s.cinematicMode = true;
    this.hide();
    this.landed = false;
    this.aboard = false;
    this.millerTime = 0;
    this.clockOn = false;
    // Coming in low over the water from 2 km up, facing the way the waves come from.
    const DUR = 26;
    this.surface.waveIn(LAND.x, LAND.z, DUR + WAVE_AFTER_LANDING);
    const from = LAND.clone().addScaledVector(IN, -5200).setY(2100);
    const mid = LAND.clone().addScaledVector(IN, -1200).setY(260);
    const path = new THREE.CatmullRomCurve3([from, mid, LAND.clone().addScaledVector(IN, -120).setY(40), LAND.clone().setY(1.3)]);
    let u = 0;
    const yaw = Math.atan2(-IN.x, -IN.z);
    this.cineCam = (dt) => {
      u = Math.min(1, u + dt / DUR);
      const e = 1 - Math.pow(1 - u, 2.2);
      const p = path.getPointAt(e);
      const ahead = path.getPointAt(Math.min(1, e + 0.01));
      this.ranger.position.copy(p);
      this.ranger.rotation.set(-Math.atan2(ahead.y - p.y, Math.hypot(ahead.x - p.x, ahead.z - p.z)) * 0.6, yaw, Math.sin(u * 6) * 0.05, "YXZ");
      const cam = this.s.camera;
      cam.position.copy(p).addScaledVector(IN, -48 + 20 * e).addScaledVector(SIDE, 22).setY(p.y + 12 - 6 * e);
      cam.lookAt(p.clone().addScaledVector(IN, 30));
    };
    audio.rumble(0.25, 2);
    ui.fade(1, 0);
    ui.fade(0, 2);
    ui.card("Chapter seven", "Miller", "One hour here is seven years back home.");
    yield 4;
    ui.hideCard();
    yield ui.say("TARS", "Beacon's steady. Two kilometres, dead ahead.");
    yield ui.say("Brand", "Every hour we spend down there is seven years for them.");
    yield ui.say("Cooper", "Then we don't spend an hour. In, get the data, out.");
    yield ui.say("Doyle", "Surface is water. Knee-deep, as far as I can see.");
    yield () => u >= 1;
    this.cineCam = null;
    this.floating = true;
    audio.rumble(0, 2);
    audio.thud(3);
    yield* this.wade(false);
  }

  // --- Scene 2: wade to the wreck ---------------------------------------------------
  private *wade(fromCheckpoint: boolean): Generator<Wait> {
    const { ui } = this.s;
    this.checkpoint = "wreck";
    if (fromCheckpoint) this.surface.waveIn(LAND.x, LAND.z, WAVE_AFTER_LANDING);
    this.landed = true;
    this.floating = true;
    this.clockOn = true;
    this.brandStuck = this.brandFree = false;
    this.placeCrew();
    this.panel.rotation.set(0, 0.3, 0.25);
    this.walkHere(HATCH.clone().addScaledVector(SIDE, -1.5), WRECK);
    ui.fade(0, 0.8);
    ui.objective("Get to the beacon");
    ui.hint("<kbd>W A S D</kbd> wade · <kbd>Shift</kbd> run · mouse to look");
    this.marker = { at: () => WRECK.clone().setY(2), label: "Beacon" };
    // Brand goes on ahead; CASE follows.
    this.stroll(this.brand, [WRECK.clone().addScaledVector(SIDE, -3).setY(SEABED)], 2.1);
    this.stroll(this.cas, [WRECK.clone().addScaledVector(SIDE, 4).addScaledVector(IN, 3).setY(SEABED)], 1.6);
    this.s.side.run(
      function* (this: MillerChapter): Generator<Wait> {
        yield 3;
        yield ui.say("Doyle", "I'll keep the engines warm. Don't be long.");
        yield 10;
        yield ui.say("Brand", "It's so shallow. I thought there'd be... something. Anything alive.");
        yield ui.say("Cooper", "Nothing to feed on. Just water and that thing in the sky.");
      }.bind(this),
    );
    // Wreck, then the wave (which comes on the ocean's clock, not ours).
    yield () => this.surface.waveEta(LAND.x, LAND.z) < 98;
    yield* this.theWave(false);
  }

  // --- Scene 3: the wave -----------------------------------------------------------------
  private *theWave(fromCheckpoint: boolean): Generator<Wait> {
    const { ui, audio } = this.s;
    this.checkpoint = "wave";
    if (fromCheckpoint) {
      this.landed = true;
      this.floating = true;
      this.clockOn = true;
      this.millerTime = Math.max(this.millerTime, 190);
      this.surface.waveIn(LAND.x, LAND.z, 96);
      this.placeCrew();
      this.brand.root.position.copy(WRECK).addScaledVector(SIDE, -3).setY(SEABED);
      this.cas.root.position.copy(WRECK).addScaledVector(SIDE, 4).addScaledVector(IN, 3).setY(SEABED);
      this.walkHere(WRECK.clone().addScaledVector(IN, -14), WRECK);
      this.strolls = [];
    }
    this.s.side.stop();
    ui.clearLines();
    // Brand has the recorder, and a panel from the wreck has her pinned.
    this.recorder.visible = false;
    this.brandStuck = true;
    this.brand.root.position.copy(WRECK).addScaledVector(SIDE, -3).setY(SEABED);
    this.stroll(this.brand, [], 0);
    this.panel.position.set(2.4, 0.25, 2.2);
    yield ui.say("Brand", "I've got the recorder! Miller's data, it's all here.");
    yield ui.say("Cooper", "Those aren't mountains.");
    yield ui.say("Cooper", "That's a wave.");
    audio.rumble(0.15, 4);
    ui.objective("Help Brand");
    this.marker = { at: () => this.brand.root.position.clone().setY(1.6), label: "Brand" };
    ui.say("Brand", "My leg, it's caught under the panel!");
    const help = () => this.walker.pos.distanceTo(this.brand.root.position.clone().setY(this.walker.pos.y)) < 2.4;
    yield () => this.brandFree || (help() && this.s.input.hit("KeyE"));
    this.brandFree = true;
    this.brandStuck = false;
    this.panel.rotation.set(0, 0.3, 1.2);
    this.panel.position.set(2.8, 0.9, 2.2);
    audio.thud(2);
    ui.prompt(null);
    yield ui.say("Cooper", "Go! Back to the Ranger, now!");
    ui.objective("Run back to the Ranger");
    this.marker = { at: () => HATCH.clone().setY(2), label: "Ranger" };
    this.stroll(this.brand, [HATCH.clone().addScaledVector(IN, 1).setY(SEABED)], 3.3);
    this.stroll(this.cas, [HATCH.clone().addScaledVector(IN, 2).setY(SEABED)], 3.4);
    this.s.side.run(
      function* (this: MillerChapter): Generator<Wait> {
        yield 6;
        yield ui.say("Doyle", "Cooper! Move it!");
        yield () => this.surface.waveEta(LAND.x, LAND.z) < 40;
        yield ui.say("TARS", "Forty seconds.");
        yield () => this.surface.waveEta(LAND.x, LAND.z) < 20;
        yield ui.say("Doyle", "Get in, get in!");
      }.bind(this),
    );
    yield () => this.aboard || this.failing;
    if (this.failing) return;
    yield* this.rideIt();
  }

  private *rideIt(): Generator<Wait> {
    const { ui, audio } = this.s;
    this.s.side.stop();
    ui.clearLines();
    ui.objective(null);
    ui.hint(null);
    this.marker = null;
    this.hide();
    this.mode = "cine";
    this.s.cinematicMode = true;
    audio.thud(3);
    // Watch from off to the side as the wave takes the Ranger up its face.
    const cam = this.s.camera;
    const yaw = Math.atan2(-IN.x, -IN.z);
    this.cineCam = () => {
      const r = this.ranger.position;
      const at = r.clone().addScaledVector(SIDE, 320).addScaledVector(IN, -140);
      at.y = Math.max(this.water(at.x, at.z), r.y - 60) + 70;
      cam.position.copy(at);
      cam.lookAt(r.clone().add(new THREE.Vector3(0, 20, 0)));
    };
    void yaw;
    yield ui.say("Cooper", "Hold on!");
    yield () => this.surface.waveEta(LAND.x, LAND.z) > 200;
    yield 2;
    yield* this.drain(false);
  }

  // --- Scene 4: the engines drain; an hour goes by ------------------------------------------
  private *drain(fromCheckpoint: boolean): Generator<Wait> {
    const { ui, audio } = this.s;
    this.checkpoint = "drain";
    this.cineCam = null;
    if (fromCheckpoint) {
      this.landed = true;
      this.floating = true;
      this.clockOn = true;
      this.millerTime = Math.max(this.millerTime, 330);
      this.surface.waveIn(LAND.x, LAND.z, 500);
      this.hide();
    }
    this.aboard = true;
    audio.rumble(0, 3);
    this.mode = "cine";
    this.s.cinematicMode = true;
    const cam = this.s.camera;
    this.cineCam = () => {
      const r = this.ranger.position;
      cam.position.copy(r).addScaledVector(IN, -28).addScaledVector(SIDE, 12).setY(r.y + 7);
      cam.lookAt(r.clone().addScaledVector(IN, 10));
    };
    yield ui.say("TARS", "Engines are flooded. They need to drain before we can light them.");
    yield ui.say("Cooper", "How long?");
    yield ui.say("TARS", "About an hour.");
    yield ui.say("Brand", "An hour. That's seven years.");
    yield 1;
    yield ui.fade(1, 1.2);
    // The hour, and the next wave close enough to see.
    this.millerTime += 3600 + 12 * 60;
    this.surface.waveIn(LAND.x, LAND.z, 75);
    ui.card("", "An hour and twelve minutes later", "");
    yield 2.4;
    ui.hideCard();
    ui.fade(0, 1.2);
    yield ui.say("TARS", "Engines are clear.");
    yield ui.say("Cooper", "And here comes the next one. Everybody strapped in? Punch it.");
    audio.rumble(0.7, 1);
    // Liftoff: climb away up and over the approaching wave.
    this.floating = false;
    const from = this.ranger.position.clone();
    let u = 0;
    this.cineCam = (dt) => {
      u = Math.min(1, u + dt / 12);
      const e = u * u;
      const p = from.clone().addScaledVector(IN, 1400 * e).setY(from.y + 2400 * e);
      this.ranger.position.copy(p);
      this.ranger.rotation.set(-0.5 * Math.min(1, u * 3), Math.atan2(-IN.x, -IN.z), 0, "YXZ");
      cam.position.copy(from).addScaledVector(IN, -60).addScaledVector(SIDE, 30).setY(Math.max(this.water(from.x, from.z) + 8, from.y + 8));
      cam.lookAt(p);
    };
    yield 7;
    yield ui.fade(1, 3);
    audio.rumble(0, 2);
    this.clockOn = false;
    yield 0.6;
    yield* this.messages();
  }

  // --- Scene 5: twenty-three years -----------------------------------------------------------
  private *messages(): Generator<Wait> {
    const { ui, audio } = this.s;
    this.checkpoint = "messages";
    this.cineCam = null;
    this.clockOn = false;
    if (this.millerTime < 11000) this.millerTime = 3 * 3600 + 17 * 60;
    ui.telemetry(null);
    this.s.setScene(this.room);
    this.hide();
    const cam = this.s.camera;
    cam.far = 100;
    cam.updateProjectionMatrix();
    this.romilly.root.visible = true;
    this.romilly.root.position.set(1.6, -1.85, -0.8);
    this.romilly.root.rotation.y = -0.9;
    this.walker.place(-0.8, -1.85, 1.6, 0.35, 0);
    this.walker.eye = 1.7;
    this.walker.pace = 0.6;
    this.mode = "walk";
    this.s.cinematicMode = false;
    this.s.gameplay();
    this.drawScreen("ENDURANCE · MESSAGES", "Waiting", "");
    ui.fade(0, 2);
    yield 1;
    yield ui.say("Romilly", "You're back. I'd stopped counting on it.");
    yield ui.say("Cooper", "Rom. How long?");
    yield ui.say("Romilly", "Twenty-three years, four months, and eight days.");
    yield ui.say("Romilly", "There are messages. Years of them. I didn't watch them. They're yours.");
    ui.objective("Watch the messages");
    ui.hint("<kbd>E</kbd> at the screen");
    const near = () => this.s.camera.position.distanceTo(this.screen.position) < 2.6;
    yield () => near() && this.s.input.hit("KeyE");
    ui.objective(null);
    ui.hint(null);
    ui.prompt(null);
    this.mode = "watch";
    this.s.cinematicMode = true;
    yield this.glide(new THREE.Vector3(0, -0.15, -1.3), this.screen.position, 1.4);
    const msgs: [string, string, string, string][] = [
      ["TOM", "Year 1", "Tom", "Hey, Dad. Got my grades back. Second in the class. Grandpa made pie, which was a mistake. Miss you."],
      ["TOM", "Year 4", "Tom", "I met a girl. Lois. I think you'd like her. She says the truck needs new brakes. It does."],
      ["TOM", "Year 9", "Tom", "This is Jesse. Say hi to your grandpa, Jesse. He's up there somewhere."],
      ["TOM", "Year 14", "Tom", "Grandpa died last spring. We put him out by the fence, where he could see the road."],
      ["TOM", "Year 21", "Tom", "You're not getting these, are you. I think I have to let you go now. I love you, Dad."],
      ["MURPH", "Year 23", "Murph", "Hi, Dad. It's my birthday today. I'm the age you were when you left."],
      ["MURPH", "Year 23", "Murph", "You son of a... You said you'd come back. I'm still working on it. Somebody has to."],
    ];
    for (const [who, when, speaker, text] of msgs) {
      this.drawScreen(`MESSAGE · ${who}`, when, speaker);
      audio.blip(880, 0.02);
      yield 0.8;
      yield ui.say(speaker, text);
      yield 0.6;
    }
    this.drawScreen("ENDURANCE · MESSAGES", "End of messages", "");
    yield 2.5;
    this.s.input.capture(false);
    audio.padLevel(0.3, 3);
    ui.end("Chapter seven complete", "Miller", "Three hours on the water. Twenty-three years at home. Next: Gargantua, and the fall. (In production.)", [
      ["Replay chapter", () => this.s.restart(false)],
      ["Chapters", () => this.s.toMenu()],
    ]);
  }
  /** The message screen: a label, a date, and a stylised figure for whoever is speaking. */
  private drawScreen(title: string, when: string, speaker: string) {
    const c = this.screenTex.image as HTMLCanvasElement;
    const g = c.getContext("2d")!;
    g.fillStyle = "#0a1016";
    g.fillRect(0, 0, 512, 320);
    g.fillStyle = "#16222c";
    g.fillRect(8, 8, 496, 304);
    if (speaker) {
      // A face-less figure in a kitchen window's light.
      const grd = g.createLinearGradient(0, 0, 512, 0);
      grd.addColorStop(0, "#3a3226");
      grd.addColorStop(1, "#1c222a");
      g.fillStyle = grd;
      g.fillRect(8, 8, 496, 304);
      g.fillStyle = speaker === "Murph" ? "#8a6a52" : "#7a6048";
      g.beginPath();
      g.arc(256, 150, 46, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = speaker === "Murph" ? "#4c3a2e" : "#5a4636";
      g.fillRect(186, 200, 140, 120);
    }
    g.fillStyle = "#dfe8f0";
    g.font = "600 20px 'IBM Plex Mono', monospace";
    g.fillText(title, 24, 40);
    g.fillStyle = "#9fb4c4";
    g.font = "18px 'IBM Plex Mono', monospace";
    g.fillText(when, 24, 296);
    this.screenTex.needsUpdate = true;
  }

  // --- Frame --------------------------------------------------------------------------------
  update(dt: number) {
    const { s } = this;
    const { ui, input, camera, audio } = s;
    this.t += dt;
    const inRoom = this.checkpoint === "messages";
    if (!inRoom) this.surface.stage(dt, camera);
    if (this.clockOn) this.millerTime += dt;

    // The Ranger floats where it landed (and rides the wave).
    if (this.floating && !inRoom) this.floatRanger(LAND, Math.atan2(-IN.x, -IN.z));

    // Wading.
    if (this.mode === "walk") {
      if (!inRoom) this.colliders.dynamic = [{ x: this.ranger.position.x, z: this.ranger.position.z, r: 6.5, top: 99 }];
      this.walker.update(dt, input, inRoom ? this.roomColliders : this.colliders, camera, !s.inCinematic);
      if (!inRoom) {
        const speed = this.walker.pos.distanceTo(this.lastPos) / Math.max(dt, 1e-4);
        this.lastPos.copy(this.walker.pos);
        this.strideT += dt * speed;
        if (this.strideT > 1.1 && speed > 0.3) {
          this.strideT = 0;
          audio.splash(Math.min(1.2, speed / 2));
        }
        // Get aboard: at the hatch once Brand is free.
        const atHatch = this.walker.pos.distanceTo(HATCH.clone().setY(this.walker.pos.y)) < 3.2;
        if (this.brandFree && atHatch) {
          ui.prompt("E", "Get aboard");
          if (input.hit("KeyE")) {
            this.aboard = true;
            ui.prompt(null);
          }
        } else if (this.brandStuck && this.walker.pos.distanceTo(this.brand.root.position.clone().setY(this.walker.pos.y)) < 2.4) ui.prompt("E", "Lift the panel");
        else ui.prompt(null);
        // The crest arrives: anyone still in the water is gone.
        if (!this.aboard && !this.failing && this.landed && this.surface.waveEta(LAND.x, LAND.z) < 1.5 && this.checkpoint === "wave") {
          this.failing = true;
          this.s.run(
            function* (this: MillerChapter): Generator<Wait> {
              ui.say("", "The wave caught you.", 2.4);
              yield ui.fade(1, 0.8);
              yield 1.4;
              this.s.restart(true);
            }.bind(this),
          );
        }
      } else {
        const nearScreen = camera.position.distanceTo(this.screen.position) < 2.6;
        ui.prompt(nearScreen && this.mode === "walk" ? "E" : null, "Play messages");
      }
    } else if (this.mode !== "watch") ui.prompt(null);
    if (this.cineCam) this.cineCam(dt);

    // People.
    this.stepStrolls(dt);
    const look = camera.position;
    if (this.brand.root.visible) {
      if (this.brandStuck) this.brand.root.position.y = SEABED - 0.35;
      else this.brand.root.position.y = SEABED;
      animatePerson(this.brand, this.t, 2, look);
    }
    if (this.doyle.root.visible) animatePerson(this.doyle, this.t, 4, look);
    if (this.romilly.root.visible) animatePerson(this.romilly, this.t, 5, look);
    this.cas.update(dt, 0);
    this.beacon.intensity = this.recorder.visible ? (Math.sin(this.t * 6) > 0.6 ? 3 : 0) : 0;

    // The roar of the wave as it comes, and the clock that matters.
    if (!inRoom && this.landed) {
      const eta = this.surface.waveEta(LAND.x, LAND.z);
      audio.rumble(this.aboard ? 0.1 : THREE.MathUtils.clamp(1 - eta / 110, 0, 1) * 0.6, 0.5);
    }
    if (this.clockOn || (this.landed && !inRoom))
      ui.telemetry([
        ["Miller", `${Math.floor(this.millerTime / 3600)}:${String(Math.floor((this.millerTime % 3600) / 60)).padStart(2, "0")}:${String(Math.floor(this.millerTime % 60)).padStart(2, "0")}`],
        ["Earth", `+${this.earthTime()}`],
      ]);
    ui.marker(this.marker && !s.inCinematic ? this.marker.at() : null, camera, this.marker?.label);
  }
  private lastPos = new THREE.Vector3();
  /** The Ranger sits on the water (false in the air). */
  private floating = false;
  private roomColliders = (() => {
    const c = new Colliders(false);
    c.box(-4.4, 4.4, -1.8, 1.8, -1.85);
    c.box(-5, 5, -2.4, -1.8, 99, -3);
    c.box(-5, 5, 1.8, 2.4, 99, -3);
    c.box(-5, -4.4, -2.4, 2.4, 99, -3);
    c.box(4.4, 5, -2.4, 2.4, 99, -3);
    return c;
  })();
  private stepStrolls(dt: number) {
    for (const s of this.strolls) {
      const root = s.p.root;
      let moving = 0;
      if (!s.done && s.path.length) {
        const target = s.path[s.i];
        const d = new THREE.Vector3(target.x - root.position.x, 0, target.z - root.position.z);
        const len = d.length();
        if (len <= s.speed * dt) {
          root.position.x = target.x;
          root.position.z = target.z;
          if (++s.i >= s.path.length) s.done = true;
        } else {
          root.position.addScaledVector(d.normalize(), s.speed * dt);
          root.rotation.y = Math.atan2(d.x, d.z);
          moving = 1;
        }
      } else s.done = true;
      if (s.p instanceof Tars) s.p.speed = moving ? s.speed : 0;
      else {
        s.phase += dt * s.speed * 3.4 * moving;
        walkPose(s.p, s.phase, moving ? Math.min(1.4, s.speed / 2) : 0);
      }
    }
  }
}
