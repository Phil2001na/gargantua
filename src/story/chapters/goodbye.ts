import * as THREE from "three";
import type { Chapter, Story } from "../story";
import type { Wait } from "../engine";
import { Walker } from "../controls";
import { person, animatePerson, CAST, type Person } from "../earth/people";
import { ROOM, WATCH_SPOT } from "../earth/room";
import { MOODS } from "../earth/world";
import { Watch } from "../earth/watch";
import { DRIVE_X, ROAD_Z } from "../earth/land";
import { Interactions, Driving, autopilot, walkPose } from "./common";
import type { DriveInput } from "../earth/truck";

/**
 * Chapter four: the night before the launch. Murph won't look at him; Cooper gives her a
 * watch set to the same second as his own and leaves it on her shelf. In the morning she
 * won't come down, and by the time she runs out onto the porch the truck is on the road.
 * A countdown comes in over the drive and cuts straight to the launch.
 * Dialogue is original, written for this project.
 */

type Mode = "cine" | "walk" | "seated" | "drive";
const KEYS = `<kbd>W A S D</kbd> walk / drive · <kbd>Shift</kbd> run · <kbd>E</kbd> interact<br><kbd>1</kbd> <kbd>2</kbd> choose a reply · <kbd>C</kbd> truck camera · mouse to look<br>Hold <kbd>Space</kbd> in a cutscene to skip it`;
const F = ROOM.floor;
const DOOR = new THREE.Vector3(-1.75, F, 0.35);
/** Murph, sitting on her bed with her back to the door. */
const MURPH_BED = new THREE.Vector3(-3.45, F + 0.27, 0.32);
/** Where Cooper sits: the foot of the bed, behind her. */
const SIT = new THREE.Vector3(-2.92, F + 1.38, -0.2);
/** The two watches, side by side on the quilt between them. */
const QUILT = new THREE.Vector3(-3.16, F + 0.632, 0.06);
/** The watches read the same time: a quarter past nine in the evening. */
const CLOCK0 = 21 * 3600 + 14 * 60 + 5;
const PORCH = new THREE.Vector3(0, 0.6, 4.55);
const UP = new THREE.Vector3(0, 1, 0);
const SENS = 0.0022;

type Stroll = { p: Person; path: THREE.Vector3[]; speed: number; i: number; phase: number; done: boolean };

export class GoodbyeChapter implements Chapter {
  readonly title = "04 · Don't Go";
  readonly keys = KEYS;
  checkpoint = "start";
  modal = false;
  private mode: Mode = "cine";
  private scene: "room" | "farm" = "room";
  private walker = new Walker();
  private driving: Driving;
  private things = new Interactions();
  private murphBed: Person;
  private murph: Person;
  private tom: Person;
  private mine = new Watch();
  private hers = new Watch();
  private strolls: Stroll[] = [];
  private cineCam: ((dt: number) => void) | null = null;
  private marker: { at: () => THREE.Vector3; label: string } | null = null;
  private auto: DriveInput | null = null;
  private autoTo = new THREE.Vector3();
  private autoSpeed = 15;
  private seatYaw = 0;
  private seatPitch = 0;
  private seatBase = 0;
  private picked = -1;
  private flag = new Set<string>();
  private ghostT = -1;
  private closeUp = false;
  private lastTick = 0;
  private engineOn = true;
  private t = 0;
  /** Light from the landing through her open door. */
  private hall = new THREE.PointLight(0xffd9a8, 0, 6, 1.4);
  /** A soft fill that rides with the camera in the close-ups. */
  private fill = new THREE.PointLight(0xffe2b8, 0, 1.5, 2);
  constructor(private s: Story) {
    this.driving = new Driving(s);
    this.murphBed = person(CAST.murph, true);
    // Legs out along the mattress rather than bent over the edge.
    for (const leg of [this.murphBed.legL, this.murphBed.legR]) leg.children[1].rotation.x = 0.18;
    this.murphBed.armL.rotation.x = this.murphBed.armR.rotation.x = -0.55;
    this.murph = person(CAST.murph);
    this.tom = person(CAST.tom);
    for (const w of [this.mine, this.hers]) w.group.rotation.y = Math.PI / 2;
    this.hall.position.set(-1.75, F + 2.0, 0.55);
    s.earth.scene.add(this.murphBed.root, this.murph.root, this.tom.root, this.mine.group, this.hers.group, this.hall, this.fill);
    this.hide();
  }
  private get w() {
    return this.s.earth;
  }
  private hide() {
    for (const o of [this.murphBed.root, this.murph.root, this.tom.root, this.mine.group, this.hers.group]) o.visible = false;
  }

  // --- Setup -----------------------------------------------------------------
  start(checkpoint = "start") {
    const { w } = this;
    this.checkpoint = checkpoint;
    w.resetScene();
    w.corn.reset();
    w.truck.place(DRIVE_X, 16, 0);
    const run = {
      start: () => this.watch(),
      porch: () => this.porch(),
      road: () => this.leave(true),
    }[checkpoint];
    this.s.run(run ?? (() => this.watch()));
  }
  dispose() {
    const { w } = this;
    w.scene.remove(this.murphBed.root, this.murph.root, this.tom.root, this.mine.group, this.hers.group, this.hall, this.fill);
    this.setNear(0.2);
    w.resetScene();
    this.s.ui.reset();
    this.s.input.capture(false);
  }
  skip() {
    // Lines are cleared by the story; camera glides just finish.
    this.s.ui.hideCard();
    if (this.s.ui.fadeValue > 0.5 && this.mode !== "cine") this.s.ui.fade(0, 0.3);
  }
  private setNear(near: number) {
    this.s.camera.near = near;
    this.s.camera.updateProjectionMatrix();
  }

  // --- Scene 1: the watch ----------------------------------------------------------
  private *watch(): Generator<Wait> {
    const { ui, audio } = this.s;
    const { w } = this;
    const { room } = w;
    this.checkpoint = "start";
    this.scene = "room";
    // Dusk: the last blue in the window, the bedside lamp on.
    w.setMood(MOODS.evening, MOODS.night, 0.72);
    w.indoor = 1;
    w.shadowSpan = 12;
    room.lampOn(1.5);
    this.hall.intensity = 2.2;
    room.setSash(0);
    room.booksHome(true);
    for (const i of [0, 1, 2]) room.pushBook(i, 1);
    room.landerOnShelf(true);
    // A close-up of a 4 cm watch needs a near plane closer than the default.
    this.setNear(0.02);
    this.s.camera.fov = 62;
    this.s.camera.updateProjectionMatrix();
    const m = this.murphBed.root;
    m.visible = true;
    m.position.copy(MURPH_BED);
    m.rotation.y = -Math.PI / 2;
    const toMurph = new THREE.Vector3(MURPH_BED.x - DOOR.x, 0, MURPH_BED.z - (DOOR.z - 0.2));
    this.walkHere(DOOR.x, DOOR.z - 0.2, Math.atan2(-toMurph.x, -toMurph.z), -0.28);
    ui.fade(1, 0);
    ui.card("Chapter four", "Don't Go", "The night before.");
    audio.padLevel(0.22, 4);
    yield 3.2;
    ui.hideCard();
    ui.fade(0, 2);
    yield 1.4;
    audio.padLevel(0, 4);
    ui.objective("Talk to Murph");
    ui.hint("<kbd>W A S D</kbd> walk · mouse to look · <kbd>E</kbd> interact");
    this.things.clear();
    this.things.add({
      at: () => room.ghostBooks[1].position.clone(),
      label: "Look at the books",
      range: 2.4,
      when: () => !this.flag.has("books"),
      act: () => {
        this.flag.add("books");
        this.s.side.run(function* (): Generator<Wait> {
          yield ui.say("Cooper", "She's left them where they fell. Every one.");
        });
      },
    });
    this.things.add({
      at: () => this.murphHead(),
      label: "Sit with Murph",
      range: 2.2,
      act: () => this.flag.add("sit"),
    });
    yield () => this.flag.has("sit");
    this.s.side.stop();
    ui.clearLines();
    this.things.clear();
    ui.objective(null);
    ui.hint(null);
    this.mode = "cine";
    yield this.glide(SIT, this.murphHead(), 1.8);
    this.sit();
    yield 0.6;
    yield ui.say("Cooper", "Murph.");
    yield ui.say("Murph", "Go away.");
    yield ui.say("Cooper", "Not like this. I'm not leaving it like this.");
    yield ui.say("Murph", "You're leaving anyway. What does it matter how?");
    yield* this.choose(["Tell her why he has to go", "Tell her what happens to time"]);
    if (this.picked === 0) {
      yield ui.say("Cooper", "They need a pilot. There might be somewhere out there people can live, and if nobody goes to look, nobody finds it.");
      yield ui.say("Murph", "So let somebody else look.");
      yield ui.say("Cooper", "There isn't anybody else. That's the trouble.");
    } else {
      yield ui.say("Cooper", "Where I'm going, clocks run slow. By the time I get back, you and I might be the same age.");
      yield ui.say("Murph", "That's not funny.");
      yield ui.say("Cooper", "It isn't a joke. It's just how time works, out there.");
    }
    yield 0.8;
    yield ui.say("Murph", "I worked out the ghost, you know.");
    yield ui.say("Murph", "The gaps in the books. Short ones and long ones. It's Morse code.");
    yield ui.say("Cooper", "And what does it say?");
    yield ui.say("Murph", "One word. Stay.");
    yield 0.8;
    // As if it heard her.
    this.ghostT = 0;
    yield () => this.ghostT > 1;
    yield 0.9;
    yield ui.say("Murph", "See? Even it wants you to stay.");
    yield ui.say("Cooper", "Murph...");
    yield ui.say("Murph", "Please. Just stay.");
    yield 0.6;
    // The gift.
    ui.objective("Give Murph the watch");
    this.things.add({ at: () => this.murphHead(), label: "Give her the watch", range: 2, act: () => this.flag.add("give") });
    yield () => this.flag.has("give");
    this.things.clear();
    ui.objective(null);
    this.mode = "cine";
    this.s.cinematicMode = true;
    for (const [watch, dz] of [
      [this.mine, 0],
      [this.hers, 0.075],
    ] as [Watch, number][]) {
      watch.group.visible = true;
      watch.group.position.copy(QUILT).add(new THREE.Vector3(0, 0, dz));
    }
    const mid = QUILT.clone().add(new THREE.Vector3(0, 0, 0.0375));
    yield this.glide(mid.clone().add(new THREE.Vector3(0.17, 0.2, 0.01)), mid, 2.6, 34);
    this.closeUp = true;
    yield 1;
    yield ui.say("Cooper", "One for you, one for me. Set to the same second.");
    yield ui.say("Cooper", "When I get back, we'll hold them side by side and see whose clock ran faster.");
    yield ui.say("Murph", "You don't know when you'll get back.");
    yield 0.6;
    yield ui.say("Cooper", "No. I don't.");
    yield 0.8;
    this.closeUp = false;
    yield this.glide(SIT, this.murphHead(), 2.2, 62);
    this.s.cinematicMode = false;
    this.sit();
    yield ui.say("Murph", "Then go. If you're going, just go.");
    yield 1.2;
    yield ui.say("Cooper", "I love you, Murph. I'm coming back. I promise you that.");
    yield 3;
    // She doesn't answer. He leaves her watch where she'll find it.
    this.hers.group.visible = this.mine.group.visible = false;
    this.walkHere(-2.55, -0.45, Math.atan2(-1.37, 2.23), -0.1);
    this.s.gameplay();
    ui.objective("Leave the watch where she'll find it");
    this.things.add({
      at: () => WATCH_SPOT.clone(),
      label: "Leave the watch on the shelf",
      range: 2.4,
      act: () => {
        this.flag.add("left");
        room.watchOnShelf(true);
        audio.tick(2);
      },
    });
    yield () => this.flag.has("left");
    this.things.clear();
    ui.objective(null);
    // A last look at it, ticking in the lamplight.
    const { yaw, pitch } = this.walker;
    const back = this.walker.pos.clone();
    this.mode = "cine";
    this.closeUp = true;
    yield this.glide(WATCH_SPOT.clone().add(new THREE.Vector3(-0.26, 0.17, 0.06)), WATCH_SPOT, 1.6, 38);
    yield 2.4;
    this.closeUp = false;
    yield this.glide(back.clone().setY(F + 1.7), back.clone().setY(F + 1.7).add(new THREE.Vector3(-Math.sin(yaw), Math.tan(pitch), -Math.cos(yaw))), 1.2, 62);
    this.walkHere(back.x, back.z, yaw, pitch);
    yield 0.4;
    ui.objective("Go");
    this.things.add({ at: () => DOOR.clone().setY(F + 1.2), label: "Leave", range: 1.8, act: () => this.flag.add("door") });
    yield () => this.flag.has("door");
    this.things.clear();
    ui.objective(null);
    this.mode = "cine";
    this.s.cinematicMode = true;
    yield ui.say("Cooper", "Goodnight, Murph.");
    yield 1.4;
    yield ui.fade(1, 1.8);
    yield 0.8;
    yield* this.porch();
  }
  private murphHead() {
    return MURPH_BED.clone().add(new THREE.Vector3(0, 0.92, 0));
  }
  /** Sit at the foot of the bed: free to look around, not to walk. */
  private sit() {
    const e = new THREE.Euler().setFromQuaternion(this.s.camera.quaternion, "YXZ");
    this.seatYaw = this.seatBase = e.y;
    this.seatPitch = e.x;
    this.mode = "seated";
    this.s.gameplay();
  }
  private walkHere(x: number, z: number, yaw: number, pitch = 0) {
    this.walker.place(x, F, z, yaw, pitch);
    this.walker.eye = 1.7;
    this.mode = "walk";
    this.s.cinematicMode = false;
    this.s.gameplay();
  }
  /** Ease the camera to a new place and aim; optionally change the lens. */
  private glide(to: THREE.Vector3, look: THREE.Vector3, seconds: number, fov?: number): Wait {
    const cam = this.s.camera;
    const p0 = cam.position.clone(),
      q0 = cam.quaternion.clone(),
      f0 = cam.fov,
      f1 = fov ?? f0;
    const q1 = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().lookAt(to, look, UP));
    let u = 0;
    this.cineCam = (dt) => {
      u = Math.min(1, u + dt / seconds);
      const e = u * u * (3 - 2 * u);
      cam.position.lerpVectors(p0, to, e);
      cam.quaternion.slerpQuaternions(q0, q1, e);
      cam.fov = f0 + (f1 - f0) * e;
      cam.updateProjectionMatrix();
      if (u >= 1) this.cineCam = null;
    };
    return () => u >= 1;
  }
  private *choose(options: string[]): Generator<Wait> {
    const { ui, input } = this.s;
    this.picked = -1;
    ui.choice(options);
    yield () => {
      options.forEach((_, i) => {
        if (this.picked < 0 && input.hit(`Digit${i + 1}`, `Numpad${i + 1}`)) this.picked = i;
      });
      return this.picked >= 0;
    };
    ui.choice(null);
  }

  // --- Scene 2: the porch ------------------------------------------------------------
  private *porch(): Generator<Wait> {
    const { ui } = this.s;
    const { w } = this;
    this.checkpoint = "porch";
    this.scene = "farm";
    this.hide();
    this.hall.intensity = 0;
    this.flag.clear();
    this.things.clear();
    w.resetScene();
    w.room.watchOnShelf(true);
    this.setNear(0.2);
    this.s.camera.fov = 60;
    this.s.camera.updateProjectionMatrix();
    const truck = w.truck;
    truck.place(DRIVE_X, 16, 0);
    truck.tom.root.visible = truck.murph.root.visible = truck.cooper.root.visible = false;
    // Tom waits by the truck, facing the house.
    const tp = truck.local(-2.1, 0.7);
    this.tom.root.visible = true;
    this.tom.root.position.set(tp.x, 0, tp.y);
    this.tom.root.rotation.y = Math.atan2(-tp.x, 5 - tp.y);
    this.walker.place(PORCH.x, PORCH.y, PORCH.z, Math.atan2(-DRIVE_X, -(16 - PORCH.z)), -0.08);
    this.walker.eye = 1.7;
    this.mode = "walk";
    this.s.cinematicMode = false;
    this.s.gameplay();
    ui.fade(1, 0);
    ui.card("", "The next morning", "");
    yield 2.2;
    ui.hideCard();
    ui.fade(0, 1.4);
    yield 1;
    ui.objective("Say goodbye");
    ui.hint("<kbd>W A S D</kbd> walk · mouse to look · <kbd>E</kbd> interact");
    const donald = w.farm.donald.root;
    this.things.add({
      at: () => donald.position.clone().add(new THREE.Vector3(0, 1.2, 0)),
      label: "Talk to Donald",
      range: 2.6,
      when: () => !this.flag.has("donald") && !ui.talking,
      act: () => {
        this.flag.add("donald");
        this.s.side.run(
          function* (this: GoodbyeChapter): Generator<Wait> {
            yield ui.say("Donald", "She won't come down. I went up twice.");
            yield ui.say("Cooper", "Don't push her. She's allowed to be angry with me.");
            yield ui.say("Donald", "Go on, then. Find us somewhere better than this.");
            yield ui.say("Cooper", "Look after them, Donald.");
            yield ui.say("Donald", "I always have.");
            this.flag.add("donaldDone");
          }.bind(this),
        );
      },
    });
    this.things.add({
      at: () => this.tom.root.position.clone().add(new THREE.Vector3(0, 1.5, 0)),
      label: "Say goodbye to Tom",
      range: 2.6,
      when: () => !this.flag.has("tom") && !ui.talking,
      act: () => {
        this.flag.add("tom");
        this.s.side.run(
          function* (this: GoodbyeChapter): Generator<Wait> {
            yield ui.say("Tom", "Grandpa says you might be gone a long time.");
            yield ui.say("Cooper", "Might be. You're running this farm till I'm back.");
            yield ui.say("Tom", "Can I drive the truck?");
            yield ui.say("Cooper", "It's yours. Keep it on the road.");
            yield ui.say("Tom", "Mostly.");
            yield ui.say("Cooper", "Mostly.");
            this.flag.add("tomDone");
          }.bind(this),
        );
      },
    });
    this.marker = { at: () => this.tom.root.position.clone().setY(2), label: "Tom" };
    yield () => this.flag.has("donaldDone") && this.flag.has("tomDone");
    yield 0.4;
    yield* this.leave(false);
  }

  // --- Scene 3: the road ------------------------------------------------------------
  private *leave(fromCheckpoint: boolean): Generator<Wait> {
    const { ui } = this.s;
    const { w } = this;
    const truck = w.truck;
    this.checkpoint = "road";
    this.scene = "farm";
    if (fromCheckpoint) {
      this.hide();
      w.room.watchOnShelf(true);
      truck.place(DRIVE_X, 16, 0);
      truck.tom.root.visible = truck.murph.root.visible = truck.cooper.root.visible = false;
      const tp = truck.local(-2.1, 0.7);
      this.tom.root.visible = true;
      this.tom.root.position.set(tp.x, 0, tp.y);
      this.tom.root.rotation.y = Math.atan2(-tp.x, 5 - tp.y);
      this.walker.place(tp.x + 2.4, 0, tp.y + 2.5, Math.PI - 0.3);
      this.mode = "walk";
      this.s.gameplay();
    }
    ui.objective("Get in the truck");
    ui.hint("<kbd>W A S D</kbd> walk · <kbd>E</kbd> get in");
    this.marker = { at: () => this.doorPos(), label: "Truck" };
    this.things.clear();
    this.things.add({ at: () => this.doorPos(), label: "Drive", range: 2.6, act: () => this.flag.add("board") });
    yield () => this.flag.has("board");
    this.things.clear();
    this.mode = "drive";
    this.driving.cam.reset();
    this.s.gameplay();
    ui.objective("Drive");
    ui.hint("<kbd>W</kbd>/<kbd>S</kbd> drive · <kbd>A</kbd>/<kbd>D</kbd> steer · <kbd>C</kbd> camera · mouse to look back");
    this.marker = { at: () => new THREE.Vector3(DRIVE_X, 2, ROAD_Z), label: "Road" };
    // Look back at the house, or reach the road: either way, she comes out too late.
    const house = new THREE.Vector3(0, 3, 4);
    const dir = new THREE.Vector3();
    yield () => {
      const away = Math.hypot(truck.pos.x - DRIVE_X, truck.pos.z - 16);
      const back = this.s.camera.getWorldDirection(dir).dot(house.clone().sub(this.s.camera.position).normalize()) > 0.85;
      return (away > 20 && back) || truck.pos.z > ROAD_Z - 3 || away > 60;
    };
    this.marker = null;
    ui.objective(null);
    ui.hint(null);
    yield* this.tooLate();
  }

  private *tooLate(): Generator<Wait> {
    const { ui, audio } = this.s;
    const { w } = this;
    const truck = w.truck;
    this.mode = "cine";
    this.s.cinematicMode = true;
    // Out of sight, put the truck at the end of the driveway, turning east, and let it
    // drive itself slowly enough to stay in view of the porch.
    truck.place(DRIVE_X + 4, ROAD_Z, Math.PI / 2);
    truck.vel.set(6, 0);
    this.autoSpeed = 7;
    this.auto = autopilot(truck, this.autoTo.set(1e4, 0, ROAD_Z), this.autoSpeed);
    const cam = this.s.camera;
    cam.fov = 50;
    cam.updateProjectionMatrix();
    cam.position.set(3.3, 2.1, 6.3);
    cam.lookAt(0.1, 1.5, 4.9);
    const m = this.murph;
    const rail = new THREE.Vector3(0.35, 0.6, 6.3);
    m.root.visible = true;
    m.root.position.set(0, 0.6, 4.25);
    m.root.rotation.y = 0;
    audio.thud(2.2);
    yield 0.3;
    this.stroll(m, [new THREE.Vector3(0.1, 0.6, 5.4), rail], 2.2);
    yield 1.4;
    yield ui.say("Murph", "Dad?");
    yield 0.4;
    // Over her shoulder: the pickup and its dust, already out on the road.
    const dir = truck.pos.clone().sub(rail).setY(0).normalize();
    const side = new THREE.Vector3(-dir.z, 0, dir.x);
    const over = rail.clone().addScaledVector(dir, -1.5).addScaledVector(side, 0.45).setY(2.2);
    yield this.glide(over, truck.pos.clone().add(new THREE.Vector3(0, 1.5, 0)), 2.4, 40);
    let follow = true;
    this.cineCam = () => {
      if (follow) cam.lookAt(truck.pos.x, truck.pos.y + 1.5, truck.pos.z);
    };
    yield ui.say("Murph", "Dad!");
    yield 2.6;
    follow = false;
    this.cineCam = null;
    // Back in the cab. The road, and nobody beside him.
    this.auto = null;
    this.mode = "drive";
    this.driving.cam.reset();
    this.driving.cam.mode = "cabin";
    this.s.cinematicMode = false;
    this.s.gameplay();
    m.root.visible = false;
    ui.objective("Drive");
    ui.hint("<kbd>W</kbd>/<kbd>S</kbd> drive · <kbd>A</kbd>/<kbd>D</kbd> steer · <kbd>C</kbd> camera");
    yield* this.countdown();
  }

  /** The sound bridge: mission control comes in over the drive, then the launch cuts in. */
  private *countdown(): Generator<Wait> {
    const { ui, audio } = this.s;
    audio.padLevel(0.18, 6);
    yield 5;
    ui.hint(null);
    ui.objective(null);
    const mc = (text: string) => {
      audio.radio();
      return ui.say("Mission control", text, 1.9);
    };
    yield mc("All stations, final status check for launch.");
    yield 1.2;
    yield mc("Guidance is go. Range is go. Ranger crew is go.");
    audio.rumble(0.04, 6);
    yield 1;
    yield mc("T minus ten.");
    const counts = ["Nine. Ignition sequence start.", "Eight.", "Seven.", "Six.", "Five.", "Four.", "Three.", "Two.", "One."];
    for (let i = 0; i < counts.length; i++) {
      audio.rumble(0.08 + i * 0.07, 1);
      audio.padLevel(0.18 + i * 0.03, 1);
      ui.say("Mission control", counts[i], 0.95);
      yield 1;
    }
    // Zero: straight to the launch.
    ui.clearLines();
    this.engineOn = false;
    this.mode = "cine";
    this.s.input.capture(false);
    audio.padLevel(0, 0.2);
    audio.rumble(1, 0.1);
    ui.fade(1, 0.04);
    ui.say("", "Liftoff.", 2.4);
    yield 2.8;
    audio.rumble(0.25, 5);
    yield 1.5;
    audio.padLevel(0.3, 3);
    ui.end("Chapter four complete", "Don't Go", "Next: Liftoff. From the pad to orbit in one unbroken climb.", [
      ["Continue ▶", () => this.s.play("launch")],
      ["Replay chapter", () => this.s.restart(false)],
      ["Chapters", () => this.s.toMenu()],
    ]);
  }

  // --- Helpers -----------------------------------------------------------------------
  private doorPos() {
    const d = this.w.truck.local(1.35, 0.1);
    return new THREE.Vector3(d.x, this.w.truck.pos.y + 1.2, d.y);
  }
  private stroll(p: Person, path: THREE.Vector3[], speed: number) {
    this.strolls = this.strolls.filter((s) => s.p !== p);
    this.strolls.push({ p, path, speed, i: 0, phase: 0, done: false });
  }
  private stepStrolls(dt: number) {
    for (const s of this.strolls) {
      const root = s.p.root;
      let moving = 0;
      if (!s.done) {
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
      }
      s.phase += dt * s.speed * 3.4 * moving;
      walkPose(s.p, s.phase, moving ? Math.min(1.4, s.speed / 2) : 0);
    }
  }

  // --- Frame -------------------------------------------------------------------------
  update(dt: number) {
    const { w, s } = this;
    const { ui, input, camera, audio } = s;
    this.t += dt;

    // Every watch in the world keeps the same time.
    const clock = CLOCK0 + this.t;
    for (const watch of [this.mine, this.hers, w.room.watch]) watch.set(clock);
    if (this.closeUp && Math.floor(clock) !== this.lastTick) audio.tick(1);
    this.fill.intensity = THREE.MathUtils.damp(this.fill.intensity, this.closeUp ? 0.32 : 0, 3, dt);
    this.fill.position.copy(camera.position).add(new THREE.Vector3(0, 0.12, 0));
    this.lastTick = Math.floor(clock);

    // The ghost pushes one more book.
    if (this.ghostT >= 0 && this.ghostT <= 1.2) {
      const prev = this.ghostT;
      this.ghostT += dt / 1.6;
      w.room.pushBook(3, Math.min(1, this.ghostT));
      if (prev < 1 && this.ghostT >= 1) audio.thud(1.6);
    }

    if (this.scene === "farm") {
      const truck = w.truck;
      if (this.auto) this.auto = autopilot(truck, this.autoTo.set(truck.pos.x + 30, 0, ROAD_Z), this.autoSpeed);
      const control = this.mode === "drive";
      this.driving.update(dt, control, control, w.farm.colliders, this.engineOn, this.auto ?? undefined);
      w.farm.colliders.dynamic = [
        ...[0, 1.6, -1.6].map((z) => {
          const p = truck.local(0, z);
          return { x: p.x, z: p.y, r: 1.0, top: truck.pos.y + 2 };
        }),
        ...(this.tom.root.visible ? [{ x: this.tom.root.position.x, z: this.tom.root.position.z, r: 0.35, top: 2 }] : []),
      ];
      audio.birds(dt, this.mode === "walk");
      animatePerson(w.farm.donald, w.time, 3, this.mode === "walk" ? camera.position : truck.pos.clone().setY(1.5));
      if (this.tom.root.visible) animatePerson(this.tom, w.time, 1, this.mode === "walk" ? camera.position : truck.pos.clone().setY(1.5));
      if (this.murph.root.visible) {
        const st = this.strolls.find((q) => q.p === this.murph);
        if (st?.done) {
          const r = this.murph.root;
          const want = Math.atan2(truck.pos.x - r.position.x, truck.pos.z - r.position.z);
          let d = want - r.rotation.y;
          d = Math.atan2(Math.sin(d), Math.cos(d));
          r.rotation.y += d * (1 - Math.exp(-4 * dt));
        }
        animatePerson(this.murph, w.time, 2, truck.pos.clone().setY(1.5));
      }
    } else {
      ui.speed(null);
      audio.truck(false, 0, 0, 0, 0, 0);
      audio.crickets(dt, true);
      if (this.murphBed.root.visible) animatePerson(this.murphBed, w.time, 2, new THREE.Vector3(-4.8, F + 1.1, 0.25));
    }

    // Controls and camera.
    if (this.mode === "walk") {
      this.walker.update(dt, input, this.scene === "room" ? w.room.colliders : w.farm.colliders, camera, !s.inCinematic);
      this.things.update(s, !s.inCinematic);
    } else if (this.mode === "seated" && !this.cineCam) {
      const m = input.mouse();
      this.seatYaw = THREE.MathUtils.clamp(this.seatYaw - m.dx * SENS, this.seatBase - 1.3, this.seatBase + 1.3);
      this.seatPitch = THREE.MathUtils.clamp(this.seatPitch - m.dy * SENS, -1.1, 0.9);
      camera.position.copy(SIT);
      camera.rotation.set(this.seatPitch, this.seatYaw, 0, "YXZ");
      this.things.update(s, true);
    } else if (this.mode !== "drive") ui.prompt(null);
    if (this.cineCam) this.cineCam(dt);
    this.stepStrolls(dt);

    ui.marker(this.marker && !s.inCinematic ? this.marker.at() : null, camera, this.marker?.label);
    w.update(dt, camera);
  }
}
