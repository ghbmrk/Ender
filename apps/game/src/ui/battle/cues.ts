/**
 * The timing rings, drawn off React and off the main thread's paint: each ring is one element whose shrink is a
 * Web Animation on `transform` (run by the compositor), keyed to the sequence clock. A judgement on a tap is
 * written straight into the layer, so it shows on the next frame without waiting for a React render.
 */

/** Ring geometry in stage px (kept in step with RING_FROM / MARK_R in BattleScreen). */
export type RingGeo = { from: number; mark: number; lead: number; tail: number };

const STROKE = 30; // at full size; it thins as the ring closes (≈6px on the mark)

export class Cues {
  private rings = new Map<number, { el: HTMLDivElement; anim: Animation }>();
  constructor(
    private box: HTMLDivElement,
    private geo: RingGeo,
  ) {}

  /** The ring for cue `i`: it starts closing at real time `start` (performance.now() ms) and takes `lead` ms (scaled) to reach the mark. */
  ensure(i: number, at: [number, number], start: number, k: number, color: string) {
    if (this.rings.has(i)) return;
    const { from, mark, lead, tail } = this.geo;
    const el = document.createElement("div");
    el.className = "cue-ring";
    const outer = from + STROKE / 2;
    el.style.cssText = `left:${at[0] - outer}px;top:${at[1] - outer}px;width:${outer * 2}px;height:${outer * 2}px;border:${STROKE}px solid ${color}`;
    this.box.appendChild(el);
    const v = (from - mark) / lead;
    const end = Math.max(0.04, (mark - v * tail) / from);
    const total = (lead + tail) * k;
    const anim = el.animate(
      [
        { transform: "scale(1)", opacity: 0.35 },
        { transform: `scale(${mark / from})`, opacity: 1, offset: lead / (lead + tail) },
        { transform: `scale(${end})`, opacity: 0 },
      ],
      { duration: total, easing: "linear", fill: "both" },
    );
    // Keyed to the sequence clock, not to when this line ran: a late frame never shifts the ring.
    anim.startTime = start;
    anim.finished.then(() => this.drop(i)).catch(() => undefined);
    this.rings.set(i, { el, anim });
  }

  /** Takes ring `i` away (it was answered), with a quick pop rather than a cut. */
  drop(i: number, pop = false) {
    const r = this.rings.get(i);
    if (!r) return;
    this.rings.delete(i);
    if (!pop) return r.el.remove();
    // Freeze where it was answered, flare white and fade (a second animation layered over the first).
    r.anim.pause();
    r.el.style.borderColor = "#fff8e6";
    r.el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 220, easing: "ease-out", fill: "forwards" });
    setTimeout(() => r.el.remove(), 240);
  }

  /** A judgement word at a point, shown on the very next frame. */
  judge(text: string, cls: string, at: [number, number]) {
    const el = document.createElement("div");
    el.className = `judge ${cls}`;
    el.textContent = text;
    el.style.left = `${at[0]}px`;
    el.style.top = `${at[1]}px`;
    this.box.appendChild(el);
    el.addEventListener("animationend", () => el.remove(), { once: true });
    setTimeout(() => el.remove(), 1400);
  }

  /** The mark answers the tap at once: a flash on the target circle. */
  pulse(mark: HTMLElement | null, cls: string) {
    if (!mark) return;
    mark.classList.remove("pulse", "good", "perfect", "miss", "parry", "dodge");
    void mark.offsetWidth;
    mark.classList.add("pulse", cls);
  }

  clear() {
    for (const i of [...this.rings.keys()]) this.drop(i);
  }
}
