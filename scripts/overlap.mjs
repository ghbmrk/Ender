// Finds text and controls that visibly overlap on the current screen: node scripts that drive the game call
// overlaps(page) at each stop. A "unit" is a control (button, card) or a run of text outside one; two units clash
// when their boxes cross by more than a sliver and one of them is on top where they cross (not both under a sheet).
export async function overlaps(page) {
  return page.evaluate(() => {
    const W = innerWidth, H = innerHeight;
    const shown = (el) => {
      for (let e = el; e && e !== document.body; e = e.parentElement) {
        const cs = getComputedStyle(e);
        if (cs.display === "none" || cs.visibility === "hidden" || +cs.opacity < 0.15) return false;
      }
      return true;
    };
    const isUnit = (el) => el.matches("button, [role=button], a, input, .card");
    // What of a box is actually on screen: cut to every clipping (scrolling) parent.
    const clip = (el, r) => {
      let { left, top, right, bottom } = r;
      for (let e = el.parentElement; e && e !== document.body; e = e.parentElement) {
        const cs = getComputedStyle(e);
        if (cs.overflowX === "visible" && cs.overflowY === "visible") continue;
        const c = e.getBoundingClientRect();
        left = Math.max(left, c.left); top = Math.max(top, c.top); right = Math.min(right, c.right); bottom = Math.min(bottom, c.bottom);
      }
      return { left, top, right, bottom, width: right - left, height: bottom - top, scrolled: left !== r.left || top !== r.top || right !== r.right || bottom !== r.bottom };
    };
    const units = [];
    for (const el of document.querySelectorAll("button, [role=button], a, input, .card")) {
      if (el.parentElement?.closest("button, [role=button], .card")) continue;
      if (!shown(el) || el.closest("[aria-hidden=true]")) continue;
      const r = clip(el, el.getBoundingClientRect());
      if (r.width < 2 || r.height < 2) continue;
      units.push({ el, r });
    }
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    const byEl = new Map();
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      if (!n.textContent.trim()) continue;
      const el = n.parentElement;
      if (!el || el.closest("button, [role=button], a, .card, [aria-hidden=true], script, style, svg")) continue;
      if (!shown(el)) continue;
      const range = document.createRange();
      range.selectNodeContents(n);
      const r = range.getBoundingClientRect();
      if (r.width < 2 || r.height < 2) continue;
      const prev = byEl.get(el);
      byEl.set(el, prev ? { left: Math.min(prev.left, r.left), top: Math.min(prev.top, r.top), right: Math.max(prev.right, r.right), bottom: Math.max(prev.bottom, r.bottom) } : { left: r.left, top: r.top, right: r.right, bottom: r.bottom });
    }
    for (const [el, r] of byEl) {
      const c = clip(el, r);
      if (c.width >= 2 && c.height >= 2) units.push({ el, r: c });
    }
    const label = (el) => {
      const cls = typeof el.className === "string" && el.className ? "." + el.className.trim().split(/\s+/).slice(0, 2).join(".") : "";
      const t = (el.getAttribute("data-testid") ? `[${el.getAttribute("data-testid")}] ` : "") + (el.innerText ?? el.textContent ?? "").replace(/\s+/g, " ").trim().slice(0, 28);
      return `${el.tagName.toLowerCase()}${cls} "${t}"`;
    };
    const out = [];
    for (let i = 0; i < units.length; i++)
      for (let j = i + 1; j < units.length; j++) {
        const a = units[i], b = units[j];
        if (a.el.contains(b.el) || b.el.contains(a.el)) continue;
        const x0 = Math.max(a.r.left, b.r.left, 0), x1 = Math.min(a.r.right, b.r.right, W);
        const y0 = Math.max(a.r.top, b.r.top, 0), y1 = Math.min(a.r.bottom, b.r.bottom, H);
        if (x1 - x0 < 4 || y1 - y0 < 4) continue;
        const area = (x1 - x0) * (y1 - y0);
        const small = Math.min(a.r.width * a.r.height, b.r.width * b.r.height);
        if (area < 0.08 * small) continue;
        const top = document.elementFromPoint((x0 + x1) / 2, (y0 + y1) / 2);
        if (!top || !(a.el.contains(top) || b.el.contains(top))) continue;
        // Both must show somewhere: one fully under a sheet or panel isn't a clash.
        const seen = (u) => { const t = document.elementFromPoint(Math.min(W - 1, Math.max(0, (u.r.left + u.r.right) / 2)), Math.min(H - 1, Math.max(0, (u.r.top + u.r.bottom) / 2))); return t && (u.el.contains(t) || t.contains(u.el)); };
        if (!seen(a) || !seen(b)) continue;
        out.push(`${label(a.el)}  ×  ${label(b.el)}  (${Math.round(x1 - x0)}×${Math.round(y1 - y0)} at ${Math.round(x0)},${Math.round(y0)})`);
      }
    // Anything cut off by the screen edge.
    for (const { el, r } of units) if (!r.scrolled && !el.closest(".timeline, .tl-strip")) if (r.right > W + 2 || r.left < -2 || r.bottom > H + 2) if (isUnit(el) || r.width < W) out.push(`${label(el)} runs off screen (${Math.round(r.left)},${Math.round(r.top)} ${Math.round(r.width)}×${Math.round(r.height)})`);
    return out;
  });
}
