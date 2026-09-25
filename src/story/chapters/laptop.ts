import type { StoryAudio } from "../sound";

/**
 * Taking over the drone from the laptop: its control link wanders across the band;
 * keep the tuner on it until the handshake completes, then send it down.
 */
export class Laptop {
  readonly el: HTMLElement;
  private canvas: HTMLCanvasElement;
  private g: CanvasRenderingContext2D;
  private peak = 0.3;
  private peakV = 0;
  private tuner = 0.7;
  lock = 0;
  private t = 0;
  private stage: "tune" | "ready" | "done" = "tune";
  private blipT = 0;
  constructor(
    host: HTMLElement,
    private audio: StoryAudio,
    private onLand: () => void,
    private onCancel: () => void,
  ) {
    this.el = document.createElement("section");
    this.el.className = "sb-laptop";
    this.el.innerHTML = `<div class="screen"><canvas width="720" height="380"></canvas><div class="readout"><span class="status">LINK: SEARCHING</span><span>Mouse: tune · <b class="land-key">Enter</b>: land · Esc: close</span></div></div>`;
    host.append(this.el);
    this.canvas = this.el.querySelector("canvas")!;
    this.g = this.canvas.getContext("2d")!;
    const move = (e: PointerEvent) => {
      const r = this.canvas.getBoundingClientRect();
      this.tuner = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
    };
    this.canvas.addEventListener("pointermove", move);
    this.canvas.addEventListener("pointerdown", move);
    this.keyHandler = (e: KeyboardEvent) => {
      if (e.code === "Escape") {
        e.preventDefault();
        this.onCancel();
      } else if ((e.code === "Enter" || e.code === "KeyE") && this.stage === "ready") {
        this.stage = "done";
        this.audio.blip(880, 0.05);
        this.onLand();
      } else if (e.code === "ArrowLeft" || e.code === "KeyA") this.tuner = Math.max(0, this.tuner - 0.02);
      else if (e.code === "ArrowRight" || e.code === "KeyD") this.tuner = Math.min(1, this.tuner + 0.02);
    };
    window.addEventListener("keydown", this.keyHandler);
  }
  private keyHandler: (e: KeyboardEvent) => void;
  get ready() {
    return this.stage !== "tune";
  }
  update(dt: number) {
    this.t += dt;
    // The link drifts, faster until you've nearly got it.
    this.peakV += (Math.random() - 0.5) * dt * (this.stage === "tune" ? 1.6 : 0.2);
    this.peakV *= Math.exp(-dt * 1.2);
    this.peak += this.peakV * dt;
    if (this.peak < 0.08 || this.peak > 0.92) this.peakV = -this.peakV;
    this.peak = Math.min(0.92, Math.max(0.08, this.peak));
    const off = Math.abs(this.tuner - this.peak);
    if (this.stage === "tune") {
      if (off < 0.035) this.lock += dt * 0.28;
      else this.lock = Math.max(0, this.lock - dt * (off < 0.08 ? 0.03 : 0.12));
      this.blipT -= dt;
      if (off < 0.035 && this.blipT <= 0) {
        this.audio.blip(500 + this.lock * 900, 0.025);
        this.blipT = 0.25;
      }
      if (this.lock >= 1) {
        this.lock = 1;
        this.stage = "ready";
        this.audio.blip(1200, 0.05);
      }
    }
    this.draw(off);
  }
  private draw(off: number) {
    const g = this.g,
      W = this.canvas.width,
      H = this.canvas.height;
    g.fillStyle = "#020604";
    g.fillRect(0, 0, W, H);
    g.fillStyle = "#7dff9a";
    g.font = "13px 'IBM Plex Mono', monospace";
    g.fillText("UAV CONTROL LINK · SOLAR RECON · SER 7A-5520", 18, 26);
    g.fillText(`T+${(3650 + this.t / 86400).toFixed(2)} DAYS ON STATION`, 18, 46);
    // Spectrum: noise floor plus the drone's carrier.
    const base = H - 90,
      top = 80;
    g.strokeStyle = "#1d3a24";
    for (let x = 0; x <= 10; x++) {
      g.beginPath();
      g.moveTo(18 + (x * (W - 36)) / 10, top);
      g.lineTo(18 + (x * (W - 36)) / 10, base);
      g.stroke();
    }
    g.strokeStyle = "#7dff9a";
    g.beginPath();
    for (let i = 0; i <= 240; i++) {
      const f = i / 240;
      const carrier = Math.exp(-(((f - this.peak) / 0.02) ** 2)) * (0.75 + 0.1 * Math.sin(this.t * 13));
      const n = Math.random() * 0.12 + 0.04;
      const y = base - (n + carrier) * (base - top);
      const x = 18 + f * (W - 36);
      if (i) g.lineTo(x, y);
      else g.moveTo(x, y);
    }
    g.stroke();
    // Tuner.
    const tx = 18 + this.tuner * (W - 36);
    g.strokeStyle = off < 0.035 ? "#d6ffe0" : "#e0b24f";
    g.setLineDash([4, 4]);
    g.beginPath();
    g.moveTo(tx, top - 10);
    g.lineTo(tx, base + 6);
    g.stroke();
    g.setLineDash([]);
    g.fillStyle = off < 0.035 ? "#d6ffe0" : "#e0b24f";
    g.fillText(`${(2.2 + this.tuner * 0.4).toFixed(4)} GHz`, Math.min(W - 110, tx + 6), top - 14);
    // Handshake bar.
    g.fillStyle = "#7dff9a";
    g.fillText("HANDSHAKE", 18, H - 52);
    g.strokeStyle = "#7dff9a";
    g.strokeRect(110, H - 64, W - 128, 16);
    g.fillRect(112, H - 62, (W - 132) * this.lock, 12);
    const status = this.el.querySelector(".status")!;
    if (this.stage === "tune") {
      status.textContent = this.lock > 0.02 ? `LINK: ACQUIRING ${Math.round(this.lock * 100)}%` : "LINK: SEARCHING · FOLLOW THE CARRIER";
    } else {
      status.textContent = this.stage === "ready" ? "LINK: MANUAL CONTROL · PRESS ENTER TO LAND" : "AUTOLAND ENGAGED";
      g.fillStyle = Math.sin(this.t * 6) > 0 ? "#d6ffe0" : "#7dff9a";
      g.font = "20px 'IBM Plex Mono', monospace";
      g.fillText(this.stage === "ready" ? "> CONTROL ACQUIRED. [ENTER] LAND" : "> DESCENDING", 18, H - 18);
    }
    // Scanlines.
    g.fillStyle = "rgba(0,0,0,.18)";
    for (let y = 0; y < H; y += 3) g.fillRect(0, y, W, 1);
  }
  dispose() {
    window.removeEventListener("keydown", this.keyHandler);
    this.el.remove();
  }
}
