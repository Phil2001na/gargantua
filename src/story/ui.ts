import * as THREE from "three";
import "./story.css";

type Line = { speaker: string; text: string; duration: number };

export type ChapterEntry = { id: string; number: string; title: string; blurb: string; ready: boolean };

/** The story overlay: subtitles, objectives, prompts, cards, fades, menus. */
export class StoryUI {
  readonly root: HTMLElement;
  private q = <T extends HTMLElement = HTMLElement>(sel: string) => this.root.querySelector(sel) as T;
  private lines: Line[] = [];
  private current: Line | null = null;
  private lineT = 0;
  private fadeFrom = 0;
  private fadeTo = 0;
  private fadeT = 1;
  private fadeDur = 0;
  fadeValue = 0;
  constructor() {
    this.root = document.createElement("div");
    this.root.className = "story";
    this.root.hidden = true;
    this.root.innerHTML = `
      <div class="sb-bar sb-top"></div><div class="sb-bar sb-bottom"></div>
      <div class="sb-objective" hidden><span class="sb-micro">Objective</span><strong></strong></div>
      <div class="sb-marker" hidden><i></i><span></span></div>
      <div class="sb-meter" hidden><span class="sb-micro"></span><b><i></i></b></div>
      <div class="sb-speed" hidden><strong>0</strong><span>km/h</span></div>
      <div class="sb-prompt" hidden><kbd></kbd><span></span></div>
      <div class="sb-sub" aria-live="polite"><span class="who"></span><span class="what"></span></div>
      <div class="sb-hint" hidden></div>
      <div class="sb-choice" hidden></div>
      <div class="sb-telemetry" hidden></div>
      <div class="sb-skip" hidden>Hold <kbd>Space</kbd> to skip <b><i></i></b></div>
      <button class="sb-click" hidden>Click to look around</button>
      <div class="sb-fade"></div>
      <div class="sb-card" hidden><span class="sb-micro"></span><h2></h2><p></p></div>
      <section class="sb-menu" hidden>
        <div class="sb-menu-in">
          <div class="sb-micro">A playable journey · inspired by Interstellar</div>
          <h1>Endurance</h1>
          <p class="lede">From a dust-choked farm to the far side of a black hole. Play it from the start, or pick a chapter.</p>
          <ol class="sb-chapters"></ol>
          <div class="sb-menu-foot"><button class="sb-back">← Back to the observatory</button><span>Headphones recommended · mouse and keyboard</span></div>
        </div>
      </section>
      <section class="sb-pause" hidden>
        <div class="sb-panel"><div class="sb-micro">Paused</div><h2 class="sb-pause-title"></h2>
        <button data-act="resume">Resume</button><button data-act="checkpoint">Restart from checkpoint</button><button data-act="restart">Restart chapter</button><button data-act="menu">Chapters</button>
        <div class="sb-keys"></div></div>
      </section>
      <section class="sb-end" hidden>
        <div class="sb-panel"><div class="sb-micro"></div><h2></h2><p></p><div class="sb-end-actions"></div></div>
      </section>`;
    document.body.append(this.root);
  }

  // --- Subtitles ------------------------------------------------------------
  say(speaker: string, text: string, duration?: number) {
    const words = text.split(/\s+/).length;
    this.lines.push({ speaker, text, duration: duration ?? Math.max(1.8, 1 + words * 0.32) });
    const line = this.lines[this.lines.length - 1];
    return () => this.current !== line && !this.lines.includes(line);
  }
  get talking() {
    return !!this.current || this.lines.length > 0;
  }
  clearLines() {
    this.lines = [];
    this.current = null;
    this.q(".sb-sub").classList.remove("show");
  }
  private showLine(l: Line | null) {
    const el = this.q(".sb-sub");
    if (!l) {
      el.classList.remove("show");
      return;
    }
    this.q(".sb-sub .who").textContent = l.speaker;
    this.q(".sb-sub .what").textContent = l.text;
    el.classList.toggle("narration", !l.speaker);
    el.classList.add("show");
  }

  // --- HUD ------------------------------------------------------------------
  objective(text: string | null) {
    const el = this.q(".sb-objective");
    el.hidden = !text;
    if (text) {
      if (this.q(".sb-objective strong").textContent !== text) {
        el.classList.remove("new");
        void el.offsetWidth;
        el.classList.add("new");
      }
      this.q(".sb-objective strong").textContent = text;
    }
  }
  /** Flight data, top right: rows of label and value. */
  telemetry(rows: [string, string][] | null) {
    const el = this.q(".sb-telemetry");
    el.hidden = !rows;
    if (rows) el.innerHTML = rows.map(([k, v]) => `<div><span>${k}</span><b>${v}</b></div>`).join("");
  }
  /** Numbered replies for the player to pick with 1, 2, 3 (the chapter reads the keys). */
  choice(options: string[] | null) {
    const el = this.q(".sb-choice");
    el.hidden = !options;
    el.innerHTML = options ? options.map((o, i) => `<div><kbd>${i + 1}</kbd><span>${o}</span></div>`).join("") : "";
  }
  prompt(key: string | null, text = "") {
    const el = this.q(".sb-prompt");
    el.hidden = !key;
    if (key) {
      this.q(".sb-prompt kbd").textContent = key;
      this.q(".sb-prompt span").textContent = text;
    }
  }
  meter(label: string | null, value = 0) {
    const el = this.q(".sb-meter");
    el.hidden = label === null;
    if (label !== null) {
      this.q(".sb-meter .sb-micro").textContent = label;
      this.q<HTMLElement>(".sb-meter i").style.width = `${Math.round(THREE.MathUtils.clamp(value, 0, 1) * 100)}%`;
      el.classList.toggle("full", value >= 1);
    }
  }
  speed(kmh: number | null) {
    const el = this.q(".sb-speed");
    el.hidden = kmh === null;
    if (kmh !== null) this.q(".sb-speed strong").textContent = String(Math.round(Math.abs(kmh)));
  }
  hint(html: string | null) {
    const el = this.q(".sb-hint");
    el.hidden = !html;
    if (html) el.innerHTML = html;
  }
  clickToLook(show: boolean) {
    this.q(".sb-click").hidden = !show;
  }
  /** A diamond over a world point, with distance. */
  marker(world: THREE.Vector3 | null, camera: THREE.Camera, label = "") {
    const el = this.q(".sb-marker");
    if (!world) {
      el.hidden = true;
      return;
    }
    const p = world.clone().project(camera);
    const behind = p.z > 1;
    let x = p.x,
      y = p.y;
    if (behind) {
      x = -x;
      y = -1;
    }
    const edge = Math.max(Math.abs(x), Math.abs(y));
    if (edge > 0.9) {
      x *= 0.9 / edge;
      y *= 0.9 / edge;
    }
    el.hidden = false;
    el.style.transform = `translate(${((x + 1) / 2) * innerWidth}px, ${((1 - y) / 2) * innerHeight}px)`;
    const d = world.distanceTo(camera.position);
    this.q(".sb-marker span").textContent = `${label}${label ? " · " : ""}${d < 1000 ? Math.round(d) + " m" : (d / 1000).toFixed(1) + " km"}`;
  }
  letterbox(on: boolean) {
    this.root.classList.toggle("cine", on);
  }
  skip(progress: number | null) {
    const el = this.q(".sb-skip");
    el.hidden = progress === null;
    if (progress !== null) this.q<HTMLElement>(".sb-skip i").style.width = `${progress * 100}%`;
  }

  // --- Fades and cards --------------------------------------------------------
  fade(to: number, seconds: number) {
    this.fadeFrom = this.fadeValue;
    this.fadeTo = to;
    this.fadeDur = seconds;
    this.fadeT = seconds > 0 ? 0 : 1;
    if (seconds <= 0) this.fadeValue = to;
    return () => this.fadeT >= 1;
  }
  card(small: string, big: string, body = "") {
    const el = this.q(".sb-card");
    el.hidden = !big;
    this.q(".sb-card .sb-micro").textContent = small;
    this.q(".sb-card h2").textContent = big;
    this.q(".sb-card p").textContent = body;
    el.classList.remove("show");
    if (big) requestAnimationFrame(() => el.classList.add("show"));
  }
  hideCard() {
    const el = this.q(".sb-card");
    el.classList.remove("show");
    setTimeout(() => {
      if (!el.classList.contains("show")) el.hidden = true;
    }, 900);
  }

  // --- Menus -----------------------------------------------------------------
  menu(entries: ChapterEntry[] | null, onPick: (id: string) => void, onBack: () => void) {
    const el = this.q(".sb-menu");
    el.hidden = !entries;
    if (!entries) return;
    const list = this.q(".sb-chapters");
    list.innerHTML = "";
    for (const e of entries) {
      const li = document.createElement("li");
      li.innerHTML = `<button ${e.ready ? "" : "disabled"}><span class="n">${e.number}</span><span class="t"><strong>${e.title}</strong><small>${e.blurb}</small></span><span class="go">${e.ready ? "Play ▶" : "In production"}</span></button>`;
      if (e.ready) li.querySelector("button")!.onclick = () => onPick(e.id);
      list.append(li);
    }
    this.q<HTMLButtonElement>(".sb-back").onclick = onBack;
    (list.querySelector("button:not([disabled])") as HTMLButtonElement | null)?.focus();
  }
  pause(title: string | null, keys: string, onAct: (act: string) => void) {
    const el = this.q(".sb-pause");
    el.hidden = title === null;
    if (title === null) return;
    this.q(".sb-pause-title").textContent = title;
    this.q(".sb-keys").innerHTML = keys;
    el.querySelectorAll<HTMLButtonElement>("button").forEach((b) => (b.onclick = () => onAct(b.dataset.act!)));
    el.querySelector<HTMLButtonElement>("button")?.focus();
  }
  end(small: string | null, big = "", body = "", actions: [string, () => void][] = []) {
    const el = this.q(".sb-end");
    el.hidden = small === null;
    if (small === null) return;
    this.q(".sb-end .sb-micro").textContent = small;
    this.q(".sb-end h2").textContent = big;
    this.q(".sb-end p").textContent = body;
    const box = this.q(".sb-end-actions");
    box.innerHTML = "";
    for (const [label, fn] of actions) {
      const b = document.createElement("button");
      b.textContent = label;
      b.onclick = fn;
      box.append(b);
    }
    box.querySelector("button")?.focus();
  }
  /** Clear every transient element (between chapters). */
  reset() {
    this.clearLines();
    this.objective(null);
    this.prompt(null);
    this.choice(null);
    this.telemetry(null);
    this.meter(null);
    this.speed(null);
    this.hint(null);
    this.skip(null);
    this.letterbox(false);
    this.card("", "");
    this.q(".sb-marker").hidden = true;
    this.end(null);
  }

  update(dt: number) {
    if (this.current) {
      this.lineT += dt;
      if (this.lineT >= this.current.duration) this.current = null;
    }
    if (!this.current && this.lines.length) {
      this.current = this.lines.shift()!;
      this.lineT = 0;
    }
    this.showLine(this.current);
    if (this.fadeT < 1) {
      this.fadeT = Math.min(1, this.fadeT + dt / this.fadeDur);
      const u = this.fadeT * this.fadeT * (3 - 2 * this.fadeT);
      this.fadeValue = this.fadeFrom + (this.fadeTo - this.fadeFrom) * u;
    }
    this.q<HTMLElement>(".sb-fade").style.opacity = String(this.fadeValue);
  }
}
