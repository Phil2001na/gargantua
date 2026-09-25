import type { StoryAudio } from "../sound";

/**
 * Cooper's notebook: copy the dust bands down as wide or narrow marks, row by row, and
 * read each row as a binary number. Click a mark to flip it. Four rows right is the answer.
 */
export class Notebook {
  readonly el: HTMLElement;
  private bits: number[][];
  private solved = false;
  private hintsUsed = 0;
  private keyHandler: (e: KeyboardEvent) => void;
  constructor(
    host: HTMLElement,
    private answer: number[],
    private width: number,
    private audio: StoryAudio,
    saved: number[][] | null,
    private onSolve: () => void,
    private onClose: (bits: number[][]) => void,
  ) {
    this.bits = saved ? saved.map((r) => [...r]) : answer.map(() => new Array(width).fill(0));
    this.el = document.createElement("section");
    this.el.className = "sb-notebook";
    this.el.innerHTML = `
      <div class="page">
        <div class="sb-micro">Notebook · the dust</div>
        <h3>Four rows of lines on the floor</h3>
        <p class="how">Rows go from the desk (1) toward the bed (4). Read each row starting at the <b>window</b>.
        Mark a <b>wide</b> band as 1 and a <b>narrow</b> one as 0. Click a mark to flip it.</p>
        <div class="rows"></div>
        <div class="result" aria-live="polite"></div>
        <div class="actions"><button class="check">Check</button><button class="hint">Hint</button><button class="close">Back to the room <kbd>N</kbd></button></div>
      </div>`;
    host.append(this.el);
    this.render();
    this.el.querySelector<HTMLButtonElement>(".check")!.onclick = () => this.check();
    this.el.querySelector<HTMLButtonElement>(".hint")!.onclick = () => this.hint();
    this.el.querySelector<HTMLButtonElement>(".close")!.onclick = () => this.onClose(this.bits);
    this.keyHandler = (e) => {
      if (e.code === "Escape" || e.code === "KeyN") {
        e.preventDefault();
        this.onClose(this.bits);
      } else if (e.code === "KeyH") this.hint();
      else if (e.code === "Enter") this.check();
    };
    window.addEventListener("keydown", this.keyHandler);
    this.el.querySelector<HTMLButtonElement>(".rows button")?.focus();
  }
  private render() {
    const rows = this.el.querySelector(".rows")!;
    rows.innerHTML = "";
    this.bits.forEach((row, r) => {
      const line = document.createElement("div");
      line.className = "row";
      line.innerHTML = `<span class="n">${r + 1}</span>`;
      const marks = document.createElement("span");
      marks.className = "marks";
      row.forEach((b, i) => {
        const btn = document.createElement("button");
        btn.className = b ? "wide" : "narrow";
        btn.setAttribute("aria-label", `Row ${r + 1}, band ${i + 1}: ${b ? "wide" : "narrow"}`);
        btn.innerHTML = "<i></i>";
        btn.onclick = () => {
          if (this.solved) return;
          row[i] ^= 1;
          this.audio.blip(row[i] ? 520 : 390, 0.02);
          this.render();
          (rows.querySelectorAll(".row")[r].querySelectorAll("button")[i] as HTMLButtonElement).focus();
        };
        marks.append(btn);
      });
      line.append(marks);
      const bin = document.createElement("span");
      bin.className = "bin";
      bin.textContent = row.join("");
      const dec = document.createElement("span");
      dec.className = "dec";
      dec.textContent = "= " + parseInt(row.join(""), 2);
      line.append(bin, dec);
      rows.append(line);
    });
  }
  private value(r: number) {
    return parseInt(this.bits[r].join(""), 2);
  }
  private check() {
    const right = this.answer.filter((v, r) => this.value(r) === v).length;
    const res = this.el.querySelector(".result")!;
    if (right === this.answer.length) {
      this.solved = true;
      this.el.classList.add("solved");
      const [a, b, c, d] = this.answer;
      res.innerHTML = `<strong>${a}° ${String(b).padStart(2, "0")}′ N &nbsp; ${c}° ${String(d).padStart(2, "0")}′ W</strong><span>Degrees and minutes. They're coordinates.</span>`;
      this.audio.blip(660, 0.04);
      setTimeout(() => this.audio.blip(990, 0.04), 140);
      setTimeout(() => this.onSolve(), 2400);
    } else {
      res.innerHTML = `<span>${right} of ${this.answer.length} rows look right. Go back and look again.</span>`;
      this.audio.blip(220, 0.03);
    }
  }
  /** Fill in the first row that's wrong. */
  private hint() {
    if (this.solved) return;
    const r = this.answer.findIndex((v, i) => this.value(i) !== v);
    if (r < 0) return this.check();
    this.hintsUsed++;
    this.bits[r] = this.answer[r].toString(2).padStart(this.width, "0").split("").map(Number);
    this.render();
    this.el.querySelector(".result")!.innerHTML = `<span>Row ${r + 1} filled in from the floor.</span>`;
  }
  dispose() {
    window.removeEventListener("keydown", this.keyHandler);
    this.el.remove();
  }
}
