import * as THREE from "three";
import type { Chapter, Story } from "../story";
import { Rail, type Wait } from "../engine";
import { Walker } from "../controls";
import { person, animatePerson, CAST, type Person } from "../earth/people";
import { ROOM, MESSAGE, BITS } from "../earth/room";
import { MOODS } from "../earth/world";
import { DRIVE_X, ROAD_Z } from "../earth/land";
import { Interactions, Driving } from "./common";
import { Notebook } from "./notebook";

/**
 * Chapter two: Murph's "ghost" knocks books off her shelf; two days later a dust storm
 * chases the family home, pours in through her open window and settles in bands.
 * Cooper copies the bands down and reads them as binary: a pair of coordinates.
 * Dialogue is original, written for this project.
 */

type Mode = "cine" | "walk" | "drive" | "notebook";
const KEYS = `<kbd>W A S D</kbd> walk / drive · <kbd>Shift</kbd> run · <kbd>E</kbd> interact<br><kbd>N</kbd> notebook (once you have it) · <kbd>C</kbd> truck camera · mouse to look<br>Hold <kbd>Space</kbd> in a cutscene to skip it`;
const DOOR = new THREE.Vector3(-1.75, ROOM.floor, 0.35);
const YARD = new THREE.Vector3(DRIVE_X, 0, 20);

export class GhostChapter implements Chapter {
  readonly title = "02 · The Ghost";
  readonly keys = KEYS;
  checkpoint = "start";
  modal = false;
  private mode: Mode = "cine";
  private walker = new Walker();
  private driving: Driving;
  private things = new Interactions();
  private murphSeated: Person;
  private murphStanding: Person;
  private scene: "room" | "drive" | "storm" | "night" = "room";
  private looked = new Set<string>();
  private ghostT = -1;
  private ghostBook = 2;
  private ghostSeen = false;
  private notebook: Notebook | null = null;
  private notes: number[][] | null = null;
  private solved = false;
  private arrived = false;
  private stormGo = false;
  private flicker = 0;
  private t = 0;
  constructor(private s: Story) {
    this.driving = new Driving(s);
    this.murphSeated = person(CAST.murph, true);
    this.murphStanding = person(CAST.murph);
    s.earth.scene.add(this.murphSeated.root, this.murphStanding.root);
    this.murphSeated.root.visible = this.murphStanding.root.visible = false;
  }
  private get w() {
    return this.s.earth;
  }

  // --- Setup -----------------------------------------------------------------
  start(checkpoint = "start") {
    const { w } = this;
    this.checkpoint = checkpoint;
    w.resetScene();
    w.corn.reset();
    w.truck.place(DRIVE_X, 16, 0);
    this.s.camera.fov = 62;
    this.s.camera.updateProjectionMatrix();
    const run = {
      start: () => this.evening(),
      storm: () => this.driveHome(),
      dust: () => this.dustComes(),
      puzzle: () => this.night(),
    }[checkpoint];
    this.s.run(run ?? (() => this.evening()));
  }
  dispose() {
    this.notebook?.dispose();
    this.notebook = null;
    this.w.scene.remove(this.murphSeated.root, this.murphStanding.root);
    this.w.farm.donald.root.visible = true;
    this.w.resetScene();
    this.s.ui.reset();
    this.s.input.capture(false);
  }
  skip() {
    if (this.scene === "room" && this.mode === "cine") {
      this.s.ui.hideCard();
      this.s.ui.fade(0, 0.3);
    }
  }
  private sweep = false;

  // --- Room set-up helpers ---------------------------------------------------
  private enterRoom(mood: keyof typeof MOODS) {
    const { w } = this;
    w.setMood(MOODS[mood]);
    w.indoor = 1;
    w.shadowSpan = 12;
    w.storm.strength = 0;
    this.s.camera.fov = 62;
    this.s.camera.updateProjectionMatrix();
  }
  private seatMurph(on: boolean) {
    const m = this.murphSeated.root;
    m.visible = on;
    m.position.set(-3.55, ROOM.floor + 0.27, -0.12);
    m.rotation.y = Math.PI;
  }
  private standMurph(on: boolean, x = -2.3, z = 0.35, yaw = Math.PI * 0.85) {
    const m = this.murphStanding.root;
    m.visible = on;
    m.position.set(x, ROOM.floor, z);
    m.rotation.y = yaw;
  }
  private walkHere(x: number, z: number, yaw: number, pitch = 0) {
    this.walker.place(x, ROOM.floor, z, yaw, pitch);
    this.walker.eye = 1.7;
    this.mode = "walk";
    this.s.gameplay();
  }

  // --- Scene 1: the ghost ----------------------------------------------------
  private *evening(): Generator<Wait> {
    const { ui, audio } = this.s;
    const { room } = this.w;
    this.scene = "room";
    this.mode = "cine";
    this.enterRoom("evening");
    this.seatMurph(true);
    this.standMurph(false);
    // Two books are already on the floor, and the lander with them.
    room.booksHome(true);
    room.pushBook(0, 1);
    room.pushBook(1, 1);
    room.landerOnShelf(false);
    room.lampOn(0.6);
    ui.fade(1, 0);
    const shelf = room.shelfFront.clone();
    const rail = this.s.cinematic(
      new Rail(
        [new THREE.Vector3(-1.75, 5.2, 0.2), new THREE.Vector3(-2.2, 5.0, -0.6), new THREE.Vector3(-2.5, 5.25, -1.3)],
        [new THREE.Vector3(-4.8, 4.8, -2), shelf.clone().add(new THREE.Vector3(0, -0.4, 0.4)), new THREE.Vector3(-1.6, 3.7, -2.4)],
        14,
      ),
    );
    audio.padLevel(0.3, 5);
    yield 0.4;
    ui.fade(0, 3);
    yield 1;
    ui.card("Chapter two", "The Ghost", "That evening.");
    yield 4;
    ui.hideCard();
    yield ui.say("Murph", "It happened again, Dad.");
    yield ui.say("Cooper", "What did?");
    yield ui.say("Murph", "The books. I was right here on the bed and they came off the shelf. Nobody touched them.");
    yield rail;
    audio.padLevel(0, 3);
    yield* this.lookAround();
  }

  private *lookAround(): Generator<Wait> {
    const { ui } = this.s;
    const { room } = this.w;
    this.checkpoint = "start";
    const e = new THREE.Euler().setFromQuaternion(this.s.camera.quaternion, "YXZ");
    this.walkHere(-2.5, -1.3, e.y, e.x);
    ui.objective("Look around Murph's room");
    ui.hint("<kbd>W A S D</kbd> walk · mouse to look · <kbd>E</kbd> interact");
    this.things.clear();
    const books = this.things.add({
      at: () => room.ghostBooks[0].position.clone(),
      label: "Look at the books",
      range: 2.4,
      when: () => !this.looked.has("books"),
      act: () => {
        this.looked.add("books");
        this.s.side.run(
          function* (): Generator<Wait> {
            yield ui.say("Cooper", "Same ones as last time?");
            yield ui.say("Murph", "Different ones. It's always a gap in the same places, though.");
          }.bind(this),
        );
      },
    });
    this.things.add({
      at: () => room.lander.position.clone(),
      label: "Pick up the lander",
      range: 2.2,
      when: () => !this.looked.has("lander"),
      act: () => {
        this.looked.add("lander");
        room.landerOnShelf(true);
        this.s.audio.thud(0.8);
        this.s.side.run(
          function* (): Generator<Wait> {
            yield ui.say("Cooper", "One leg's bent. I can straighten that.");
            yield ui.say("Murph", "It knocks that off too. Every time.");
          }.bind(this),
        );
      },
    });
    this.things.add({
      at: () => room.shelfFront.clone(),
      label: "Look at the bookshelf",
      range: 2.4,
      when: () => !this.looked.has("shelf") && this.ghostT < 0,
      act: () => {
        this.looked.add("shelf");
        // While you're looking: the ghost pushes another one.
        this.s.side.run(
          function* (this: GhostChapter): Generator<Wait> {
            yield ui.say("Cooper", "Solid shelf. Nothing loose.");
            yield 1.2;
            this.ghostT = 0;
            yield () => this.ghostT > 1;
            yield 0.6;
            yield ui.say("Murph", "There! You saw that. Tell me you saw that.");
            yield ui.say("Cooper", "I saw a book fall off a shelf.");
            yield ui.say("Murph", "By itself!");
            this.ghostSeen = true;
          }.bind(this),
        );
      },
    });
    yield () => this.looked.size >= 3 && this.ghostSeen && !ui.talking;
    this.things.remove(books);
    yield 0.6;
    yield ui.say("Cooper", "Old house. Floors settle, things creep toward the edge.");
    yield ui.say("Murph", "Grandpa says it's a ghost.");
    yield ui.say("Cooper", "Grandpa also says the corn used to be taller than the barn.");
    yield ui.say("Cooper", "Here's what you do. Don't guess. Write down what falls, and where, and when. Get the facts first. Then work out what they mean.");
    yield ui.say("Murph", "And then you'll believe me?");
    yield ui.say("Cooper", "Then I'll look at your facts. Deal?");
    yield ui.say("Murph", "Deal.");
    ui.objective(null);
    ui.hint(null);
    this.things.clear();
    this.mode = "cine";
    this.s.cinematicMode = true;
    yield ui.fade(1, 1.6);
    yield 0.6;
    yield* this.driveHome();
  }

  // --- Scene 2: race the storm home ------------------------------------------
  private *driveHome(): Generator<Wait> {
    const { ui, audio } = this.s;
    const { w } = this;
    this.checkpoint = "storm";
    this.scene = "drive";
    this.seatMurph(false);
    this.standMurph(false);
    w.resetScene();
    w.setMood(MOODS.evening);
    w.room.booksHome(true);
    w.room.landerOnShelf(true);
    w.truck.place(820, ROAD_Z, -Math.PI / 2);
    w.truck.cooper.root.visible = true;
    w.farm.donald.root.visible = false;
    w.storm.front = -1300;
    this.stormGo = true;
    this.arrived = false;
    this.driving.cam.reset();
    this.mode = "drive";
    this.s.cinematicMode = false;
    this.s.gameplay();
    ui.fade(1, 0);
    ui.card("", "Two days later", "");
    yield 2.2;
    ui.hideCard();
    ui.fade(0, 1.4);
    ui.objective("Get home before the storm hits");
    ui.hint("<kbd>W</kbd>/<kbd>S</kbd> drive · <kbd>A</kbd>/<kbd>D</kbd> steer · <kbd>C</kbd> camera · mouse to look");
    this.marker = { at: () => new THREE.Vector3(DRIVE_X, 2, 16), label: "Home" };
    this.s.side.run(
      function* (this: GhostChapter): Generator<Wait> {
        yield 2;
        yield ui.say("Tom", "Dad. Look at that.");
        yield ui.say("Murph", "Is it a bad one?");
        yield ui.say("Cooper", "Big enough. Windows up, shirts over your mouths.");
        yield () => w.storm.front > w.truck.pos.x - 900;
        yield ui.say("Tom", "It's coming faster than we are!");
        yield ui.say("Cooper", "Nearly there. Hang on.");
      }.bind(this),
    );
    yield () => this.arrived;
    this.marker = null;
    ui.objective(null);
    ui.hint(null);
    this.mode = "cine";
    this.s.cinematicMode = true;
    this.s.side.stop();
    ui.clearLines();
    // Everyone out and into the house as the wall comes over the yard.
    const cam = this.s.camera;
    const from = cam.position.clone();
    const house = new THREE.Vector3(0, 3, 0);
    let u = 0;
    this.cineCam = (dt) => {
      u = Math.min(1, u + dt / 6);
      cam.position.lerpVectors(from, new THREE.Vector3(24, 5, 30), u * u * (3 - 2 * u));
      cam.lookAt(house.clone().lerp(new THREE.Vector3(-400, 150, 0), u * 0.5));
    };
    this.stormGo = false;
    ui.say("Cooper", "Inside! Everybody inside, now!");
    this.sweep = true;
    yield () => w.storm.front >= 40;
    yield ui.say("Murph", "My window! Dad, I left my window open!");
    yield ui.fade(1, 0.8);
    this.cineCam = null;
    yield 0.5;
    yield* this.dustComes();
  }

  // --- Scene 3: the dust comes in --------------------------------------------
  private *dustComes(): Generator<Wait> {
    const { ui, audio } = this.s;
    const { w } = this;
    const { room } = w;
    this.checkpoint = "dust";
    this.scene = "storm";
    this.stormGo = false;
    this.sweep = false;
    this.closeT = -1;
    w.storm.front = 400;
    this.enterRoom("storm");
    // Indoors in a storm: the sun is a brown smudge; the lamp is what you see by.
    room.booksHome(true);
    room.landerOnShelf(true);
    room.setSash(1);
    room.dust.clear();
    room.dust.pull = 1;
    room.dust.rate = 4200;
    room.wind = 1;
    this.flicker = 1;
    this.seatMurph(false);
    this.standMurph(true, -2.25, 0.3, Math.PI * 0.8);
    this.walkHere(DOOR.x, DOOR.z, 0.35, -0.35);
    this.s.cinematicMode = false;
    ui.fade(0, 0.8);
    ui.objective("Watch the dust");
    yield 3;
    yield ui.say("Cooper", "Stay back from it, Murph. Don't touch anything.");
    yield () => room.dust.coverage > 0.35;
    yield ui.say("Murph", "It's the ghost.");
    yield () => room.dust.coverage > 0.7;
    yield 1.5;
    yield ui.say("Cooper", "Look at it. It's not settling at random. It's falling in lines.");
    yield ui.say("Cooper", "Something is pulling the dust down in bands. That's not a ghost, Murph. That's gravity.");
    ui.objective("Close the window");
    const shut = this.things.add({
      at: () => new THREE.Vector3(ROOM.x0 + 0.15, 4.6, ROOM.window.z),
      label: "Close the window",
      range: 1.9,
      act: () => {
        this.things.remove(shut);
        room.dust.rate = 0;
        room.wind = 0.08;
        this.closeT = 0;
      },
    });
    yield () => this.closeT >= 0;
    ui.objective(null);
    yield 0.6;
    yield ui.say("Murph", "Are you going to tell Grandpa?");
    yield ui.say("Cooper", "Not yet. Go get the flashlight from the kitchen. And a pencil.");
    this.mode = "cine";
    this.s.cinematicMode = true;
    yield ui.fade(1, 1.4);
    yield 0.4;
    yield* this.night();
  }
  private closeT = -1;

  // --- Scene 4: reading the lines --------------------------------------------
  private *night(): Generator<Wait> {
    const { ui } = this.s;
    const { w } = this;
    const { room } = w;
    this.checkpoint = "puzzle";
    this.scene = "night";
    w.storm.front = 1e5;
    this.enterRoom("night");
    room.dust.rate = 0;
    room.wind = 0;
    room.setSash(0);
    if (room.dust.coverage < 0.8) {
      room.dust.clear();
      room.dust.settle();
    }
    room.lampOn(1);
    this.flicker = 0;
    this.standMurph(false);
    this.seatMurph(true);
    this.walkHere(-1.6, -0.2, 0.9, -0.75);
    this.s.cinematicMode = false;
    ui.fade(1, 0);
    ui.card("", "Later that night", "");
    yield 2.2;
    ui.hideCard();
    ui.fade(0, 1.2);
    yield 1;
    yield ui.say("Cooper", "Four rows. Seven lines in each. Some thick, some thin.");
    yield ui.say("Murph", "Like a code?");
    yield ui.say("Cooper", "Like binary. Thick is a one, thin is a zero. Let's write it down.");
    ui.objective("Copy the lines into the notebook");
    ui.hint("<kbd>N</kbd> notebook · walk around and look closely at each row");
    this.notesReady = true;
    this.things.add({
      at: () => new THREE.Vector3(-3.1, ROOM.floor + 0.1, -1.66),
      label: "Copy the lines (notebook)",
      range: 3,
      when: () => !this.solved,
      act: () => this.openNotebook(),
    });
    this.s.side.run(
      function* (this: GhostChapter): Generator<Wait> {
        yield 50;
        if (this.solved) return;
        yield ui.say("Murph", "Start at the window. That's where it came in.");
        yield 50;
        if (this.solved) return;
        ui.hint("<kbd>N</kbd> notebook · stuck? the notebook has a <b>Hint</b> button");
      }.bind(this),
    );
    yield () => this.solved;
    this.s.side.stop();
    this.things.clear();
    ui.objective(null);
    ui.hint(null);
    yield 0.4;
    yield ui.say("Cooper", "Forty degrees, three minutes north. Ninety-nine, thirty-three west.");
    yield ui.say("Murph", "Coordinates? For what?");
    yield ui.say("Cooper", "For a place. About five kilometres north of here, out past the old air base road.");
    yield ui.say("Murph", "The ghost wants us to go there.");
    yield ui.say("Cooper", "Somebody does.");
    ui.objective("Drive to the coordinates");
    yield 1.2;
    this.mode = "cine";
    this.s.input.capture(false);
    this.s.audio.padLevel(0.35, 3);
    ui.end("Chapter two complete", "The Ghost", "Next: Coordinates. A night drive to a place that isn't on any map.", [
      ["Continue ▶", () => this.s.play("coordinates")],
      ["Replay chapter", () => this.s.restart(false)],
      ["Chapters", () => this.s.toMenu()],
    ]);
  }
  private notesReady = false;

  private openNotebook() {
    if (this.notebook || this.solved) return;
    this.mode = "notebook";
    this.modal = true;
    this.s.input.capture(false);
    this.s.ui.prompt(null);
    this.notebook = new Notebook(
      this.s.ui.root,
      MESSAGE,
      BITS,
      this.s.audio,
      this.notes,
      () => {
        this.solved = true;
        this.closeNotebook();
      },
      (bits) => {
        this.notes = bits;
        this.closeNotebook();
      },
    );
  }
  private closeNotebook() {
    this.notebook?.dispose();
    this.notebook = null;
    this.modal = false;
    this.mode = "walk";
    this.s.gameplay();
    this.s.input.clear();
  }

  // --- Frame -------------------------------------------------------------------
  private cineCam: ((dt: number) => void) | null = null;
  private marker: { at: () => THREE.Vector3; label: string } | null = null;
  update(dt: number) {
    const { w, s } = this;
    const { ui, input, camera, audio } = s;
    this.t += dt;
    if (this.closeT >= 0 && this.closeT < 0.6) {
      this.closeT += dt;
      w.room.setSash(Math.max(0, 1 - this.closeT / 0.5));
      if (this.closeT >= 0.5) {
        this.closeT = 0.6;
        audio.thud(1.5);
      }
    }
    if (this.sweep) w.storm.front = Math.min(60, w.storm.front + THREE.MathUtils.clamp((80 - w.storm.front) * 0.45, 50, 260) * dt);
    const truck = w.truck;
    const outside = this.scene === "drive";

    // The truck only matters outside.
    if (outside) {
      this.driving.update(dt, this.mode === "drive", this.mode === "drive", w.farm.colliders);
      w.farm.colliders.dynamic = [0, 1.6, -1.6].map((z) => {
        const p = truck.local(0, z);
        return { x: p.x, z: p.y, r: 1.0, top: truck.pos.y + 2 };
      });
      if (!this.arrived && Math.hypot(truck.pos.x - YARD.x, truck.pos.z - YARD.z) < 18 && Math.abs(truck.speed) < 2.5) this.arrived = true;
      // The storm: it closes in as you drive, but never beats you home.
      const st = w.storm;
      if (this.stormGo) {
        st.front += 30 * dt;
        st.front = Math.min(st.front, truck.pos.x - 130);
      }
      const near = THREE.MathUtils.clamp(1 - (camera.position.x - st.front) / 2200, 0, 1);
      const inside = st.inside(camera.position.x);
      const k = Math.max(inside, near * near * 0.55);
      w.setMood(MOODS.evening, MOODS.storm, k);
      st.strength = inside;
      if (k > 0.3) truck.headlightsOn(true);
      audio.storm(Math.max(near * 0.7, inside), 0);
      const tr = w.truck;
      for (const p of [tr.tom, tr.murph]) animatePerson(p, w.time, p === tr.tom ? 1 : 2, new THREE.Vector3(-3000, 300, tr.pos.z));
    } else {
      s.ui.speed(null);
      audio.truck(false, 0, 0, 0, 0, 0);
    }

    // Indoors.
    if (this.scene === "storm") {
      audio.storm(1, 1);
      // Power flickers while the storm is on.
      const f = this.flicker ? 0.25 + 0.25 * Math.max(0, Math.sin(this.t * 13) * Math.sin(this.t * 3.1)) + (Math.random() < 0.02 ? -0.2 : 0) : 0.35;
      w.room.lampOn(Math.max(0, f));
    } else if (this.scene === "night") {
      audio.storm(0, 1);
      audio.crickets(dt, true);
    } else if (this.scene === "room") audio.storm(0, 1);

    // The ghost pushes a book while you're watching the shelf.
    if (this.ghostT >= 0 && this.ghostT <= 1.2) {
      const prev = this.ghostT;
      this.ghostT += dt / 1.6;
      w.room.pushBook(this.ghostBook, Math.min(1, this.ghostT));
      if (prev < 1 && this.ghostT >= 1) audio.thud(1.6);
    }

    // Controls and camera.
    if (this.mode === "walk") {
      this.walker.update(dt, input, w.room.colliders, camera, !s.inCinematic);
      this.things.update(s, !s.inCinematic);
      if (this.notesReady && !this.solved && input.hit("KeyN")) this.openNotebook();
    } else if (this.mode !== "drive") ui.prompt(null);
    if (this.cineCam) this.cineCam(dt);

    // Murph watches you, or the dust.
    const look = this.scene === "storm" ? new THREE.Vector3(-3, ROOM.floor, -1.6) : camera.position;
    if (this.murphSeated.root.visible) animatePerson(this.murphSeated, w.time, 2, look);
    if (this.murphStanding.root.visible) animatePerson(this.murphStanding, w.time, 2, look);

    ui.marker(this.marker && !s.inCinematic ? this.marker.at() : null, camera, this.marker?.label);
    w.update(dt, camera);
  }
}
