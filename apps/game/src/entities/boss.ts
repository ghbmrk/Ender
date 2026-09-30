import Phaser from "phaser";
import { angleTo, dist, resolveCircleRect, type Rect } from "../combat/geometry";

export type BossWorld = {
  player: { x: number; y: number; r: number };
  obstacles: Rect[];
  bounds: Rect;
  bullet: (x: number, y: number, angle: number, speed: number, dmg: number) => void;
  telegraph: (x: number, y: number, r: number, delay: number, dmg: number, color?: number) => void;
  contact: (dmg: number) => void;
  summon: (kinds: string[]) => void;
  announce: (text: string) => void;
};

/**
 * The Bound King. Three phases, each guarded by an Epistemic Ward.
 * Normal damage reduces health; artifact power (vs. the phase's Ward target) decides how fast the Ward breaks,
 * how long vulnerability windows last and how hard the King presses.
 */
export class BoundKing {
  x: number;
  y: number;
  r = 50;
  hp: number;
  maxHp: number;
  phase = 1;
  ward = 100;
  wardUp = true;
  vulnerableT = 0;
  transitionT = 2;
  wardBreaks = 0;
  phaseStartedAt: number[] = [];
  alive = true;
  flash = 0;
  private burstT = 2;
  private slamT = 3.5;
  private spiralT = 5;
  private spiralOn = 0;
  private spiralA = 0;
  private spiralTick = 0;
  private triT = 3;
  private contactCd = 0;
  sprite: Phaser.GameObjects.Image;
  aura: Phaser.GameObjects.Graphics;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    hp: number,
    readonly wardTargets: readonly number[],
    readonly wardPower: number,
    readonly wardMultiplier: number,
  ) {
    this.x = x;
    this.y = y;
    this.hp = hp;
    this.maxHp = hp;
    this.sprite = scene.add.image(x, y, "boss").setDepth(8).setScale(0.2).setAlpha(0);
    scene.tweens.add({ targets: this.sprite, scale: 1, alpha: 1, duration: 1200, ease: "Back.Out" });
    this.aura = scene.add.graphics().setDepth(7);
    this.phaseStartedAt.push(performance.now());
  }

  get wardTarget() {
    return this.wardTargets[this.phase - 1]!;
  }
  /** Effective artifact power relative to this phase's Ward target. */
  get wardRatio() {
    return Math.max(0.25, Math.min(2, (this.wardPower * this.wardMultiplier) / this.wardTarget));
  }
  /** Below-target artifacts make the King press harder. */
  get pressure() {
    return this.wardRatio < 1 ? 1 + 0.6 * (1 - this.wardRatio) : 1;
  }

  hit(amount: number): number {
    if (this.transitionT > 0 || !this.alive) return 0;
    this.flash = 0.08;
    let dealt: number;
    if (this.wardUp) {
      dealt = amount * 0.25;
      this.ward -= amount * 0.9 * this.wardRatio;
      if (this.ward <= 0) {
        this.ward = 0;
        this.wardUp = false;
        this.wardBreaks++;
        this.vulnerableT = 4 + 3 * Math.max(0, this.wardRatio - 1);
      }
    } else dealt = amount * 1.5;
    this.hp -= dealt;
    return dealt;
  }

  update(dt: number, w: BossWorld) {
    if (!this.alive) return;
    this.flash = Math.max(0, this.flash - dt);
    this.contactCd -= dt;
    const p = w.player;
    const a = angleTo(this, p);
    const d = dist(this, p);

    // Phase transitions at 66% / 33%.
    const next = this.hp < this.maxHp * 0.33 ? 3 : this.hp < this.maxHp * 0.66 ? 2 : 1;
    if (next > this.phase) {
      this.phase = next;
      this.phaseStartedAt.push(performance.now());
      this.ward = 100;
      this.wardUp = true;
      this.vulnerableT = 0;
      // Weak artifacts: slower, more punishing transitions.
      this.transitionT = 1.5 + 3 * Math.max(0, 1 - this.wardRatio);
      const adds = next === 2 ? ["husk", "husk", "wisp"] : ["hound", "hound", "seer"];
      if (this.wardRatio < 1) adds.push(next === 2 ? "keeper" : "wisp");
      w.summon(adds);
      w.announce(next === 2 ? "The King's Ward thickens" : "The King unbinds his last seal");
    }

    if (this.transitionT > 0) {
      this.transitionT -= dt;
      this.drawAura();
      this.sprite.setPosition(this.x, this.y);
      return;
    }

    if (!this.wardUp) {
      this.vulnerableT -= dt;
      if (this.vulnerableT <= 0) {
        this.wardUp = true;
        this.ward = 60;
      }
    }

    const rate = this.pressure * (this.phase === 3 ? 1.25 : 1);
    this.burstT -= dt * rate;
    this.slamT -= dt * rate;
    if (this.burstT <= 0) {
      const n = [12, 14, 18][this.phase - 1]!;
      const off = Math.random() * Math.PI;
      for (let i = 0; i < n; i++) w.bullet(this.x, this.y, off + (i / n) * Math.PI * 2, 210 + 20 * this.phase, 11);
      this.burstT = [2.6, 2.2, 1.8][this.phase - 1]!;
    }
    if (this.slamT <= 0) {
      w.telegraph(p.x, p.y, 95, 0.95, 20, 0xff4b4b);
      this.slamT = 4.2;
    }
    if (this.phase >= 2) {
      this.spiralT -= dt;
      if (this.spiralT <= 0 && this.spiralOn <= 0) {
        this.spiralOn = 2.8;
        this.spiralT = 7;
      }
      if (this.spiralOn > 0) {
        this.spiralOn -= dt;
        this.spiralTick -= dt;
        this.spiralA += dt * 2.4;
        if (this.spiralTick <= 0) {
          w.bullet(this.x, this.y, this.spiralA, 240, 9);
          w.bullet(this.x, this.y, this.spiralA + Math.PI, 240, 9);
          this.spiralTick = 0.09;
        }
      }
    }
    if (this.phase === 3) {
      this.triT -= dt * rate;
      if (this.triT <= 0) {
        for (let i = 0; i < 3; i++) {
          const ang = (i / 3) * Math.PI * 2 + Math.random();
          w.telegraph(p.x + Math.cos(ang) * 110, p.y + Math.sin(ang) * 110, 80, 1.1, 18, 0xc58cff);
        }
        this.triT = 3.2;
      }
    }

    // Drift toward the player, keeping a duelling distance.
    const want = this.phase === 3 ? 160 : 230;
    const sp = 55 + 15 * this.phase;
    if (d > want) {
      this.x += Math.cos(a) * sp * dt;
      this.y += Math.sin(a) * sp * dt;
    } else if (d < want - 60) {
      this.x -= Math.cos(a) * sp * 0.6 * dt;
      this.y -= Math.sin(a) * sp * 0.6 * dt;
    }
    for (const o of w.obstacles) resolveCircleRect(this, this.r, o);
    this.x = Math.max(w.bounds.x + this.r, Math.min(w.bounds.x + w.bounds.w - this.r, this.x));
    this.y = Math.max(w.bounds.y + this.r, Math.min(w.bounds.y + w.bounds.h - this.r, this.y));
    if (d < this.r + p.r && this.contactCd <= 0) {
      w.contact(16);
      this.contactCd = 0.8;
    }
    this.sprite.setPosition(this.x, this.y).setRotation(Math.sin(performance.now() / 900) * 0.08);
    this.sprite.setTint(this.flash > 0 ? 0xffffff : this.wardUp ? 0xffffff : 0xffb0b0);
    this.drawAura();
  }

  private drawAura() {
    const g = this.aura;
    g.clear();
    if (this.wardUp) {
      const t = performance.now() / 600;
      g.lineStyle(4, 0xb58cff, 0.35 + 0.5 * (this.ward / 100)).strokeCircle(this.x, this.y, this.r + 14 + Math.sin(t) * 3);
      g.lineStyle(2, 0xe9dcff, 0.5 * (this.ward / 100)).strokeCircle(this.x, this.y, this.r + 24 + Math.cos(t) * 3);
    } else {
      g.lineStyle(3, 0xff5a5a, 0.8).strokeCircle(this.x, this.y, this.r + 10);
    }
    if (this.transitionT > 0) g.fillStyle(0xb58cff, 0.15).fillCircle(this.x, this.y, this.r + 40);
  }

  destroy() {
    this.sprite.destroy();
    this.aura.destroy();
  }
}
