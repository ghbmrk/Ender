import Phaser from "phaser";
import { ENEMIES } from "@weave/content";

/** All art is procedural: generated once at boot from Graphics. */
export function makeTextures(scene: Phaser.Scene) {
  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  const tex = (key: string, w: number, h: number, draw: () => void) => {
    g.clear();
    draw();
    g.generateTexture(key, w, h);
  };

  tex("player", 44, 44, () => {
    g.fillStyle(0x0d0b12, 1).fillCircle(22, 22, 17);
    g.lineStyle(3, 0xc9a24a, 1).strokeCircle(22, 22, 15);
    g.fillStyle(0xe8d9a8, 1).fillCircle(22, 22, 7);
    g.fillStyle(0xc9a24a, 1).fillTriangle(34, 22, 26, 16, 26, 28);
  });
  tex("bolt", 20, 20, () => {
    g.fillStyle(0xb58cff, 0.35).fillCircle(10, 10, 9);
    g.fillStyle(0xe9dcff, 1).fillCircle(10, 10, 4);
  });
  tex("ebolt", 18, 18, () => {
    g.fillStyle(0xff5a3c, 0.35).fillCircle(9, 9, 8);
    g.fillStyle(0xffd2b0, 1).fillCircle(9, 9, 4);
  });
  tex("spark", 8, 8, () => {
    g.fillStyle(0xffffff, 1).fillCircle(4, 4, 3);
  });
  tex("mote", 12, 12, () => {
    g.fillStyle(0xffffff, 0.4).fillCircle(6, 6, 6);
    g.fillStyle(0xffffff, 1).fillCircle(6, 6, 3);
  });
  tex("coin", 14, 14, () => {
    g.fillStyle(0xc9a24a, 1).fillCircle(7, 7, 6);
    g.lineStyle(1.5, 0xfff0b8, 1).strokeCircle(7, 7, 4);
  });
  tex("form", 30, 30, () => {
    g.fillStyle(0xb58cff, 0.25).fillCircle(15, 15, 14);
    g.fillStyle(0x2a1f3d, 1).fillTriangle(15, 3, 27, 15, 15, 27).fillTriangle(15, 3, 3, 15, 15, 27);
    g.lineStyle(2, 0xd9c4ff, 1).beginPath().moveTo(15, 3).lineTo(27, 15).lineTo(15, 27).lineTo(3, 15).closePath().strokePath();
  });
  tex("portal", 90, 140, () => {
    g.fillStyle(0x6b4fa8, 0.25).fillEllipse(45, 70, 86, 136);
    g.lineStyle(4, 0xb58cff, 1).strokeEllipse(45, 70, 70, 120);
    g.lineStyle(2, 0xe9dcff, 0.8).strokeEllipse(45, 70, 50, 96);
  });
  tex("shrine", 120, 120, () => {
    g.fillStyle(0x7fe3e0, 0.12).fillCircle(60, 60, 58);
    g.lineStyle(3, 0x7fe3e0, 0.9).strokeCircle(60, 60, 42);
    g.fillStyle(0x10201f, 1).fillRect(46, 40, 28, 40);
    g.lineStyle(2, 0xbff7f5, 1).strokeRect(46, 40, 28, 40);
    g.fillStyle(0xbff7f5, 1).fillCircle(60, 52, 5);
  });

  for (const [kind, def] of Object.entries(ENEMIES)) {
    const r = def.radius;
    const s = r * 2 + 8;
    tex(`enemy-${kind}`, s, s, () => {
      const c = s / 2;
      g.fillStyle(0x000000, 0.35).fillCircle(c + 2, c + 3, r);
      g.fillStyle(def.color, 1);
      if (kind === "wisp") {
        g.fillCircle(c, c, r * 0.8);
        g.fillStyle(0xffffff, 0.8).fillCircle(c, c, r * 0.35);
      } else if (kind === "hound") {
        g.fillTriangle(c + r, c, c - r, c - r * 0.8, c - r, c + r * 0.8);
        g.fillStyle(0xffe0a0, 1).fillCircle(c + r * 0.3, c - 3, 2).fillCircle(c + r * 0.3, c + 3, 2);
      } else if (kind === "keeper") {
        g.fillRoundedRect(c - r, c - r, r * 2, r * 2, 6);
        g.lineStyle(3, 0xa9aec8, 1).strokeRoundedRect(c - r, c - r, r * 2, r * 2, 6);
        g.fillStyle(0xffe08a, 1).fillRect(c + r * 0.2, c - 3, r * 0.5, 6);
      } else if (kind === "seer") {
        g.fillTriangle(c, c - r, c + r, c + r, c - r, c + r);
        g.fillStyle(0xffffff, 1).fillCircle(c, c + r * 0.2, 3);
      } else {
        g.fillCircle(c, c, r);
        g.fillStyle(0x1a1410, 1).fillCircle(c + r * 0.35, c - r * 0.25, Math.max(1.5, r * 0.15)).fillCircle(c + r * 0.35, c + r * 0.25, Math.max(1.5, r * 0.15));
      }
    });
  }
  tex("boss", 120, 120, () => {
    g.fillStyle(0x000000, 0.4).fillCircle(63, 66, 50);
    g.fillStyle(0x2b1830, 1).fillCircle(60, 60, 50);
    g.lineStyle(4, 0xc9a24a, 1).strokeCircle(60, 60, 50);
    g.fillStyle(0xc9a24a, 1).fillTriangle(30, 28, 40, 6, 48, 26).fillTriangle(52, 22, 60, 0, 68, 22).fillTriangle(72, 26, 80, 6, 90, 28);
    g.fillStyle(0xff4b4b, 1).fillCircle(46, 58, 5).fillCircle(74, 58, 5);
    g.lineStyle(2, 0xb58cff, 0.8).strokeCircle(60, 60, 38).strokeCircle(60, 60, 26);
  });
  tex("station", 110, 110, () => {
    g.fillStyle(0xffffff, 0.08).fillCircle(55, 55, 54);
    g.lineStyle(2, 0xffffff, 0.9).strokeCircle(55, 55, 40);
    g.lineStyle(1, 0xffffff, 0.5).strokeCircle(55, 55, 50);
  });
  g.destroy();
}
