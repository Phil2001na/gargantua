import type { Chapter, Story } from "../story";
import type { Wait } from "../engine";
import type { Atlas } from "../../atlas";

/**
 * Chapter six: the wormhole. The atlas already has the ray-traced bridge, the Endurance and
 * the crossing; this chapter hosts it and supplies the script. First pass (A1): open near
 * Saturn, let the autopilot fly through, a line at each phase of the crossing.
 * Dialogue is original, written for this project.
 */

const KEYS = `The autopilot has the controls for now.<br>Hold <kbd>Space</kbd> to skip the crossing`;

export class WormholeChapter implements Chapter {
  readonly title = "06 · The Wormhole";
  readonly keys = KEYS;
  checkpoint = "start";
  modal = false;
  private atlas!: Atlas;
  private stage: "approach" | "crossing" | "through" | "end" = "approach";
  /** Chapter time (stops while paused), for the script's safety timeouts. */
  private clock = 0;
  /** The atlas counts crossings for its whole life; this chapter's start from here. */
  private base = 0;
  constructor(private s: Story) {}

  start(checkpoint = "start") {
    this.checkpoint = checkpoint;
    this.s.ui.fade(1, 0);
    this.atlas = this.s.host("saturn");
    this.base = this.atlas.hostState.crossings;
    this.s.cinematicMode = true;
    this.s.input.capture(false);
    this.s.run(() => this.crossing());
  }
  dispose() {
    this.s.ui.hideCard();
    // Story ends the hosting itself (endChapter); nothing else of ours is in a scene.
  }
  skip() {
    this.s.ui.hideCard();
    if (this.stage === "approach" || this.stage === "crossing") {
      this.stage = "through";
      this.s.run(() => this.skipped());
    }
  }
  update(dt: number) {
    this.clock += dt;
  }

  private get state() {
    return this.atlas.hostState;
  }
  private get crossed() {
    return this.state.crossings > this.base;
  }
  /** Wait for a condition, but never longer than `max` seconds (the script can't hang). */
  private until(pred: () => boolean, max: number): () => boolean {
    const t0 = this.clock;
    return () => pred() || this.clock - t0 > max;
  }

  private *crossing(): Generator<Wait> {
    const { ui } = this.s;
    this.stage = "approach";
    ui.fade(0, 2.5);
    yield 1.2;
    ui.card("Chapter six", "The Wormhole", "Saturn, and a sphere in space.");
    yield 3.5;
    ui.hideCard();
    yield ui.say("TARS", "Saturn orbit. The anomaly is dead ahead, twenty kilometres.");
    yield ui.say("Romilly", "It isn't a hole. It's a ball. You can see stars on it that aren't ours.");
    yield ui.say("Cooper", "TARS, take us in. Nice and slow.");
    this.atlas.autopilotWormhole();
    yield ui.say("TARS", "Nice and slow is the only speed it allows.");
    yield this.until(() => this.state.phase !== "outside", 120);
    this.stage = "crossing";
    ui.clearLines();
    ui.say("Doyle", "We're in its field. Instruments are going strange.");
    yield this.until(() => this.state.phase === "throat" || this.crossed, 60);
    ui.clearLines();
    ui.say("Brand", "Everyone hold on.");
    yield this.until(() => this.state.they > 0.3 || this.crossed, 20);
    ui.say("Brand", "Did you feel that? Something passed through us.");
    yield this.until(() => this.crossed, 60);
    yield this.until(() => this.state.phase === "emerging" || this.state.phase === "outside", 30);
    this.stage = "through";
    ui.say("TARS", "Coming out the other side.");
    yield this.until(() => this.state.phase === "outside", 60);
    yield* this.arrival();
  }
  /** A skipped crossing: cut through black to just beyond Gargantua's mouth. */
  private *skipped(): Generator<Wait> {
    const { ui } = this.s;
    ui.clearLines();
    yield ui.fade(1, 0.6);
    this.atlas.host("beyond");
    ui.fade(0, 1.6);
    yield 1;
    yield* this.arrival();
  }
  private *arrival(): Generator<Wait> {
    const { ui } = this.s;
    this.stage = "through";
    yield ui.say("Romilly", "That's not our sky.");
    yield this.until(() => this.state.autopilot === null, 25);
    yield ui.say("Cooper", "Gargantua. There it is.");
    yield ui.say("Brand", "Miller's signal is coming from the first planet. Closest to it.");
    yield 1.5;
    this.stage = "end";
    this.s.cinematicMode = false;
    ui.end(
      "Chapter six complete",
      "The Wormhole",
      "Through the sphere and out under another galaxy's sky. (First pass: the arrival at Saturn and the piloted crossing are in production.)",
      [
        ["On to Miller ▶", () => this.s.play("miller")],
        ["Replay chapter", () => this.s.restart(false)],
        ["Chapters", () => this.s.toMenu()],
      ],
    );
  }
}
