// Original synthesized ambience. No copyrighted recordings, no autoplay.
export class Ambience {
  private ctx?: AudioContext;
  private gain?: GainNode;
  private filter?: BiquadFilterNode;
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
  suspend() {
    void this.ctx?.suspend();
  }
  resume() {
    if (this.enabled) void this.ctx?.resume();
  }
}
