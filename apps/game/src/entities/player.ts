import Phaser from "phaser";
import { resolveCircleRect, type Rect } from "../combat/geometry";

export type Intent = {
  moveX: number;
  moveY: number;
  aimX: number;
  aimY: number;
  fire: boolean;
  sever: boolean;
  slip: boolean;
  unravel: boolean;
  interact: boolean;
};

export type PlayerStats = {
  maxHealth: number;
  moveSpeed: number;
  attackDamage: number;
  critChance: number;
  critMultiplier: number;
  cooldownRate: number;
  projectileSpeed: number;
  areaMultiplier: number;
  armor: number;
  wardPower: number;
  wardMultiplier: number;
};

export const DEFAULT_STATS: PlayerStats = {
  maxHealth: 120,
  moveSpeed: 230,
  attackDamage: 14,
  critChance: 0.05,
  critMultiplier: 1.75,
  cooldownRate: 1,
  projectileSpeed: 640,
  areaMultiplier: 1,
  armor: 0,
  wardPower: 0,
  wardMultiplier: 1,
};

export const BASE_COOLDOWNS = { bolt: 0.2, sever: 0.75, slip: 1.1, unravel: 6 };

/** Reads keyboard + mouse into an Intent. */
export class HumanInput {
  private keys: Record<string, Phaser.Input.Keyboard.Key>;
  private interactLatch = false;
  constructor(private scene: Phaser.Scene) {
    const kb = scene.input.keyboard!;
    this.keys = kb.addKeys("W,A,S,D,UP,LEFT,DOWN,RIGHT,SPACE,Q,E", false) as Record<string, Phaser.Input.Keyboard.Key>;
    scene.input.mouse?.disableContextMenu();
  }
  read(px: number, py: number, enabled: boolean): Intent {
    const k = this.keys;
    const p = this.scene.input.activePointer;
    const cam = this.scene.cameras.main;
    const world = cam.getWorldPoint(p.x, p.y);
    // While a panel is open, track E so a press that opened (or happened during) the panel never fires on close.
    if (!enabled) this.interactLatch = !!k.E?.isDown;
    if (!enabled) return { moveX: 0, moveY: 0, aimX: world.x - px, aimY: world.y - py, fire: false, sever: false, slip: false, unravel: false, interact: false };
    const mx = (k.D!.isDown || k.RIGHT!.isDown ? 1 : 0) - (k.A!.isDown || k.LEFT!.isDown ? 1 : 0);
    const my = (k.S!.isDown || k.DOWN!.isDown ? 1 : 0) - (k.W!.isDown || k.UP!.isDown ? 1 : 0);
    const e = k.E!.isDown;
    const interact = e && !this.interactLatch;
    this.interactLatch = e;
    return {
      moveX: mx,
      moveY: my,
      aimX: world.x - px,
      aimY: world.y - py,
      fire: p.leftButtonDown(),
      sever: p.rightButtonDown(),
      slip: Phaser.Input.Keyboard.JustDown(k.SPACE!),
      unravel: Phaser.Input.Keyboard.JustDown(k.Q!),
      interact,
    };
  }
}

export class PlayerBody {
  x: number;
  y: number;
  r = 15;
  facing = 0;
  vx = 0;
  vy = 0;
  hp: number;
  stats: PlayerStats;
  invuln = 0;
  dashT = 0;
  dashDir = { x: 1, y: 0 };
  cd = { bolt: 0, sever: 0, slip: 0, unravel: 0 };
  sprite: Phaser.GameObjects.Image;
  hurtFlash = 0;

  constructor(scene: Phaser.Scene, x: number, y: number, stats: PlayerStats) {
    this.x = x;
    this.y = y;
    this.stats = stats;
    this.hp = stats.maxHealth;
    this.sprite = scene.add.image(x, y, "player").setDepth(10);
  }

  cooldown(k: keyof typeof BASE_COOLDOWNS) {
    return BASE_COOLDOWNS[k] * (k === "slip" ? 1 : this.stats.cooldownRate);
  }

  /** Movement and dodge. Returns true when Slip was triggered this frame. */
  move(dt: number, intent: Intent, bounds: Rect, obstacles: Rect[]): boolean {
    for (const k of Object.keys(this.cd) as (keyof typeof this.cd)[]) this.cd[k] = Math.max(0, this.cd[k] - dt);
    this.invuln = Math.max(0, this.invuln - dt);
    this.hurtFlash = Math.max(0, this.hurtFlash - dt);
    this.facing = Math.atan2(intent.aimY, intent.aimX);
    let slipped = false;
    let mx = intent.moveX;
    let my = intent.moveY;
    const len = Math.hypot(mx, my);
    if (len > 0) {
      mx /= len;
      my /= len;
    }
    if (intent.slip && this.cd.slip <= 0) {
      const dx = len > 0 ? mx : Math.cos(this.facing);
      const dy = len > 0 ? my : Math.sin(this.facing);
      this.dashDir = { x: dx, y: dy };
      this.dashT = 0.16;
      this.invuln = Math.max(this.invuln, 0.32);
      this.cd.slip = this.cooldown("slip");
      slipped = true;
    }
    if (this.dashT > 0) {
      this.dashT -= dt;
      this.vx = this.dashDir.x * 1250;
      this.vy = this.dashDir.y * 1250;
    } else {
      // Snappy acceleration: responsive but not twitchy.
      const target = { x: mx * this.stats.moveSpeed, y: my * this.stats.moveSpeed };
      const a = Math.min(1, dt * 18);
      this.vx += (target.x - this.vx) * a;
      this.vy += (target.y - this.vy) * a;
    }
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    for (const o of obstacles) resolveCircleRect(this, this.r, o);
    this.x = Math.max(bounds.x + this.r, Math.min(bounds.x + bounds.w - this.r, this.x));
    this.y = Math.max(bounds.y + this.r, Math.min(bounds.y + bounds.h - this.r, this.y));
    this.sprite.setPosition(this.x, this.y).setRotation(this.facing);
    this.sprite.setAlpha(this.invuln > 0 && this.dashT <= 0 ? 0.55 + 0.45 * Math.sin(performance.now() / 30) : 1);
    if (this.hurtFlash > 0) this.sprite.setTint(0xff7070);
    else this.sprite.clearTint();
    return slipped;
  }
}
