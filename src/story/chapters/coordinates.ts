import * as THREE from "three";
import type { Chapter, Story } from "../story";
import { Rail, type Wait } from "../engine";
import { Walker } from "../controls";
import { person, animatePerson, CAST, type Person } from "../earth/people";
import { MOODS } from "../earth/world";
import { COMPOUND, DRIVE_X, ROAD_Z } from "../earth/land";
import { FLOOR, SPOTS } from "../earth/compound";
import { Tars } from "../earth/tars";
import { Driving, walkPose } from "./common";

/**
 * Chapter three: a night drive to the coordinates with a stowaway, a gate that isn't as
 * abandoned as it looks, and what's underneath it. Dialogue is original, written for
 * this project; it paraphrases the film's beats rather than quoting them.
 */

type Mode = "cine" | "drive" | "walk" | "seated";
const KEYS = `<kbd>W A S D</kbd> walk / drive · <kbd>Shift</kbd> run · <kbd>C</kbd> truck camera · mouse to look<br><kbd>T</kbd> on the long road: skip ahead · Hold <kbd>Space</kbd> in a cutscene to skip it`;
const CZ = COMPOUND.z;
const GATE_Z = COMPOUND.z + COMPOUND.hd;
const JUNCTION = new THREE.Vector3(COMPOUND.x, 1, ROAD_Z);

/** A small quadrotor with a searchlight: the compound's watchman. */
class Watchman {
  readonly group = new THREE.Group();
  private rotors: THREE.Mesh[] = [];
  private beacon: THREE.MeshStandardMaterial;
  readonly beam: THREE.Mesh;
  constructor() {
    const body = new THREE.MeshStandardMaterial({ color: 0x2a2d31, metalness: 0.6, roughness: 0.4 });
    const hull = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.3, 1.2), body);
    this.group.add(hull);
    for (const [x, z] of [
      [0.8, 0.8],
      [-0.8, 0.8],
      [0.8, -0.8],
      [-0.8, -0.8],
    ]) {
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.06, 1.1), body);
      arm.position.set(x / 2, 0.05, z / 2);
      arm.rotation.y = Math.atan2(x, z);
      const rotor = new THREE.Mesh(
        new THREE.CylinderGeometry(0.42, 0.42, 0.01, 20),
        new THREE.MeshBasicMaterial({ color: 0x777777, transparent: true, opacity: 0.35, depthWrite: false }),
      );
      rotor.position.set(x, 0.12, z);
      this.rotors.push(rotor);
      this.group.add(arm, rotor);
    }
    this.beacon = new THREE.MeshStandardMaterial({ color: 0x300000, emissive: 0xff2010, emissiveIntensity: 0 });
    const b = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), this.beacon);
    b.position.set(0, 0.2, 0);
    this.group.add(b);
    // The visible beam: a soft additive cone hanging below.
    const cone = new THREE.ConeGeometry(3.2, 16, 24, 1, true).translate(0, -8, 0);
    this.beam = new THREE.Mesh(
      cone,
      new THREE.ShaderMaterial({
        uniforms: { uA: { value: 0 } },
        vertexShader: `varying float vY; varying vec3 vN; varying vec3 vV; void main(){ vY=position.y; vec4 mv=modelViewMatrix*vec4(position,1.); vN=normalize(normalMatrix*normal); vV=normalize(-mv.xyz); gl_Position=projectionMatrix*mv; }`,
        fragmentShader: `uniform float uA; varying float vY; varying vec3 vN; varying vec3 vV; void main(){ float edge=pow(abs(dot(vN,vV)),1.5); gl_FragColor=vec4(vec3(.8,.88,1.)*uA*edge*(1.+vY/16.)*.35,1.); }`,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
    );
    this.group.add(this.beam);
    this.group.visible = false;
  }
  update(t: number, lit: number) {
    for (const r of this.rotors) r.rotation.y = t * 60;
    this.beacon.emissiveIntensity = Math.sin(t * 6) > 0.6 ? 4 : 0;
    (this.beam.material as THREE.ShaderMaterial).uniforms.uA.value = lit;
    this.beam.visible = lit > 0.01;
  }
}

export class CoordinatesChapter implements Chapter {
  readonly title = "03 · Coordinates";
  readonly keys = KEYS;
  checkpoint = "start";
  modal = false;
  private mode: Mode = "cine";
  private driving: Driving;
  private walker = new Walker();
  private watchman = new Watchman();
  private tars = new Tars();
  private prof: Person;
  private amelia: Person;
  private murph: Person;
  private stowaway = false;
  private skipAhead = false;
  private cineCam: ((dt: number) => void) | null = null;
  private marker: { at: () => THREE.Vector3; label: string } | null = null;
  private engineDead = false;
  private walkers: { p: Person | Tars; path: THREE.Vector3[]; speed: number; i: number; phase: number; done: boolean; face?: number }[] = [];
  private talkTars = 0;
  private t = 0;
  constructor(private s: Story) {
    this.driving = new Driving(s);
    this.prof = person(CAST.professor);
    this.amelia = person(CAST.amelia);
    this.murph = person(CAST.murph, true);
    for (const o of [this.prof.root, this.amelia.root, this.murph.root, this.tars.root, this.watchman.group]) {
      o.visible = false;
      s.earth.scene.add(o);
    }
  }
  private get w() {
    return this.s.earth;
  }

  start(checkpoint = "start") {
    const { w } = this;
    this.checkpoint = checkpoint;
    w.resetScene();
    w.corn.reset();
    w.setMood(MOODS.night);
    this.s.camera.fov = 62;
    this.s.camera.updateProjectionMatrix();
    const run = {
      start: () => this.night(),
      road: () => this.northRoad(),
      gate: () => this.gate(),
      inside: () => this.interrogation(),
      tour: () => this.tour(),
      brief: () => this.brief(),
    }[checkpoint];
    this.s.run(run ?? (() => this.night()));
  }
  dispose() {
    for (const o of [this.prof.root, this.amelia.root, this.murph.root, this.tars.root, this.watchman.group]) this.w.scene.remove(o);
    const t = this.w.truck;
    t.tom.root.visible = t.murph.root.visible = true;
    this.w.resetScene();
    this.s.ui.reset();
    this.s.input.capture(false);
  }
  skip() {
    this.s.ui.hideCard();
  }

  // --- Scene 1: the night drive ---------------------------------------------------
  private *night(): Generator<Wait> {
    const { ui, audio } = this.s;
    const { w } = this;
    const truck = w.truck;
    this.checkpoint = "start";
    truck.place(DRIVE_X, 16, 0);
    truck.headlightsOn(true);
    truck.tom.root.visible = false;
    truck.murph.root.visible = false;
    this.stowaway = true;
    this.mode = "cine";
    ui.fade(1, 0);
    const rail = this.s.cinematic(
      new Rail(
        [new THREE.Vector3(-14, 7, 34), new THREE.Vector3(-2, 4, 28), new THREE.Vector3(DRIVE_X - 4, 2.4, 24)],
        [new THREE.Vector3(0, 4, 0), new THREE.Vector3(4, 2.5, 8), new THREE.Vector3(DRIVE_X, 1.2, 16)],
        10,
      ),
    );
    audio.padLevel(0.3, 4);
    ui.fade(0, 2.5);
    yield 0.8;
    ui.card("Chapter three", "Coordinates", "That night.");
    yield 4;
    ui.hideCard();
    yield ui.say("Cooper", "Tom's asleep. Grandpa thinks I've gone to check the combine. Nobody needs to know.");
    yield rail;
    audio.padLevel(0, 3);
    this.drive();
    ui.objective("Drive to the coordinates");
    ui.hint("<kbd>W</kbd>/<kbd>S</kbd> drive · <kbd>A</kbd>/<kbd>D</kbd> steer · <kbd>C</kbd> camera · east on the main road, then north");
    this.marker = { at: () => JUNCTION, label: "Turn north" };
    yield () => truck.pos.x > COMPOUND.x - 60 && truck.pos.z < ROAD_Z + 30;
    this.marker = { at: () => SPOTS.gate.clone().setY(2), label: "40°03′N 99°33′W" };
    yield () => truck.pos.z < ROAD_Z - 700;
    yield* this.northRoad();
  }

  /** Checkpoint: heading north on the section road, and a voice from the back. */
  private *northRoad(): Generator<Wait> {
    const { ui } = this.s;
    const truck = this.w.truck;
    this.checkpoint = "road";
    if (Math.abs(truck.pos.x - COMPOUND.x) > 30 || truck.pos.z > ROAD_Z - 300) {
      truck.place(COMPOUND.x, ROAD_Z - 700, Math.PI);
      truck.headlightsOn(true);
      truck.tom.root.visible = truck.murph.root.visible = false;
      this.drive();
    }
    ui.objective("Drive to the coordinates");
    this.marker = { at: () => SPOTS.gate.clone().setY(2), label: "40°03′N 99°33′W" };
    yield 3;
    yield ui.say("Murph", "Dad?");
    truck.murph.root.visible = true;
    this.stowaway = false;
    yield ui.say("Cooper", "Murph! How long have you been back there?");
    yield ui.say("Murph", "Since the yard. Under the blanket.");
    yield ui.say("Cooper", "You should be asleep. It's the middle of the night.");
    yield ui.say("Murph", "They're my coordinates. My ghost gave them to me.");
    yield ui.say("Cooper", "...Put your seat belt on.");
    ui.hint("<kbd>T</kbd> skip ahead · or keep driving: it's about five kilometres");
    yield () => this.skipAhead || truck.pos.z < GATE_Z + 70;
    if (this.skipAhead) {
      this.mode = "cine";
      yield ui.fade(1, 0.8);
      ui.card("", "An hour later", "");
      truck.place(COMPOUND.x, GATE_Z + 320, Math.PI);
      this.driving.cam.reset();
      yield 1.8;
      ui.hideCard();
      this.drive();
      ui.fade(0, 1);
      yield () => truck.pos.z < GATE_Z + 70;
    }
    yield* this.gate();
  }

  // --- Scene 2: the gate ------------------------------------------------------------
  private *gate(): Generator<Wait> {
    const { ui, audio } = this.s;
    const { w } = this;
    const truck = w.truck;
    this.checkpoint = "gate";
    if (truck.pos.z > GATE_Z + 120 || Math.abs(truck.pos.x - COMPOUND.x) > 20) {
      truck.place(COMPOUND.x, GATE_Z + 60, Math.PI);
      truck.headlightsOn(true);
      truck.murph.root.visible = true;
      truck.tom.root.visible = false;
      this.drive();
    }
    ui.hint(null);
    ui.say("Murph", "It's just a fence.");
    yield () => truck.pos.z < GATE_Z + 22 || Math.abs(truck.speed) < 0.5;
    // Floodlights come on; something lifts off from behind the buildings.
    this.mode = "cine";
    this.s.cinematicMode = true;
    this.marker = null;
    ui.objective(null);
    yield () => Math.abs(truck.speed) < 0.4;
    w.compound.floods.emissiveIntensity = 5;
    audio.thud(3);
    const wm = this.watchman;
    wm.group.visible = true;
    const from = new THREE.Vector3(COMPOUND.x + 6, 6, CZ + 20),
      hover = new THREE.Vector3(truck.pos.x + 3, truck.pos.y + 11, truck.pos.z - 5);
    let u = 0;
    const cam = this.s.camera;
    const camAt = truck.local(-3.5, -9);
    const camPos = new THREE.Vector3(camAt.x, truck.pos.y + 2.2, camAt.y);
    this.cineCam = (dt) => {
      u = Math.min(1, u + dt / 5);
      const e = u * u * (3 - 2 * u);
      wm.group.position.lerpVectors(from, hover, e);
      wm.group.position.y += Math.sin(this.t * 2) * 0.15;
      wm.group.rotation.y = Math.PI * (1 - e);
      cam.position.copy(camPos);
      cam.lookAt(wm.group.position.clone().lerp(truck.pos, 0.6));
      const aim = truck.pos.clone().sub(wm.group.position);
      w.searchlight = { pos: wm.group.position.clone(), aim, power: 0.7 * e };
      wm.beam.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), aim.clone().normalize());
      wm.beam.quaternion.premultiply(wm.group.quaternion.clone().invert());
      wm.update(this.t, e);
      audio.drone(cam.position.distanceTo(wm.group.position) * 0.6);
    };
    yield 1.5;
    yield ui.say("Watchman", "Stop. You are on restricted federal land. Stay in the vehicle.");
    yield ui.say("Murph", "Dad...");
    yield ui.say("Cooper", "Hold on to something.");
    // A short, hopeless attempt to back out.
    this.cineCam = (dt) => {
      wm.group.position.lerp(truck.pos.clone().add(new THREE.Vector3(2, 10, -3)), 1 - Math.exp(-2 * dt));
      const aim = truck.pos.clone().sub(wm.group.position);
      w.searchlight = { pos: wm.group.position.clone(), aim, power: 0.7 };
      wm.beam.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), aim.clone().normalize());
      wm.beam.quaternion.premultiply(wm.group.quaternion.clone().invert());
      wm.update(this.t, 1);
      audio.drone(20);
    };
    this.mode = "drive";
    this.s.cinematicMode = false;
    this.driving.cam.reset();
    ui.objective("Back out of there!");
    yield 3.2;
    audio.zap();
    this.engineDead = true;
    truck.headlightsOn(false);
    ui.objective(null);
    this.mode = "cine";
    this.s.cinematicMode = true;
    ui.fade(0.85, 0.08);
    yield 0.15;
    ui.fade(0, 0.6);
    yield 1.4;
    yield ui.say("Murph", "Dad? Dad!");
    audio.drone(null);
    yield ui.fade(1, 1.5);
    this.cineCam = null;
    wm.group.visible = false;
    w.searchlight = null;
    yield 1.2;
    yield* this.interrogation();
  }

  // --- Scene 3: underground, a room with a table -----------------------------------------
  private goUnder() {
    const { w } = this;
    w.underground = true;
    w.indoor = 1;
    w.shadowSpan = 12;
    w.compound.lightsOn(true);
    w.truck.headlightsOn(false);
    w.truck.group.visible = false;
    this.s.audio.hum(1);
  }
  private *interrogation(): Generator<Wait> {
    const { ui, audio } = this.s;
    this.checkpoint = "inside";
    this.goUnder();
    this.murph.root.visible = true;
    this.murph.root.position.set(SPOTS.murphSeat.x, FLOOR + 0.02, SPOTS.murphSeat.z);
    this.murph.root.rotation.y = Math.PI;
    this.tars.root.visible = false;
    // Cooper sits facing the door; you can look around but not get up.
    this.walker.place(SPOTS.cooperSeat.x, FLOOR, SPOTS.cooperSeat.z, -Math.PI / 2, -0.1);
    this.walker.eye = 1.22;
    this.mode = "seated";
    this.s.cinematicMode = false;
    this.s.gameplay();
    ui.fade(1, 0);
    ui.card("", "Some time later", "");
    yield 2;
    ui.hideCard();
    ui.fade(0, 2);
    yield 2;
    ui.hint("Mouse to look around");
    yield ui.say("Murph", "Dad. You're awake. There's somebody coming.");
    // TARS walks in from the corridor.
    this.tars.root.visible = true;
    this.tars.root.position.set(343, FLOOR, CZ);
    this.walkTo(this.tars, [new THREE.Vector3(336.6, FLOOR, CZ), new THREE.Vector3(334.9, FLOOR, CZ - 1.2)], 0.9, -Math.PI / 2);
    yield () => this.arrived(this.tars);
    ui.hint(null);
    this.talkTars = 1;
    yield ui.say("TARS", "Please stay in your seats. Someone will be with you shortly.");
    yield ui.say("Cooper", "Where's my truck?");
    yield ui.say("TARS", "Parked, and in one piece. Apart from the electronics. That was us. Sorry.");
    yield ui.say("Murph", "Is that a robot?");
    yield ui.say("TARS", "I'd say colleague. My humor setting is at sixty percent, if that helps.");
    this.talkTars = 0;
    // Brand comes in.
    this.amelia.root.visible = true;
    this.amelia.root.position.set(343, FLOOR, CZ);
    this.walkTo(this.amelia, [new THREE.Vector3(336.5, FLOOR, CZ), new THREE.Vector3(334.6, FLOOR, CZ + 0.3)], 1.2, -Math.PI / 2);
    yield () => this.arrived(this.amelia);
    yield ui.say("Brand", "How did you find this place?");
    yield ui.say("Cooper", "Coordinates.");
    yield ui.say("Brand", "From where?");
    yield ui.say("Cooper", "...You wouldn't believe me.");
    yield ui.say("Brand", "Try me. Who else knows you're here?");
    this.prof.root.visible = true;
    this.prof.root.position.set(343, FLOOR, CZ);
    this.walkTo(this.prof, [new THREE.Vector3(336.6, FLOOR, CZ), new THREE.Vector3(335.3, FLOOR, CZ + 0.9)], 1.0, -Math.PI / 2);
    yield () => this.arrived(this.prof);
    yield ui.say("Professor", "Cooper? It's all right, Amelia. I know this man.");
    yield ui.say("Cooper", "Professor Brand. I thought NASA was shut down.");
    yield ui.say("Professor", "Officially, it was. Come with me. Your daughter can stay here with TARS.");
    this.talkTars = 1;
    yield ui.say("TARS", "I'll teach her poker. Badly.");
    this.talkTars = 0;
    yield* this.tour();
  }

  // --- Scene 4: the walk through the facility -------------------------------------------
  private *tour(): Generator<Wait> {
    const { ui } = this.s;
    const { w } = this;
    this.checkpoint = "tour";
    this.goUnder();
    this.murph.root.visible = true;
    this.murph.root.position.set(SPOTS.murphSeat.x, FLOOR + 0.02, SPOTS.murphSeat.z);
    this.murph.root.rotation.y = Math.PI;
    this.tars.root.visible = true;
    this.tars.root.position.set(334.9, FLOOR, CZ - 1.2);
    this.tars.root.rotation.y = -Math.PI / 2;
    this.amelia.root.visible = false;
    this.prof.root.visible = true;
    if (this.mode !== "seated") {
      this.prof.root.position.set(335.3, FLOOR, CZ + 0.9);
      this.walker.place(SPOTS.cooperSeat.x, FLOOR, SPOTS.cooperSeat.z, -Math.PI / 2, -0.1);
    }
    this.walker.eye = 1.7;
    this.mode = "walk";
    this.s.cinematicMode = false;
    this.s.gameplay();
    ui.fade(0, 0.8);
    ui.objective("Follow Professor Brand");
    ui.hint("<kbd>W A S D</kbd> walk · mouse to look");
    const H = SPOTS.hall;
    const route = [
      new THREE.Vector3(337, FLOOR, CZ),
      new THREE.Vector3(388, FLOOR, CZ),
      new THREE.Vector3(H.x - 16, FLOOR, CZ - 4),
      new THREE.Vector3(H.x - 6, FLOOR, CZ - 10),
      new THREE.Vector3(H.x + 12, FLOOR, CZ - 8),
      new THREE.Vector3(H.x + 24, FLOOR, CZ - 1),
      new THREE.Vector3(452, FLOOR, CZ),
      new THREE.Vector3(462.5, FLOOR, CZ),
    ];
    const pw = this.walkTo(this.prof, route, 1.35);
    this.marker = { at: () => this.prof.root.position.clone().setY(FLOOR + 2), label: "Professor Brand" };
    // He waits for you if you fall behind.
    const leash = () => {
      const d = this.walker.pos.distanceTo(this.prof.root.position);
      pw.speed = d > 7 ? 0 : 1.35;
      return d;
    };
    this.s.side.run(
      function* (this: CoordinatesChapter): Generator<Wait> {
        yield ui.say("Professor", "When they closed us down, the public had no patience for rockets while people went hungry. So we went underground and kept working.");
        yield () => this.walker.pos.x > 386;
        yield ui.say("Cooper", "What is all this?");
        yield () => this.walker.pos.x > H.x - 22;
        yield ui.say("Professor", "Look up.");
        yield 2.5;
        yield ui.say("Professor", "A station. The start of one. If I can solve the gravity problem, it lifts off with everyone on board.");
        yield ui.say("Cooper", "The whole thing? From the ground?");
        yield ui.say("Professor", "That's the problem I'm solving.");
        yield () => this.walker.pos.distanceTo(new THREE.Vector3(H.x + 2, FLOOR, CZ + 8)) < 16;
        yield ui.say("Cooper", "That's a Ranger. I trained on the simulator for one of those.");
        yield ui.say("Professor", "I know. I signed your paperwork.");
      }.bind(this),
    );
    yield () => (leash(), pw.done && this.walker.pos.x > 457);
    this.marker = null;
    ui.objective(null);
    ui.hint(null);
    yield* this.brief();
  }

  // --- Scene 5: the brief -------------------------------------------------------------------
  private *brief(): Generator<Wait> {
    const { ui, audio } = this.s;
    const { w } = this;
    this.checkpoint = "brief";
    this.goUnder();
    this.s.side.stop();
    this.mode = "cine";
    this.tars.root.visible = false;
    this.murph.root.visible = false;
    const O = SPOTS.holo;
    this.prof.root.visible = true;
    this.prof.root.position.set(O.x + 2.95, FLOOR, O.z - 1.1);
    this.prof.root.rotation.y = -Math.PI / 2 - 0.4;
    this.amelia.root.visible = true;
    this.amelia.root.position.set(O.x + 1.5, FLOOR, O.z + 2.75);
    this.amelia.root.rotation.y = Math.PI + 0.5;
    this.walkers = [];
    let holo = 0;
    const cam = this.s.camera;
    let a = Math.PI + 0.35;
    this.cineCam = (dt) => {
      a += dt * 0.045;
      cam.position.set(O.x + Math.cos(a) * 3.6, FLOOR + 1.85, O.z + Math.sin(a) * 3.6);
      cam.lookAt(O.x, FLOOR + 1.3, O.z);
      holo = Math.min(1, holo + dt / 3);
      w.compound.holoLevel(holo);
    };
    this.s.cinematicMode = true;
    audio.padLevel(0.25, 6);
    yield 1.5;
    yield ui.say("Professor", "Forty-eight years ago, something appeared near Saturn.");
    yield ui.say("Professor", "A sphere, two kilometres across, that bends the light around it. A hole in space. It connects to another galaxy.");
    yield ui.say("Cooper", "Nobody makes a wormhole.");
    yield ui.say("Brand", "Somebody did. And whoever they are, they put it where we'd find it.");
    yield ui.say("Professor", "We sent twelve people through, alone, one to each world we could see on the far side. The Lazarus missions.");
    yield ui.say("Professor", "Three of them are still sending good data. Miller. Mann. Edmunds.");
    yield ui.say("Cooper", "And the plan?");
    yield ui.say("Professor", "Plan A: I solve gravity, and the stations lift the people who are left off this planet.");
    yield ui.say("Brand", "Plan B: if he can't, we carry five thousand frozen embryos through, and start again out there.");
    yield ui.say("Cooper", "You need a pilot.");
    yield ui.say("Professor", "We need the best one we ever trained. The ship is nearly ready. Whatever sent you here chose you.");
    yield ui.say("Cooper", "I've got two kids.");
    yield ui.say("Professor", "Then go and save them. This world can't be saved, Cooper. It can only be left.");
    yield 1;
    audio.padLevel(0.4, 3);
    yield ui.fade(1, 2.2);
    this.cineCam = null;
    this.s.input.capture(false);
    ui.fade(0.6, 0.8);
    ui.end("Chapter three complete", "Coordinates", "Next: Don't Go. A watch, a bookshelf, a truck on the road.", [
      ["Continue ▶", () => this.s.play("goodbye")],
      ["Replay chapter", () => this.s.restart(false)],
      ["Chapters", () => this.s.toMenu()],
    ]);
  }

  // --- Helpers -------------------------------------------------------------------------------
  private drive() {
    this.mode = "drive";
    this.engineDead = false;
    this.w.truck.group.visible = true;
    this.driving.cam.reset();
    this.s.cinematicMode = false;
    this.s.gameplay();
  }
  private walkTo(p: Person | Tars, path: THREE.Vector3[], speed: number, face?: number) {
    this.walkers = this.walkers.filter((w) => w.p !== p);
    const w = { p, path, speed, i: 0, phase: 0, done: false, face };
    this.walkers.push(w);
    return w;
  }
  private arrived(p: Person | Tars) {
    return !this.walkers.some((w) => w.p === p && !w.done);
  }
  private stepWalkers(dt: number) {
    for (const w of this.walkers) {
      const root = w.p instanceof Tars ? w.p.root : w.p.root;
      let moving = 0;
      if (!w.done) {
        const target = w.path[w.i];
        const d = new THREE.Vector3(target.x - root.position.x, 0, target.z - root.position.z);
        const len = d.length();
        const step = w.speed * dt;
        if (len <= step || len < 0.02) {
          root.position.x = target.x;
          root.position.z = target.z;
          if (++w.i >= w.path.length) w.done = true;
        } else if (w.speed > 0) {
          root.position.addScaledVector(d.normalize(), step);
          const yaw = Math.atan2(d.x, d.z);
          let dy = yaw - root.rotation.y;
          dy = Math.atan2(Math.sin(dy), Math.cos(dy));
          root.rotation.y += dy * (1 - Math.exp(-8 * dt));
          moving = w.speed;
        }
      }
      if (w.done && w.face !== undefined) {
        let dy = w.face - root.rotation.y;
        dy = Math.atan2(Math.sin(dy), Math.cos(dy));
        root.rotation.y += dy * (1 - Math.exp(-5 * dt));
      }
      if (w.p instanceof Tars) {
        if (moving && Math.floor((w.phase + dt * 1.2) / 1) > Math.floor(w.phase / 1)) this.s.audio.servo(1);
        w.phase += dt * 1.2 * (moving ? 1 : 0);
        w.p.speed = moving;
      } else {
        w.phase += dt * moving * 5.2;
        walkPose(w.p, w.phase, moving ? 1 : 0);
      }
    }
  }

  // --- Frame ------------------------------------------------------------------------------------
  update(dt: number) {
    const { w, s } = this;
    const { ui, input, camera, audio } = s;
    this.t += dt;
    const truck = w.truck;
    const under = w.underground;

    if (!under) {
      const control = this.mode === "drive" && !this.engineDead;
      this.driving.update(dt, control, this.mode === "drive", w.farm.colliders, !this.engineDead);
      if (control && this.checkpoint === "road" && input.hit("KeyT") && truck.pos.z > GATE_Z + 400) this.skipAhead = true;
      audio.crickets(dt, Math.abs(truck.speed) < 5 || this.mode !== "drive");
      for (const p of [truck.tom, truck.murph]) if (p.root.visible) animatePerson(p, w.time, 2, this.watchman.group.visible ? this.watchman.group.position : undefined);
    } else {
      s.ui.speed(null);
      audio.truck(false, 0, 0, 0, 0, 0);
    }

    if (this.mode === "walk") this.walker.update(dt, input, w.compound.colliders, camera, !s.inCinematic);
    else if (this.mode === "seated") {
      this.walker.update(dt, input, w.compound.colliders, camera, false);
      // Keep the head turned within reach.
      this.walker.yaw = THREE.MathUtils.clamp(this.walker.yaw, -Math.PI / 2 - 1.6, -Math.PI / 2 + 1.6);
    }
    if (this.cineCam) this.cineCam(dt);

    this.stepWalkers(dt);
    this.tars.update(dt, this.talkTars);
    if (under) {
      const look = camera.position;
      if (this.murph.root.visible) animatePerson(this.murph, w.time, 2, this.tars.root.visible ? this.tars.root.position.clone().setY(FLOOR + 1.2) : look);
      for (const p of [this.prof, this.amelia]) if (p.root.visible && this.arrived(p)) animatePerson(p, w.time, 4, look);
    }

    ui.marker(this.marker && !s.inCinematic ? this.marker.at() : null, camera, this.marker?.label);
    w.update(dt, camera);
  }
}
