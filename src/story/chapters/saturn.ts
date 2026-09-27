import "./saturn.css";

/** Frost over the view as the crew wake from cryo; `clear()` thaws it over a few seconds. */
export class Frost {
  private el = document.createElement("div");
  constructor() {
    this.el.className = "cryo-frost";
    document.body.append(this.el);
  }
  clear() {
    this.el.classList.add("clear");
  }
  dispose() {
    this.el.remove();
  }
}

export type FoldStep = "path" | "folded" | "pencil" | "hole" | "ball";

/**
 * Romilly's hologram: a sheet of space with two points on it. Fold it and a pencil goes
 * straight through from one to the other; the hole it leaves, given one more dimension,
 * is a sphere. Each step adds a class and CSS does the animation.
 */
export class Fold {
  private el = document.createElement("div");
  constructor() {
    this.el.className = "fold-holo";
    this.el.innerHTML = `
      <div class="fold-stage">
        <div class="fold-half fold-left"><i class="fold-path"></i><b class="fold-dot"></b><span class="fold-label">Saturn</span>
          <i class="fold-hole"></i><i class="fold-pencil"></i></div>
        <div class="fold-half fold-right"><i class="fold-path"></i><b class="fold-dot"></b><span class="fold-label">Gargantua</span></div>
      </div>
      <i class="fold-ball"></i>`;
    document.body.append(this.el);
    requestAnimationFrame(() => this.el.classList.add("show"));
  }
  step(s: FoldStep) {
    this.el.classList.add(s);
  }
  dispose() {
    this.el.classList.remove("show");
    const el = this.el;
    setTimeout(() => el.remove(), 1300);
  }
}
