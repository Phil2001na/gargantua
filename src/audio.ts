// Original synthesized ambience. No copyrighted recordings, no autoplay.
export class Ambience {
  private ctx?: AudioContext;
  private gain?: GainNode;
  private filter?: BiquadFilterNode;
  private engine?: GainNode;
  private rumble?: GainNode;
  private rumbleFilter?: BiquadFilterNode;
  enabled = false;
  async toggle() {
    if (!this.ctx) {
      this.ctx = new AudioContext();
      this.gain = this.ctx.createGain();
      this.gain.gain.value = 0;
      this.gain.connect(this.ctx.destination);
      this.filter = this.ctx.createBiquadFilter();
      this.filter.type = "lowpass";
      this.filter.frequency.value = 160;
      this.filter.connect(this.gain);
      [32.7, 49, 65.41, 98.0, 130.81].forEach((frequency, i) => {
        const oscillator = this.ctx!.createOscillator(),
          g = this.ctx!.createGain();
        oscillator.type = "sine";
        oscillator.frequency.value = frequency;
        oscillator.detune.value = i % 2 ? 3 : -3;
        g.gain.value = 0.045 / (1 + i * 0.3);
        oscillator.connect(g);
        g.connect(this.filter!);
        oscillator.start();
        const lfo = this.ctx!.createOscillator(),
          depth = this.ctx!.createGain();
        lfo.frequency.value = 0.035 + i * 0.013;
        depth.gain.value = 0.011;
        lfo.connect(depth);
        depth.connect(g.gain);
        lfo.start();
      });
      const buffer = this.ctx.createBuffer(
          1,
          this.ctx.sampleRate * 4,
          this.ctx.sampleRate,
        ),
        data = buffer.getChannelData(0);
      let previous = 0;
      for (let i = 0; i < data.length; i++) {
        previous = (previous + Math.random() * 0.04 - 0.02) / 1.02;
        data[i] = previous * 0.3;
      }
      const source = this.ctx.createBufferSource();
      source.buffer = buffer;
      source.loop = true;
      source.connect(this.filter);
      source.start();
      // Ship engine: a low, filtered noise bed felt more than heard.
      const noise = this.ctx.createBuffer(1, this.ctx.sampleRate * 3, this.ctx.sampleRate),
        nd = noise.getChannelData(0);
      let brown = 0;
      for (let i = 0; i < nd.length; i++) {
        brown = (brown + (Math.random() * 2 - 1) * 0.02) / 1.02;
        nd[i] = brown * 3.5;
      }
      const engineSource = this.ctx.createBufferSource();
      engineSource.buffer = noise;
      engineSource.loop = true;
      const engineFilter = this.ctx.createBiquadFilter();
      engineFilter.type = "bandpass";
      engineFilter.frequency.value = 70;
      engineFilter.Q.value = 0.8;
      this.engine = this.ctx.createGain();
      this.engine.gain.value = 0;
      engineSource.connect(engineFilter).connect(this.engine).connect(this.gain);
      engineSource.start();
      const hum = this.ctx.createOscillator();
      hum.type = "sawtooth";
      hum.frequency.value = 41;
      const humFilter = this.ctx.createBiquadFilter();
      humFilter.type = "lowpass";
      humFilter.frequency.value = 90;
      const humGain = this.ctx.createGain();
      humGain.gain.value = 0.12;
      hum.connect(humFilter).connect(humGain).connect(this.engine);
      hum.start();
      // Wormhole buffeting: noise swept by a slow, irregular filter.
      const rumbleSource = this.ctx.createBufferSource();
      rumbleSource.buffer = noise;
      rumbleSource.loop = true;
      rumbleSource.playbackRate.value = 0.7;
      this.rumbleFilter = this.ctx.createBiquadFilter();
      this.rumbleFilter.type = "lowpass";
      this.rumbleFilter.frequency.value = 120;
      this.rumble = this.ctx.createGain();
      this.rumble.gain.value = 0;
      rumbleSource.connect(this.rumbleFilter).connect(this.rumble).connect(this.gain);
      rumbleSource.start();
    }
    await this.ctx.resume();
    this.enabled = !this.enabled;
    this.gain!.gain.setTargetAtTime(
      this.enabled ? 0.8 : 0,
      this.ctx.currentTime,
      0.8,
    );
    return this.enabled;
  }
  update(distance: number) {
    if (this.ctx && this.filter)
      this.filter.frequency.setTargetAtTime(
        130 + 500 / Math.max(distance / 3, 1),
        this.ctx.currentTime,
        2,
      );
  }
  /** thrust 0..1, turbulence 0..1 */
  flight(thrust: number, turbulence: number) {
    if (!this.ctx || !this.engine || !this.rumble || !this.rumbleFilter) return;
    const t = this.ctx.currentTime;
    this.engine.gain.setTargetAtTime(0.05 + thrust * 0.5, t, 0.25);
    this.rumble.gain.setTargetAtTime(turbulence * 1.1, t, 0.4);
    this.rumbleFilter.frequency.setTargetAtTime(90 + turbulence * 420, t, 0.5);
  }
  suspend() {
    void this.ctx?.suspend();
  }
  resume() {
    if (this.enabled) void this.ctx?.resume();
  }
}
