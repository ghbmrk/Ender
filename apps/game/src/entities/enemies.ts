import Phaser from "phaser";
import { ENEMIES, type EliteModifier, type EnemyKind } from "@ender/content";
import { angleTo, dist, resolveCircleRect, type Rect } from "../combat/geometry";

export type EnemyState = "spawn" | "chase" | "windup" | "strike" | "lunge" | "recover" | "cast";

export class Enemy {
  static nextId = 1;
  id = Enemy.nextId++;
  x: number;
  y: number;
  vx = 0;
  vy = 0;
  r: number;
  hp: number;
  maxHp: number;
  speed: number;
  dmg: number;
  state: EnemyState = "spawn";
  t = 0.55;
  cd = 0;
  contactCd = 0;
  alive = true;
  flash = 0;
  strafe: number;
  armor = 0;
  sprite: Phaser.GameObjects.Image;
  bar: Phaser.GameObjects.Graphics;
  aim = 0;
  kx = 0;
  ky = 0;

  constructor(
    scene: Phaser.Scene,
    readonly kind: EnemyKind,
    x: number,
    y: number,
    difficulty: number,
    readonly elite?: EliteModifier,
  ) {
    const def = ENEMIES[kind];
    this.x = x;
    this.y = y;
    const scale = 1 + 0.18 * (difficulty - 1);
    this.maxHp = def.hp * scale * (elite === "hardened" ? 3.2 : elite === "volatile" ? 2.4 : 1);
    this.hp = this.maxHp;
    this.speed = def.speed * (elite ? 1.1 : 1);
    this.dmg = def.damage * (1 + 0.12 * (difficulty - 1)) * (elite ? 1.3 : 1);
    this.r = def.radius * (elite ? 1.45 : 1);
    if (elite === "hardened") this.armor = 0.3;
    this.strafe = Math.random() < 0.5 ? 1 : -1;
    this.sprite = scene.add.image(x, y, `enemy-${kind}`).setDepth(8).setScale(elite ? 1.45 : 1).setAlpha(0);
    if (elite) this.sprite.setTint(elite === "hardened" ? 0xc0c8ff : 0xffb070);
    this.bar = scene.add.graphics().setDepth(9);
    scene.tweens.add({ targets: this.sprite, alpha: 1, duration: 450 });
  }

  get name() {
    return ENEMIES[this.kind].name;
  }

  /** Apply damage; returns actual damage dealt. */
  hit(amount: number, kx = 0, ky = 0) {
    const d = amount * (1 - this.armor);
    this.hp -= d;
    this.flash = 0.1;
    const resist = this.kind === "keeper" || this.elite === "hardened" ? 0.3 : 1;
    this.kx += kx * resist;
    this.ky += ky * resist;
    return d;
  }

  destroy() {
    this.sprite.destroy();
    this.bar.destroy();
  }
}

export type EnemyWorld = {
  player: { x: number; y: number; r: number };
  obstacles: Rect[];
  bounds: Rect;
  shoot: (from: Enemy, angle: number, speed: number, dmg: number) => void;
  telegraph: (x: number, y: number, r: number, delay: number, dmg: number, color?: number) => void;
  melee: (from: Enemy, range: number, dmg: number) => void;
};

/** Per-kind behaviour. Telegraphed, readable, deterministic given the same inputs. */
export function updateEnemy(e: Enemy, dt: number, w: EnemyWorld) {
  e.t -= dt;
  e.cd -= dt;
  e.contactCd -= dt;
  e.flash = Math.max(0, e.flash - dt);
  const p = w.player;
  const d = dist(e, p);
  const a = angleTo(e, p);
  let mvx = 0;
  let mvy = 0;

  if (e.state === "spawn") {
    if (e.t <= 0) e.state = "chase";
  } else if (e.kind === "husk" || e.kind === "keeper") {
    const reach = e.kind === "keeper" ? 105 : 48;
    if (e.state === "chase") {
      mvx = Math.cos(a);
      mvy = Math.sin(a);
      if (d < reach + p.r && e.cd <= 0) {
        e.state = "windup";
        e.t = e.kind === "keeper" ? 0.8 : 0.42;
        if (e.kind === "keeper") w.telegraph(e.x, e.y, 110 * (e.elite ? 1.2 : 1), 0.8, e.dmg, 0xffa040);
      }
    } else if (e.state === "windup" && e.t <= 0) {
      if (e.kind === "husk") w.melee(e, reach + 10, e.dmg);
      e.state = "recover";
      e.t = 0.5;
      e.cd = e.kind === "keeper" ? 2.2 : 1.1;
    } else if (e.state === "recover" && e.t <= 0) e.state = "chase";
  } else if (e.kind === "hound") {
    if (e.state === "chase") {
      mvx = Math.cos(a);
      mvy = Math.sin(a);
      if (d < 170 && e.cd <= 0) {
        e.state = "windup";
        e.t = 0.35;
        e.aim = a;
      }
    } else if (e.state === "windup" && e.t <= 0) {
      e.state = "lunge";
      e.t = 0.28;
    } else if (e.state === "lunge") {
      mvx = Math.cos(e.aim) * 3.2;
      mvy = Math.sin(e.aim) * 3.2;
      if (d < e.r + p.r + 4 && e.contactCd <= 0) {
        w.melee(e, e.r + p.r + 8, e.dmg);
        e.contactCd = 0.6;
      }
      if (e.t <= 0) {
        e.state = "recover";
        e.t = 0.45;
        e.cd = 2;
      }
    } else if (e.state === "recover" && e.t <= 0) e.state = "chase";
  } else if (e.kind === "wisp" || e.kind === "seer") {
    const want = e.kind === "wisp" ? 290 : 330;
    const radial = d > want + 40 ? 1 : d < want - 40 ? -1 : 0;
    mvx = Math.cos(a) * radial + Math.cos(a + Math.PI / 2) * e.strafe * 0.6;
    mvy = Math.sin(a) * radial + Math.sin(a + Math.PI / 2) * e.strafe * 0.6;
    if (e.t <= 0) {
      e.strafe *= Math.random() < 0.3 ? -1 : 1;
      e.t = 1.5;
    }
    if (e.cd <= 0 && d < 620) {
      if (e.kind === "wisp") {
        w.shoot(e, a, 270, e.dmg);
        e.cd = 1.7;
      } else {
        w.telegraph(p.x, p.y, 72, 1.0, e.dmg, 0xc58cff);
        e.cd = 2.5;
      }
    }
  } else if (e.kind === "swarm") {
    const jitter = Math.sin(performance.now() / 180 + e.id) * 0.7;
    mvx = Math.cos(a + jitter);
    mvy = Math.sin(a + jitter);
    if (d < e.r + p.r + 2 && e.contactCd <= 0) {
      w.melee(e, e.r + p.r + 6, e.dmg);
      e.contactCd = 0.7;
    }
  }

  const slow = e.state === "windup" ? 0.15 : 1;
  e.vx = mvx * e.speed * slow + e.kx;
  e.vy = mvy * e.speed * slow + e.ky;
  e.kx *= Math.pow(0.001, dt);
  e.ky *= Math.pow(0.001, dt);
  e.x += e.vx * dt;
  e.y += e.vy * dt;
  for (const o of w.obstacles) resolveCircleRect(e, e.r, o);
  e.x = Math.max(w.bounds.x + e.r, Math.min(w.bounds.x + w.bounds.w - e.r, e.x));
  e.y = Math.max(w.bounds.y + e.r, Math.min(w.bounds.y + w.bounds.h - e.r, e.y));

  e.sprite.setPosition(e.x, e.y).setRotation(e.kind === "hound" ? (e.state === "lunge" ? e.aim : a) : 0);
  if (e.flash > 0) e.sprite.setTint(0xffffff);
  else if (e.state === "windup") e.sprite.setTint(0xff6a4a);
  else if (e.elite) e.sprite.setTint(e.elite === "hardened" ? 0xc0c8ff : 0xffb070);
  else e.sprite.clearTint();

  e.bar.clear();
  if (e.hp < e.maxHp || e.elite) {
    const w_ = Math.max(24, e.r * 2);
    e.bar.fillStyle(0x000000, 0.6).fillRect(e.x - w_ / 2, e.y - e.r - 10, w_, 4);
    e.bar.fillStyle(e.elite ? 0xffc04a : 0xd64545, 1).fillRect(e.x - w_ / 2, e.y - e.r - 10, (w_ * Math.max(0, e.hp)) / e.maxHp, 4);
  }
}
