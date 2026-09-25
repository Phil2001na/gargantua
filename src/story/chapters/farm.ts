import * as THREE from "three";
import type { Chapter, Story } from "../story";
import { Rail, type Wait } from "../engine";
import { Walker, DriveCamera } from "../controls";
import { Laptop } from "./laptop";
import { animatePerson } from "../earth/people";
import { canyonEdge, height, ROAD_Z, DRIVE_X, WATER_Y } from "../earth/land";
import type { DriveInput } from "../earth/truck";

/**
 * Chapter one: morning on the farm, the drive to school, and a solar drone that has
 * been flying alone for ten years. Chase it through the corn to the reservoir and
 * bring it down from the laptop. Dialogue is original, written for this project.
 */

type Mode = "cine" | "walk" | "drive" | "laptop";

const KEYS = `<kbd>W A S D</kbd> walk / drive · <kbd>Shift</kbd> run · <kbd>Space</kbd> handbrake<br><kbd>C</kbd> truck camera · <kbd>E</kbd> interact · mouse to look<br>Hold <kbd>Space</kbd> in a cutscene to skip it`;

export class FarmChapter implements Chapter {
  readonly title = "01 · The Dust";
  readonly keys = KEYS;
  checkpoint = "start";
  modal = false;
  private mode: Mode = "cine";
  private walker = new Walker();
  private driveCam = new DriveCamera();
  private inTruck = false;
  private canBoard = false;
  private freeRoam = false;
  private droneLive = false;
  private chase = false;
  private signal = 0;
  private hacked = false;
  private landed = false;
  private failing = false;
  private laptop: Laptop | null = null;
  private barks = new Set<string>();
  private lostT = 0;
  private lostCooldown = 0;
  private t = 0;
  private cineCam: ((dt: number) => void) | null = null;
  private marker: { at: () => THREE.Vector3; label: string } | null = null;
  constructor(private s: Story) {}

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
    w.truck.headlightsOn(false);
    w.drone.override = null;
    w.drone.hide();
    w.drone.s = 0;
    w.drone.speed = 30;
    this.signal = 0;
    this.s.camera.fov = 60;
    this.s.camera.updateProjectionMatrix();
    const script = {
      start: () => this.intro(),
      porch: () => this.porch(),
      drive: () => this.drive(),
      chase: () => this.chaseFromRoad(),
      edge: () => this.atTheEdge(),
    }[checkpoint];
    this.s.run(script ?? (() => this.intro()));
  }
  dispose() {
    this.closeLaptop();
    this.s.ui.reset();
    this.s.input.capture(false);
  }
  private skipLanding = false;
  skip() {
    if (this.checkpoint === "start") {
      this.s.ui.hideCard();
      this.s.ui.fade(0, 0.4);
      this.s.cinematic(null);
      this.s.run(() => this.porch());
    } else if (this.cineCam) this.skipLanding = true;
  }

  // --- Scripts ---------------------------------------------------------------
  private *intro(): Generator<Wait> {
    const { ui } = this.s;
    this.mode = "cine";
    ui.fade(1, 0);
    // Glide in low over the corn toward the house, ending on the porch at eye height.
    const porchEye = new THREE.Vector3(0.6, 0.6 + 1.7, 6.2);
    const truckDoor = new THREE.Vector3(DRIVE_X, 1.4, 16);
    const railDone = this.s.cinematic(
      new Rail(
        [new THREE.Vector3(330, 26, 190), new THREE.Vector3(170, 13, 110), new THREE.Vector3(55, 6, 42), new THREE.Vector3(12, 3.4, 13), porchEye],
        [new THREE.Vector3(120, 8, 60), new THREE.Vector3(0, 5, 0), new THREE.Vector3(2, 3, 2), truckDoor],
        26,
      ),
    );
    this.s.audio.padLevel(0.35, 6);
    yield 0.6;
    ui.fade(0, 4);
    yield 1.2;
    ui.card("Chapter one", "The Dust", "Earth. The dust years.");
    yield 4.5;
    ui.hideCard();
    yield 0.8;
    yield ui.say("Murph, years later", "Dad was an engineer. A pilot, once. Then the crops started dying, and the world needed farmers more than pilots.");
    yield ui.say("Murph, years later", "He never stopped looking up.");
    yield railDone;
    yield* this.porch();
  }

  private *porch(): Generator<Wait> {
    const { ui } = this.s;
    this.checkpoint = "porch";
    this.s.audio.padLevel(0, 4);
    const cam = this.s.camera;
    // Take over from wherever the camera is (the end of the intro rail, or a fresh start).
    if (cam.position.distanceTo(new THREE.Vector3(0.6, 2.3, 6.2)) > 0.5) {
      cam.position.set(0.6, 2.3, 6.2);
      cam.lookAt(DRIVE_X, 1.4, 16);
    }
    const e = new THREE.Euler().setFromQuaternion(cam.quaternion, "YXZ");
    this.walker.place(0.6, 0.6, 6.2, e.y, e.x);
    this.mode = "walk";
    this.canBoard = true;
    this.s.gameplay();
    ui.objective("Get in the truck");
    ui.hint("<kbd>W A S D</kbd> walk · <kbd>Shift</kbd> run · mouse to look · <kbd>E</kbd> interact");
    this.marker = { at: () => this.doorPos(), label: "Truck" };
    this.s.side.run(
      function* (this: FarmChapter): Generator<Wait> {
        yield 1.5;
        if (this.inTruck) return;
        yield ui.say("Donald", "Those two have been sitting in that truck ten minutes.");
        yield 0.6;
        if (this.inTruck) return;
        yield ui.say("Murph", "Dad! We're gonna be late!");
        yield 14;
        if (this.inTruck) return;
        yield ui.say("Tom", "Dad, come on!");
      }.bind(this),
    );
    yield () => this.inTruck;
    yield* this.drive();
  }

  private *drive(): Generator<Wait> {
    const { ui } = this.s;
    this.checkpoint = "drive";
    if (!this.inTruck) this.board();
    this.s.gameplay();
    ui.objective("Drive the kids to school");
    ui.hint("<kbd>W</kbd>/<kbd>S</kbd> drive · <kbd>A</kbd>/<kbd>D</kbd> steer · <kbd>Space</kbd> handbrake · <kbd>C</kbd> camera · mouse to look");
    const school = new THREE.Vector3(1190, 2, ROAD_Z);
    this.marker = { at: () => school, label: "School" };
    this.s.side.run(
      function* (this: FarmChapter): Generator<Wait> {
        yield 3;
        yield ui.say("Tom", "Can I drive tomorrow?");
        yield ui.say("Cooper", "Ask me again when you can see over the dashboard.");
        yield ui.say("Murph", "He can see over it. Barely.");
      }.bind(this),
    );
    const t0 = this.t;
    // The drone shows up once we're out on the road (or after a while regardless).
    yield () => Math.hypot(this.w.truck.pos.x - DRIVE_X, this.w.truck.pos.z - ROAD_Z) > 45 || this.t - t0 > 40;
    yield* this.droneArrives();
  }

  private *droneArrives(): Generator<Wait> {
    const { ui } = this.s;
    const { drone, truck } = this.w;
    // Start it a few hundred metres behind us, flying fast to catch up.
    let s0 = 0;
    for (let s = 0; s < drone.length; s += 10) if (drone.at(s).x < truck.pos.x - 200) s0 = s;
    drone.s = s0;
    drone.speed = drone.cruise = 32;
    drone.group.visible = true;
    this.droneLive = true;
    this.s.side.stop();
    yield 2.5;
    yield ui.say("Murph", "Dad... what's that noise?");
    yield () => this.droneDist() < 130 || drone.position.x > truck.pos.x;
    ui.say("Tom", "Up there! Look!");
    this.marker = { at: () => drone.position, label: "Drone" };
    yield () => drone.position.x > truck.pos.x - 10;
    yield* this.startChase();
  }

  private *startChase(): Generator<Wait> {
    const { ui } = this.s;
    this.w.drone.cruise = 20;
    this.chase = true;
    this.checkpoint = "chase";
    ui.say("Cooper", "That's a surveillance drone. Solar. Indian Air Force, by the look of it.");
    ui.say("Cooper", "Tom, laptop's under the seat. Hold on to something.");
    ui.objective("Chase the drone");
    this.marker = { at: () => this.w.drone.position, label: "Drone" };
    yield () => this.hacked;
    yield* this.landing();
  }

  /** Checkpoint: already on the road, drone overhead. */
  private *chaseFromRoad(): Generator<Wait> {
    this.w.truck.place(140, ROAD_Z, Math.PI / 2);
    this.board();
    this.s.gameplay();
    this.s.ui.hint("<kbd>W</kbd>/<kbd>S</kbd> drive · <kbd>A</kbd>/<kbd>D</kbd> steer · <kbd>Space</kbd> handbrake · <kbd>C</kbd> camera");
    const { drone } = this.w;
    let s0 = 0;
    for (let s = 0; s < drone.length; s += 10) if (drone.at(s).x < 220) s0 = s;
    drone.s = s0;
    drone.speed = 20;
    drone.group.visible = true;
    this.droneLive = true;
    yield* this.startChase();
  }

  /** Checkpoint: near the reservoir with the drone circling. */
  private *atTheEdge(): Generator<Wait> {
    const z = 230;
    this.w.truck.place(canyonEdge(z) - 140, z, Math.PI / 2);
    this.board();
    this.s.gameplay();
    const { drone } = this.w;
    drone.s = drone.length + 50;
    drone.speed = 16;
    drone.group.visible = true;
    this.droneLive = true;
    this.chase = true;
    this.signal = Math.max(this.signal, 0.85);
    this.s.ui.objective("Chase the drone");
    this.marker = { at: () => drone.position, label: "Drone" };
    this.checkpoint = "edge";
    yield () => this.hacked;
    yield* this.landing();
  }

  private *landing(): Generator<Wait> {
    const { ui } = this.s;
    const { drone, truck } = this.w;
    this.chase = false;
    this.mode = "cine";
    this.s.cinematicMode = true;
    ui.objective(null);
    ui.meter(null);
    ui.prompt(null);
    ui.hint(null);
    this.marker = null;
    // Set it down on the bare strip along the rim, just ahead of the truck.
    const lz = truck.pos.z + 18,
      lx = canyonEdge(lz) - 8;
    const ly = height(lx, lz) + 0.75;
    const from = drone.position.clone();
    const yaw0 = drone.group.rotation.y;
    const path = new THREE.CatmullRomCurve3([
      from,
      new THREE.Vector3((from.x + lx) / 2 + 40, 26, (from.z + lz) / 2 + 30),
      new THREE.Vector3(lx + 25, ly + 6, lz + 30),
      new THREE.Vector3(lx, ly, lz),
    ]);
    const endYaw = Math.atan2(lx - (lx + 25), lz - (lz + 30));
    const T = 13;
    let u = 0;
    drone.override = { pos: from.clone(), yaw: yaw0, pitch: 0 };
    const camFrom = this.s.camera.position.clone();
    // Start behind the truck at the height of someone standing in the bed, then glide out
    // over the corn tops to the rim, where the drone sets down above the reservoir.
    const behind = truck.local(0.7, -6.5);
    const toRim = new THREE.Vector2(lx - truck.pos.x, lz - truck.pos.z).normalize();
    const rimCam = new THREE.Vector3(lx - toRim.x * 16 - toRim.y * 7, 0, lz - toRim.y * 16 + toRim.x * 7);
    rimCam.y = height(rimCam.x, rimCam.z) + 3.4;
    const camPath = new THREE.CatmullRomCurve3([
      camFrom,
      new THREE.Vector3(behind.x, truck.pos.y + 4.3, behind.y),
      new THREE.Vector3((behind.x + rimCam.x) / 2, rimCam.y + 1.2, (behind.y + rimCam.z) / 2),
      rimCam,
    ]);
    const look = new THREE.Vector3();
    this.cineCam = (dt) => {
      u = this.skipLanding ? 1 : Math.min(1, u + dt / T);
      const e = u * u * (3 - 2 * u);
      const p = path.getPointAt(e);
      const ahead = path.getPointAt(Math.min(1, e + 0.02));
      drone.override!.pos.copy(p);
      const yawPath = Math.atan2(ahead.x - p.x, ahead.z - p.z);
      drone.override!.yaw = u > 0.97 ? endYaw : yawPath;
      drone.override!.pitch = THREE.MathUtils.clamp((p.y - ahead.y) * 0.4, -0.2, 0.3) * (1 - e);
      this.s.camera.position.copy(camPath.getPointAt(e));
      look.lerp(p, u < 0.02 ? 1 : 1 - Math.exp(-4 * dt));
      this.s.camera.lookAt(look);
    };
    look.copy(from);
    yield 1;
    yield ui.say("Murph", "What are you going to do with it?");
    yield ui.say("Cooper", "Put it to work. Cells like that could run a whole combine.");
    yield ui.say("Murph", "Can't we just let it go? It's not hurting anyone.");
    yield ui.say("Cooper", "It's been up there on its own for ten years, Murph. Time it came down and did something useful.");
    yield () => u >= 1;
    this.landed = true;
    this.s.audio.drone(null);
    yield 1.2;
    this.s.audio.padLevel(0.4, 3);
    this.cineCam = null;
    this.s.input.capture(false);
    ui.end("Chapter one complete", "The Dust", "Next: The Ghost. Murph's bookshelf, a dust storm, and a message only she can see. (In production.)", [
      ["Keep driving", () => this.roam()],
      ["Replay chapter", () => this.s.restart(false)],
      ["Chapters", () => this.s.toMenu()],
    ]);
  }

  private roam() {
    const { ui } = this.s;
    ui.end(null);
    this.freeRoam = true;
    this.s.cinematicMode = false;
    this.s.audio.padLevel(0, 2);
    if (!this.inTruck) this.board();
    this.mode = "drive";
    this.driveCam.reset();
    this.s.gameplay();
    ui.objective("Free roam");
    ui.hint("<kbd>W</kbd>/<kbd>S</kbd> drive · <kbd>A</kbd>/<kbd>D</kbd> steer · <kbd>C</kbd> camera · <kbd>E</kbd> get out / in");
  }

  private fail(message: string) {
    if (this.failing) return;
    this.failing = true;
    const { ui } = this.s;
    this.closeLaptop();
    this.s.run(
      function* (this: FarmChapter): Generator<Wait> {
        ui.say("", message, 2.6);
        yield ui.fade(1, 1.2);
        yield 1.4;
        this.s.restart(true);
      }.bind(this),
    );
  }

  // --- Helpers ---------------------------------------------------------------
  private doorPos() {
    const d = this.w.truck.local(1.35, 0.1);
    return new THREE.Vector3(d.x, this.w.truck.pos.y + 1.2, d.y);
  }
  private droneDist() {
    const a = this.w.drone.position,
      b = this.w.truck.pos;
    return Math.hypot(a.x - b.x, a.z - b.z);
  }
  private board() {
    this.inTruck = true;
    this.mode = "drive";
    this.driveCam.reset();
    this.w.truck.cooper.root.visible = true;
  }
  private leaveTruck() {
    const t = this.w.truck;
    const p = t.local(1.7, 0.2);
    this.inTruck = false;
    this.mode = "walk";
    this.walker.place(p.x, height(p.x, p.y), p.y, t.heading + Math.PI / 2);
    t.cooper.root.visible = false;
  }
  private bark(key: string, speaker: string, text: string) {
    if (this.barks.has(key)) return;
    this.barks.add(key);
    this.s.ui.say(speaker, text);
  }
  private openLaptop() {
    this.mode = "laptop";
    this.modal = true;
    this.s.input.capture(false);
    this.s.ui.prompt(null);
    this.laptop = new Laptop(
      this.s.ui.root,
      this.s.audio,
      () => {
        this.hacked = true;
        setTimeout(() => this.closeLaptop(), 900);
      },
      () => {
        this.closeLaptop();
        this.mode = "drive";
        this.s.gameplay();
      },
    );
  }
  private closeLaptop() {
    this.laptop?.dispose();
    this.laptop = null;
    this.modal = false;
  }
  private readDrive(): DriveInput {
    const i = this.s.input;
    const free = this.mode === "drive";
    return {
      throttle: free && i.key("KeyW", "ArrowUp") ? 1 : 0,
      brake: free && i.key("KeyS", "ArrowDown") ? 1 : 0,
      steer: free ? i.axis(["KeyD", "ArrowRight"], ["KeyA", "ArrowLeft"]) : 0,
      handbrake: free && i.key("Space"),
    };
  }

  // --- Frame -----------------------------------------------------------------
  update(dt: number) {
    const { w, s } = this;
    const { ui, input, camera, audio } = s;
    this.t += dt;
    const truck = w.truck;

    // Truck physics always runs (it coasts to a stop when nobody is driving).
    const drive = this.readDrive();
    if (this.mode === "laptop" || this.mode === "cine") drive.brake = Math.abs(truck.speed) > 0.3 ? 1 : 0;
    truck.update(dt, drive, w.farm.colliders);
    w.truckEffects(dt);
    if (truck.impact > 2) {
      audio.thud(truck.impact);
      this.driveCam.shake += Math.min(3, truck.impact * 0.3);
    }
    truck.impact = 0;
    if (truck.landing > 3) {
      audio.thud(truck.landing * 1.5);
      this.driveCam.shake += Math.min(4, truck.landing * 0.4);
    }
    truck.landing = 0;
    // The truck is solid when walking around it.
    w.farm.colliders.dynamic = [0, 1.6, -1.6].map((z) => {
      const p = truck.local(0, z);
      return { x: p.x, z: p.y, r: 1.0, top: truck.pos.y + 2 };
    });

    // Controls and camera.
    if (this.mode === "walk") {
      this.walker.update(dt, input, w.farm.colliders, camera, !s.inCinematic);
      const near = this.walker.pos.distanceTo(this.doorPos().setY(this.walker.pos.y)) < 2.4;
      ui.prompt(near && (this.canBoard || this.freeRoam) ? "E" : null, "Drive");
      if (near && (this.canBoard || this.freeRoam) && input.hit("KeyE")) {
        this.board();
        ui.prompt(null);
      }
    } else if (this.mode === "drive" || this.mode === "laptop") {
      if (input.hit("KeyC")) this.driveCam.toggle();
      this.driveCam.update(dt, input, truck, camera);
      truck.cooper.root.visible = this.driveCam.mode === "chase";
      if (this.freeRoam && input.hit("KeyE") && Math.abs(truck.speed) < 1.5) this.leaveTruck();
    } else if (this.cineCam) this.cineCam(dt);

    // Drone.
    w.drone.update(dt, w.time, this.chase ? truck.pos : null, w.u.uSunDir.value, this.droneLive && !this.landed);
    if (this.droneLive && !this.landed) audio.drone(camera.position.distanceTo(w.drone.position));
    else audio.drone(null);

    // Chase logic: signal, barks, the laptop, falling off the edge.
    if (this.chase) {
      const d = this.droneDist();
      // Closer is faster; once it's circling the reservoir anywhere near the rim will do.
      const range = w.drone.onPath ? 120 : 240;
      if (d < range) this.signal = Math.min(1, this.signal + dt * (w.drone.onPath ? 0.05 : 0.1) * (1.15 - d / range));
      else if (d > range + 90) this.signal = Math.max(0, this.signal - dt * 0.01);
      if (this.signal > 0.985) this.signal = 1;
      ui.meter("Drone signal", this.signal);
      if (this.signal > 0.25) this.bark("s25", "Tom", "It's working. Signal's getting stronger!");
      if (truck.cornLoad > 0.3) this.bark("corn", "Cooper", "Hang on!");
      if (this.signal > 0.55) this.bark("s55", "Murph", "Faster, Dad!");
      if (!w.drone.onPath) {
        this.bark("reservoir", "Tom", "It's going out over the reservoir!");
        if (this.checkpoint !== "edge") this.checkpoint = "edge";
      }
      const edgeDist = canyonEdge(truck.pos.z) - truck.pos.x;
      if (edgeDist < 90 && truck.speed > 10) this.bark("edge", "Murph", "Dad, the edge! STOP!");
      this.lostCooldown -= dt;
      if (d > 260) this.lostT += dt;
      else this.lostT = 0;
      if (this.lostT > 5 && this.lostCooldown <= 0) {
        this.lostCooldown = 20;
        ui.say("Tom", "We're losing it!");
      }
      const canHack = !w.drone.onPath && this.signal >= 1 && Math.abs(truck.speed) < 1 && d < 320 && this.mode === "drive";
      if (!w.drone.onPath && this.signal >= 1) {
        this.bark("stop", "Tom", "I've got it on the laptop! Stop the truck!");
        ui.objective("Stop the truck and take control");
      } else if (!w.drone.onPath) ui.objective("Get in close under the drone");
      ui.prompt(canHack ? "E" : null, "Take control (laptop)");
      if (canHack && input.hit("KeyE")) this.openLaptop();
    }
    if (this.laptop) this.laptop.update(dt);
    if (!this.failing && (truck.pos.y < WATER_Y + 1 || (truck.airborne && truck.pos.y < -12))) this.fail("You went over the edge.");

    // Passengers react; Grandpa watches from the porch.
    const look = this.droneLive && !this.landed ? w.drone.position : undefined;
    animatePerson(truck.tom, w.time, 1, look);
    animatePerson(truck.murph, w.time, 2, look);
    animatePerson(w.farm.donald, w.time, 3, camera.position.distanceTo(w.farm.donald.root.position) < 30 ? camera.position : undefined);

    // HUD.
    ui.speed(this.mode === "drive" ? truck.speed * 3.6 : null);
    ui.marker(this.marker && !s.inCinematic ? this.marker.at() : null, camera, this.marker?.label);
    const offRoad = truck.surface === 0 ? 0 : 1;
    const rpm = Math.min(1, Math.abs(truck.speed) / 30 + (drive.throttle ? 0.15 : 0));
    audio.truck(this.inTruck || Math.abs(truck.speed) > 0.5, rpm, drive.throttle, truck.speed, truck.cornLoad, offRoad);
    audio.birds(dt, this.mode === "walk" || Math.abs(truck.speed) < 3);

    w.update(dt, camera);
  }
}
