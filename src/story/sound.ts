/**
 * Story-mode sound, all synthesised: truck engine, gravel, corn slapping the grille,
 * wind, the drone's propellers, birds, impacts and a slow organ pad for cinematics.
 */

function noise(ctx: AudioContext, seconds: number, kind: "white" | "pink" | "brown") {
  const buf = ctx.createBuffer(1, ctx.sampleRate * seconds, ctx.sampleRate),
    d = buf.getChannelData(0);
  let b0 = 0,
    b1 = 0,
    b2 = 0,
    last = 0;
  for (let i = 0; i < d.length; i++) {
    const w = Math.random() * 2 - 1;
    if (kind === "white") d[i] = w * 0.5;
    else if (kind === "pink") {
      b0 = 0.99765 * b0 + w * 0.099;
      b1 = 0.963 * b1 + w * 0.2965;
      b2 = 0.57 * b2 + w * 1.0527;
      d[i] = (b0 + b1 + b2 + w * 0.1848) * 0.12;
    } else {
      last = (last + 0.02 * w) / 1.02;
      d[i] = last * 3.2;
    }
  }
  return buf;
}

export class StoryAudio {
  private ctx?: AudioContext;
  private master!: GainNode;
  private engineA!: OscillatorNode;
  private engineB!: OscillatorNode;
  private engineF!: BiquadFilterNode;
  private engineG!: GainNode;
  private gravel!: GainNode;
  private corn!: GainNode;
  private cornF!: BiquadFilterNode;
  private wind!: GainNode;
  private droneA!: OscillatorNode;
  private droneB!: OscillatorNode;
  private droneG!: GainNode;
  private pad!: GainNode;
  private padVoices: OscillatorNode[] = [];
  private birdT = 3;
  private cricketT = 1;
  private stormG!: GainNode;
  private stormF!: BiquadFilterNode;
  private whistleG!: GainNode;
  private whistleF!: BiquadFilterNode;
  private hissG!: GainNode;
  private humG!: GainNode;
  private rumbleG!: GainNode;
  private rumbleF!: BiquadFilterNode;
  enabled = true;

  /** Must be called from a user gesture. */
  resume() {
    if (!this.ctx) this.build();
    void this.ctx!.resume();
  }
  suspend() {
    void this.ctx?.suspend();
  }
  private loop(buf: AudioBuffer) {
    const s = this.ctx!.createBufferSource();
    s.buffer = buf;
    s.loop = true;
    s.start();
    return s;
  }
  private build() {
    const ctx = (this.ctx = new AudioContext());
    this.master = ctx.createGain();
    this.master.gain.value = 0.8;
    const comp = ctx.createDynamicsCompressor();
    this.master.connect(comp).connect(ctx.destination);
    const white = noise(ctx, 3, "white"),
      pink = noise(ctx, 4, "pink"),
      brown = noise(ctx, 4, "brown");
    // Engine: two detuned oscillators through a lowpass that opens with revs.
    this.engineA = ctx.createOscillator();
    this.engineA.type = "sawtooth";
    this.engineB = ctx.createOscillator();
    this.engineB.type = "square";
    this.engineF = ctx.createBiquadFilter();
    this.engineF.type = "lowpass";
    this.engineF.Q.value = 3;
    this.engineG = ctx.createGain();
    this.engineG.gain.value = 0;
    const bg = ctx.createGain();
    bg.gain.value = 0.5;
    this.engineA.connect(this.engineF);
    this.engineB.connect(bg).connect(this.engineF);
    this.engineF.connect(this.engineG).connect(this.master);
    this.engineA.start();
    this.engineB.start();
    // Tyres on gravel.
    const gf = ctx.createBiquadFilter();
    gf.type = "bandpass";
    gf.frequency.value = 520;
    gf.Q.value = 0.7;
    this.gravel = ctx.createGain();
    this.gravel.gain.value = 0;
    this.loop(brown).connect(gf).connect(this.gravel).connect(this.master);
    // Corn stalks whipping the grille.
    this.cornF = ctx.createBiquadFilter();
    this.cornF.type = "highpass";
    this.cornF.frequency.value = 1400;
    this.corn = ctx.createGain();
    this.corn.gain.value = 0;
    this.loop(white).connect(this.cornF).connect(this.corn).connect(this.master);
    // Wind.
    const wf = ctx.createBiquadFilter();
    wf.type = "lowpass";
    wf.frequency.value = 650;
    this.wind = ctx.createGain();
    this.wind.gain.value = 0.05;
    this.loop(pink).connect(wf).connect(this.wind).connect(this.master);
    // The drone: two electric motors, slightly out of tune, and prop buzz.
    this.droneA = ctx.createOscillator();
    this.droneA.type = "sawtooth";
    this.droneA.frequency.value = 188;
    this.droneB = ctx.createOscillator();
    this.droneB.type = "sawtooth";
    this.droneB.frequency.value = 191.5;
    const df = ctx.createBiquadFilter();
    df.type = "bandpass";
    df.frequency.value = 900;
    df.Q.value = 0.8;
    this.droneG = ctx.createGain();
    this.droneG.gain.value = 0;
    this.droneA.connect(df);
    this.droneB.connect(df);
    df.connect(this.droneG).connect(this.master);
    this.droneA.start();
    this.droneB.start();
    // Dust storm: a roar, a whistle that wanders in pitch, and grit hissing on glass.
    this.stormF = ctx.createBiquadFilter();
    this.stormF.type = "lowpass";
    this.stormF.frequency.value = 900;
    this.stormG = ctx.createGain();
    this.stormG.gain.value = 0;
    this.loop(pink).connect(this.stormF).connect(this.stormG).connect(this.master);
    this.whistleF = ctx.createBiquadFilter();
    this.whistleF.type = "bandpass";
    this.whistleF.frequency.value = 700;
    this.whistleF.Q.value = 9;
    this.whistleG = ctx.createGain();
    this.whistleG.gain.value = 0;
    this.loop(white).connect(this.whistleF).connect(this.whistleG).connect(this.master);
    const hf = ctx.createBiquadFilter();
    hf.type = "highpass";
    hf.frequency.value = 3200;
    this.hissG = ctx.createGain();
    this.hissG.gain.value = 0;
    this.loop(white).connect(hf).connect(this.hissG).connect(this.master);
    // Machine-room hum: mains harmonics and moving air, for the facility.
    this.humG = ctx.createGain();
    this.humG.gain.value = 0;
    const humF = ctx.createBiquadFilter();
    humF.type = "lowpass";
    humF.frequency.value = 700;
    this.humG.connect(this.master);
    humF.connect(this.humG);
    for (const [f, l] of [
      [120, 0.12],
      [240, 0.06],
      [360, 0.03],
    ]) {
      const o = ctx.createOscillator();
      o.type = "sawtooth";
      o.frequency.value = f;
      const g = ctx.createGain();
      g.gain.value = l;
      o.connect(g).connect(humF);
      o.start();
    }
    const air = ctx.createBiquadFilter();
    air.type = "bandpass";
    air.frequency.value = 500;
    air.Q.value = 0.5;
    const airG = ctx.createGain();
    airG.gain.value = 0.6;
    this.loop(pink).connect(air).connect(airG).connect(this.humG);
    // Launch rumble: brown noise, low and heavy, opening up as it grows.
    this.rumbleF = ctx.createBiquadFilter();
    this.rumbleF.type = "lowpass";
    this.rumbleF.frequency.value = 90;
    this.rumbleG = ctx.createGain();
    this.rumbleG.gain.value = 0;
    this.loop(brown).connect(this.rumbleF).connect(this.rumbleG).connect(this.master);
    // Organ pad (for titles and quiet moments).
    this.pad = ctx.createGain();
    this.pad.gain.value = 0;
    const padF = ctx.createBiquadFilter();
    padF.type = "lowpass";
    padF.frequency.value = 1800;
    this.pad.connect(padF).connect(this.master);
    for (const f of [110, 164.81, 220, 277.18, 329.63]) {
      for (const [type, mult, level] of [
        ["sine", 1, 0.18],
        ["triangle", 2, 0.05],
      ] as [OscillatorType, number, number][]) {
        const o = ctx.createOscillator();
        o.type = type;
        o.frequency.value = f * mult;
        const g = ctx.createGain();
        g.gain.value = level;
        o.connect(g).connect(this.pad);
        o.start();
        this.padVoices.push(o);
      }
    }
  }
  private set(param: AudioParam, value: number, tau = 0.08) {
    if (!this.ctx) return;
    param.setTargetAtTime(value, this.ctx.currentTime, tau);
  }
  /** Truck: rpm 0..1, load 0..1 (throttle), speed m/s, corn 0..1, off-road 0/1. */
  truck(on: boolean, rpm: number, load: number, speed: number, corn: number, offRoad: number) {
    if (!this.ctx) return;
    const f = 34 + rpm * 70;
    this.set(this.engineA.frequency, f);
    this.set(this.engineB.frequency, f * 0.5 + 0.7);
    this.set(this.engineF.frequency, 180 + rpm * 900 + load * 600);
    this.set(this.engineG.gain, on ? 0.09 + load * 0.08 : 0, 0.15);
    const s = Math.min(1, Math.abs(speed) / 25);
    this.set(this.gravel.gain, on ? s * (0.05 + offRoad * 0.18) : 0);
    const slap = corn * s * (0.55 + 0.45 * Math.sin(this.ctx.currentTime * 31) * Math.sin(this.ctx.currentTime * 7.3));
    this.set(this.corn.gain, on ? slap * 0.35 : 0, 0.03);
    this.set(this.cornF.frequency, 1100 + corn * 900);
    this.set(this.wind.gain, 0.04 + s * 0.12, 0.3);
  }
  /** Drone loudness falls with distance (metres). */
  drone(distance: number | null) {
    if (!this.ctx) return;
    const g = distance === null ? 0 : Math.min(0.12, 9 / Math.max(distance, 20));
    this.set(this.droneG.gain, g, 0.2);
  }
  padLevel(level: number, seconds = 3) {
    if (!this.ctx) return;
    this.set(this.pad.gain, level * 0.5, seconds / 3);
  }
  /** Meadowlark-like calls now and then while it's quiet. */
  birds(dt: number, on: boolean) {
    if (!this.ctx || !on) return;
    this.birdT -= dt;
    if (this.birdT > 0) return;
    this.birdT = 3 + Math.random() * 7;
    const ctx = this.ctx,
      t = ctx.currentTime;
    const pan = ctx.createStereoPanner();
    pan.pan.value = Math.random() * 1.6 - 0.8;
    pan.connect(this.master);
    const notes = 3 + Math.floor(Math.random() * 3);
    let at = t;
    for (let i = 0; i < notes; i++) {
      const o = ctx.createOscillator(),
        g = ctx.createGain();
      o.type = "sine";
      const f0 = 2200 + Math.random() * 1600;
      o.frequency.setValueAtTime(f0, at);
      o.frequency.exponentialRampToValueAtTime(f0 * (0.7 + Math.random() * 0.6), at + 0.12);
      g.gain.setValueAtTime(0, at);
      g.gain.linearRampToValueAtTime(0.018, at + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, at + 0.16);
      o.connect(g).connect(pan);
      o.start(at);
      o.stop(at + 0.2);
      at += 0.13 + Math.random() * 0.12;
    }
  }
  /** A thud: collisions and hard landings. */
  thud(strength: number) {
    if (!this.ctx) return;
    const ctx = this.ctx,
      t = ctx.currentTime;
    const s = ctx.createBufferSource();
    s.buffer = noise(ctx, 0.5, "brown");
    const f = ctx.createBiquadFilter();
    f.type = "lowpass";
    f.frequency.value = 400;
    const g = ctx.createGain();
    g.gain.setValueAtTime(Math.min(0.9, strength * 0.08), t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.45);
    s.connect(f).connect(g).connect(this.master);
    s.start();
  }
  /** Quick blips for the laptop. */
  blip(freq: number, level = 0.04) {
    if (!this.ctx) return;
    const ctx = this.ctx,
      t = ctx.currentTime;
    const o = ctx.createOscillator(),
      g = ctx.createGain();
    o.type = "square";
    o.frequency.value = freq;
    g.gain.setValueAtTime(level, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.08);
    o.connect(g).connect(this.master);
    o.start();
    o.stop(t + 0.1);
  }
  /** The storm, 0..1. Indoors it is muffled and the wind whistles through the window. */
  storm(level: number, indoor = 0) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const gust = 0.75 + 0.25 * Math.sin(t * 0.7) * Math.sin(t * 0.23 + 1);
    this.set(this.stormG.gain, level * gust * (0.5 - indoor * 0.3), 0.3);
    this.set(this.stormF.frequency, 1100 - indoor * 700, 0.3);
    this.set(this.whistleG.gain, level * gust * (0.05 + indoor * 0.12), 0.3);
    this.set(this.whistleF.frequency, 520 + 380 * gust + indoor * 200, 0.4);
    this.set(this.hissG.gain, level * (0.06 - indoor * 0.03), 0.3);
  }
  hum(level: number) {
    this.set(this.humG.gain, level * 0.18, 0.6);
  }
  /** Crickets on a still night. */
  crickets(dt: number, on: boolean) {
    if (!this.ctx || !on) return;
    this.cricketT -= dt;
    if (this.cricketT > 0) return;
    this.cricketT = 0.4 + Math.random() * 0.9;
    const ctx = this.ctx,
      t = ctx.currentTime;
    const pan = ctx.createStereoPanner();
    pan.pan.value = Math.random() * 1.8 - 0.9;
    pan.connect(this.master);
    const f = 4200 + Math.random() * 600;
    for (let i = 0; i < 3; i++) {
      const o = ctx.createOscillator(),
        g = ctx.createGain();
      o.frequency.value = f;
      const at = t + i * 0.05;
      g.gain.setValueAtTime(0, at);
      g.gain.linearRampToValueAtTime(0.006, at + 0.008);
      g.gain.exponentialRampToValueAtTime(0.0001, at + 0.035);
      o.connect(g).connect(pan);
      o.start(at);
      o.stop(at + 0.05);
    }
  }
  /** TARS moving: a short servo whine and a clunk. */
  servo(pitch = 1) {
    if (!this.ctx) return;
    const ctx = this.ctx,
      t = ctx.currentTime;
    const o = ctx.createOscillator(),
      g = ctx.createGain(),
      f = ctx.createBiquadFilter();
    o.type = "sawtooth";
    o.frequency.setValueAtTime(260 * pitch, t);
    o.frequency.linearRampToValueAtTime(420 * pitch, t + 0.18);
    f.type = "bandpass";
    f.frequency.value = 900;
    f.Q.value = 2;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.03, t + 0.03);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.24);
    o.connect(f).connect(g).connect(this.master);
    o.start(t);
    o.stop(t + 0.26);
    setTimeout(() => this.thud(1.4), 200);
  }
  /** The security drone's pulse: a falling whine and a crack, then the engine dies. */
  zap() {
    if (!this.ctx) return;
    const ctx = this.ctx,
      t = ctx.currentTime;
    const o = ctx.createOscillator(),
      g = ctx.createGain();
    o.type = "square";
    o.frequency.setValueAtTime(1800, t);
    o.frequency.exponentialRampToValueAtTime(60, t + 1.1);
    g.gain.setValueAtTime(0.06, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 1.2);
    o.connect(g).connect(this.master);
    o.start(t);
    o.stop(t + 1.25);
    this.thud(6);
  }
  /** Wading: a slosh for each stride. */
  splash(level = 1) {
    if (!this.ctx) return;
    const ctx = this.ctx,
      t = ctx.currentTime;
    const s = ctx.createBufferSource();
    s.buffer = noise(ctx, 0.4, "pink");
    const f = ctx.createBiquadFilter();
    f.type = "bandpass";
    f.frequency.value = 700 + Math.random() * 500;
    f.Q.value = 0.8;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.09 * level, t + 0.04);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
    s.connect(f).connect(g).connect(this.master);
    s.start(t);
  }
  /** A watch ticking, very close. */
  tick(level = 1) {
    if (!this.ctx) return;
    const ctx = this.ctx,
      t = ctx.currentTime;
    const o = ctx.createOscillator(),
      g = ctx.createGain(),
      f = ctx.createBiquadFilter();
    o.type = "square";
    o.frequency.value = 3400;
    f.type = "highpass";
    f.frequency.value = 2400;
    g.gain.setValueAtTime(0.02 * level, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.018);
    o.connect(f).connect(g).connect(this.master);
    o.start(t);
    o.stop(t + 0.02);
  }
  /** The two-tone radio beep that ends a transmission from mission control. */
  radio() {
    if (!this.ctx) return;
    const ctx = this.ctx,
      t = ctx.currentTime;
    for (const [f, at] of [
      [2525, 0],
      [2475, 0.26],
    ]) {
      const o = ctx.createOscillator(),
        g = ctx.createGain();
      o.frequency.value = f;
      g.gain.setValueAtTime(0, t + at);
      g.gain.linearRampToValueAtTime(0.025, t + at + 0.01);
      g.gain.setValueAtTime(0.025, t + at + 0.2);
      g.gain.linearRampToValueAtTime(0, t + at + 0.22);
      o.connect(g).connect(this.master);
      o.start(t + at);
      o.stop(t + at + 0.25);
    }
  }
  /** Engine rumble, 0..1: a far-off growl that becomes a roar. */
  rumble(level: number, seconds = 0.3) {
    if (!this.ctx) return;
    this.set(this.rumbleG.gain, level * 1.1, seconds / 3);
    this.set(this.rumbleF.frequency, 70 + level * 420, seconds / 3);
  }
  silence() {
    if (!this.ctx) return;
    this.rumble(0);
    this.truck(false, 0, 0, 0, 0, 0);
    this.drone(null);
    this.padLevel(0, 1);
    this.storm(0);
    this.hum(0);
  }
}
