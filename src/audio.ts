// Original synthesized ambience. No copyrighted recordings, no autoplay.
// Everything sits between ~80 Hz and ~2 kHz so it carries on laptop and phone
// speakers, with a sub layer underneath for headphones.
function noiseBuffer(ctx: AudioContext, seconds: number, kind: "brown" | "pink") {
  const buffer = ctx.createBuffer(1, ctx.sampleRate * seconds, ctx.sampleRate),
    data = buffer.getChannelData(0);
  let b0 = 0,
    b1 = 0,
    b2 = 0,
    brown = 0,
    peak = 0;
  for (let i = 0; i < data.length; i++) {
    const white = Math.random() * 2 - 1;
    if (kind === "brown") {
      brown = (brown + white * 0.02) / 1.02;
      data[i] = brown;
    } else {
      b0 = 0.99765 * b0 + white * 0.099046;
      b1 = 0.963 * b1 + white * 0.2965164;
      b2 = 0.57 * b2 + white * 1.0526913;
      data[i] = b0 + b1 + b2 + white * 0.1848;
    }
    peak = Math.max(peak, Math.abs(data[i]));
  }
  // Normalise so every layer's gain means the same thing.
  for (let i = 0; i < data.length; i++) data[i] /= peak;
  return buffer;
}

export class Ambience {
  private ctx?: AudioContext;
  private gain?: GainNode;
  private padFilter?: BiquadFilterNode;
  private engine?: GainNode;
  private engineFilter?: BiquadFilterNode;
  private rumble?: GainNode;
  private rumbleFilter?: BiquadFilterNode;
  enabled = false;
  private build(ctx: AudioContext) {
    const master = ctx.createGain();
    master.gain.value = 0;
    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -14;
    limiter.knee.value = 8;
    limiter.ratio.value = 6;
    limiter.attack.value = 0.01;
    limiter.release.value = 0.3;
    master.connect(limiter).connect(ctx.destination);
    this.gain = master;
    const loop = (buffer: AudioBuffer, rate = 1) => {
      const s = ctx.createBufferSource();
      s.buffer = buffer;
      s.loop = true;
      s.playbackRate.value = rate;
      s.start();
      return s;
    };
    const lfo = (frequency: number, depth: number, target: AudioParam) => {
      const o = ctx.createOscillator(),
        g = ctx.createGain();
      o.frequency.value = frequency;
      g.gain.value = depth;
      o.connect(g).connect(target);
      o.start();
    };

    // Organ-like pad: an open A-minor voicing, each note two slightly detuned
    // voices so it slowly beats, through a filter that breathes.
    this.padFilter = ctx.createBiquadFilter();
    this.padFilter.type = "lowpass";
    this.padFilter.frequency.value = 900;
    this.padFilter.Q.value = 0.7;
    const pad = ctx.createGain();
    pad.gain.value = 0.2;
    this.padFilter.connect(pad).connect(master);
    lfo(0.05, 260, this.padFilter.frequency);
    [110, 164.81, 220, 261.63, 329.63, 440].forEach((frequency, i) => {
      const voice = ctx.createGain();
      voice.gain.value = 0.2 / (1 + i * 0.2);
      lfo(0.04 + i * 0.017, voice.gain.value * 0.45, voice.gain);
      for (const detune of [-5, 5]) {
        const o = ctx.createOscillator();
        o.type = i < 2 ? "sawtooth" : "triangle";
        o.frequency.value = frequency;
        o.detune.value = detune + (i % 2 ? 2 : -2);
        o.connect(voice);
        o.start();
      }
      voice.connect(this.padFilter!);
    });
    // Sub foundation for headphones.
    const sub = ctx.createOscillator(),
      subGain = ctx.createGain();
    sub.frequency.value = 55;
    subGain.gain.value = 0.05;
    sub.connect(subGain).connect(master);
    sub.start();

    // Space "wind": pink noise in a slowly wandering band.
    const pink = noiseBuffer(ctx, 6, "pink");
    const wind = ctx.createBiquadFilter();
    wind.type = "bandpass";
    wind.frequency.value = 520;
    wind.Q.value = 1.4;
    const windGain = ctx.createGain();
    windGain.gain.value = 0.06;
    loop(pink).connect(wind).connect(windGain).connect(master);
    lfo(0.031, 240, wind.frequency);

    // Engine: a roar of brown noise plus a harmonic drive hum; opens up with thrust.
    const brown = noiseBuffer(ctx, 5, "brown");
    this.engineFilter = ctx.createBiquadFilter();
    this.engineFilter.type = "lowpass";
    this.engineFilter.frequency.value = 260;
    this.engineFilter.Q.value = 0.9;
    this.engine = ctx.createGain();
    this.engine.gain.value = 0;
    this.engineFilter.connect(this.engine).connect(master);
    const roar = ctx.createGain();
    roar.gain.value = 0.9;
    loop(brown).connect(roar).connect(this.engineFilter);
    for (const [frequency, level] of [[73.4, 0.12], [146.8, 0.07], [220.2, 0.04]]) {
      const o = ctx.createOscillator(),
        g = ctx.createGain();
      o.type = "sawtooth";
      o.frequency.value = frequency;
      g.gain.value = level;
      o.connect(g).connect(this.engineFilter);
      o.start();
    }

    // Wormhole buffeting: noise through a resonant sweep, with a slow throb.
    this.rumbleFilter = ctx.createBiquadFilter();
    this.rumbleFilter.type = "lowpass";
    this.rumbleFilter.frequency.value = 180;
    this.rumbleFilter.Q.value = 3;
    this.rumble = ctx.createGain();
    this.rumble.gain.value = 0;
    const throb = ctx.createGain();
    throb.gain.value = 0.7;
    lfo(1.7, 0.3, throb.gain);
    loop(brown, 0.8).connect(this.rumbleFilter);
    loop(pink, 0.6).connect(this.rumbleFilter);
    this.rumbleFilter.connect(throb).connect(this.rumble).connect(master);
  }
  async toggle() {
    if (!this.ctx) {
      this.ctx = new AudioContext();
      this.build(this.ctx);
    }
    await this.ctx.resume();
    this.enabled = !this.enabled;
    this.gain!.gain.setTargetAtTime(this.enabled ? 0.9 : 0, this.ctx.currentTime, this.enabled ? 0.6 : 0.2);
    return this.enabled;
  }
  /** Observatory: the pad brightens as you fall toward the hole. */
  update(distance: number) {
    if (this.ctx && this.padFilter)
      this.padFilter.frequency.setTargetAtTime(750 + 1400 / Math.max(distance / 3, 1), this.ctx.currentTime, 2);
  }
  /** thrust −1..1, turbulence 0..1 */
  flight(thrust: number, turbulence: number) {
    if (!this.ctx || !this.engine || !this.engineFilter || !this.rumble || !this.rumbleFilter || !this.padFilter) return;
    const t = this.ctx.currentTime,
      drive = Math.min(1, Math.abs(thrust));
    this.engine.gain.setTargetAtTime(0.08 + drive * 0.55, t, 0.2);
    this.engineFilter.frequency.setTargetAtTime(240 + drive * 900 + turbulence * 400, t, 0.25);
    this.rumble.gain.setTargetAtTime(turbulence * 0.9, t, 0.35);
    this.rumbleFilter.frequency.setTargetAtTime(160 + turbulence * 1300, t, 0.5);
    this.padFilter.frequency.setTargetAtTime(850 + turbulence * 1600, t, 1.2);
  }
  suspend() {
    void this.ctx?.suspend();
  }
  resume() {
    if (this.enabled) void this.ctx?.resume();
  }
}
